import hmac
import os
from datetime import datetime, timedelta, timezone, date
from fastapi import APIRouter, Depends, HTTPException, Request, BackgroundTasks
from pydantic import BaseModel, Field

from database import db
from security import require_roles
from utils import uid, now_iso, TZ, get_settings, notify, audit
from routers_merchant import get_merchant_restaurant

router = APIRouter(prefix="/api", tags=["billing"])
admin = require_roles("admin")
merchant = require_roles("restaurant")

PERIODS = ("weekly", "biweekly", "monthly")
PERIOD_LABEL = {"weekly": "Semanal", "biweekly": "Quinzenal", "monthly": "Mensal"}


def period_bounds(period: str, ref: date) -> tuple[date, date]:
    """Retorna (início, fim exclusivo) do período que contém `ref`."""
    if period == "weekly":
        start = ref - timedelta(days=ref.weekday())
        return start, start + timedelta(days=7)
    if period == "biweekly":
        if ref.day <= 15:
            return ref.replace(day=1), ref.replace(day=16)
        start = ref.replace(day=16)
        nxt = (start.replace(day=28) + timedelta(days=4)).replace(day=1)
        return start, nxt
    start = ref.replace(day=1)
    nxt = (start.replace(day=28) + timedelta(days=4)).replace(day=1)
    return start, nxt


def iso_range(start: date, end: date) -> tuple[str, str]:
    s = datetime.combine(start, datetime.min.time(), tzinfo=TZ).astimezone(timezone.utc).isoformat()
    e = datetime.combine(end, datetime.min.time(), tzinfo=TZ).astimezone(timezone.utc).isoformat()
    return s, e


async def fee_summary(rid: str, start: date, end: date) -> dict:
    s, e = iso_range(start, end)
    txs = await db.transactions.find({"restaurant_id": rid, "created_at": {"$gte": s, "$lt": e}}, {"_id": 0}).to_list(50000)
    fees = [t for t in txs if t["type"] == "zupi_fee"]
    reversals = [t for t in txs if t["type"] == "zupi_fee_reversal"]
    return {
        "orders": len(fees), "cancelled": len(reversals),
        "gross_fees": round(sum(t["amount"] for t in fees), 2),
        "reversals": round(sum(-t["amount"] for t in reversals), 2),
        "amount": round(sum(t["amount"] for t in txs), 2),
    }


def restaurant_period(r: dict, settings: dict) -> str:
    p = r.get("billing_period") or settings.get("billing_period") or "monthly"
    return p if p in PERIODS else "monthly"


async def close_due_invoices(rid: str | None = None) -> int:
    """Gera faturas de todos os períodos já encerrados que ainda não têm fatura. Idempotente."""
    settings = await get_settings()
    due_days = int(settings.get("billing_due_days", 5))
    today = datetime.now(TZ).date()
    filt = {"status": "active"} if not rid else {"id": rid}
    created = 0
    async for r in db.restaurants.find(filt, {"_id": 0, "id": 1, "name": 1, "owner_id": 1, "billing_period": 1, "created_at": 1, "billing_start": 1}):
        period = restaurant_period(r, settings)
        first_tx = await db.transactions.find_one({"restaurant_id": r["id"]}, {"_id": 0, "created_at": 1}, sort=[("created_at", 1)])
        if not first_tx:
            continue
        cursor_day = datetime.fromisoformat(first_tx["created_at"]).astimezone(TZ).date()
        if r.get("billing_start"):
            cursor_day = max(cursor_day, date.fromisoformat(r["billing_start"]))
        start, end = period_bounds(period, cursor_day)
        while end <= today:
            exists = await db.invoices.find_one({"restaurant_id": r["id"], "period_start": start.isoformat(), "period_end": end.isoformat()})
            if not exists:
                summary = await fee_summary(r["id"], start, end)
                if summary["orders"] > 0 or summary["amount"] != 0:
                    seq = await db.invoices.count_documents({}) + 1
                    inv = {
                        "id": uid(), "number": f"ZP-{end.strftime('%Y%m')}-{seq:04d}", "restaurant_id": r["id"], "restaurant_name": r["name"],
                        "period": period, "period_start": start.isoformat(), "period_end": end.isoformat(),
                        "due_date": (end + timedelta(days=due_days)).isoformat(), **summary,
                        "status": "open", "created_at": now_iso(), "paid_at": None, "payment_note": "",
                    }
                    await db.invoices.insert_one(inv)
                    created += 1
                    await notify(r.get("owner_id"), f"Fatura Zupi {inv['number']} disponível",
                                 f"Período {start.strftime('%d/%m')} a {(end - timedelta(days=1)).strftime('%d/%m')}: R$ {inv['amount']:.2f} — vence em {inv['due_date'][8:10]}/{inv['due_date'][5:7]}.", "invoice")
            start, end = end, period_bounds(period, end)[1]
    if created:
        await db.invoices.update_many({"status": "open", "due_date": {"$lt": today.isoformat()}}, {"$set": {"status": "overdue"}})
    else:
        await db.invoices.update_many({"status": "open", "due_date": {"$lt": today.isoformat()}}, {"$set": {"status": "overdue"}})
    return created


async def current_period(r: dict) -> dict:
    settings = await get_settings()
    period = restaurant_period(r, settings)
    today = datetime.now(TZ).date()
    start, end = period_bounds(period, today)
    summary = await fee_summary(r["id"], start, end)
    return {"period": period, "period_label": PERIOD_LABEL[period], "period_start": start.isoformat(), "period_end": end.isoformat(),
            "closes_in_days": (end - today).days, "due_date": (end + timedelta(days=int(settings.get("billing_due_days", 5)))).isoformat(),
            "platform_fee": settings.get("platform_fee", 2.0), "pix_key": settings.get("billing_pix_key", ""), **summary}


def clean(inv: dict) -> dict:
    inv.pop("_id", None)
    return inv


# ---------------- Lojista ----------------

@router.get("/merchant/billing")
async def merchant_billing(user=Depends(merchant)):
    r = await get_merchant_restaurant(user)
    await close_due_invoices(r["id"])
    invoices = await db.invoices.find({"restaurant_id": r["id"]}, {"_id": 0}).sort("period_start", -1).to_list(60)
    settings = await get_settings()
    return {"current": await current_period(r), "invoices": invoices,
            "billing_blocked": bool(r.get("billing_blocked")), "block_days": settings.get("billing_block_days", 7),
            "open_total": round(sum(i["amount"] for i in invoices if i["status"] in ("open", "overdue")), 2),
            "pix_key": settings.get("billing_pix_key", ""), "pix_name": settings.get("billing_pix_name", settings.get("platform_name", "Zupi Delivery"))}


@router.get("/merchant/billing/{iid}")
async def merchant_invoice(iid: str, user=Depends(merchant)):
    r = await get_merchant_restaurant(user)
    inv = await db.invoices.find_one({"id": iid, "restaurant_id": r["id"]}, {"_id": 0})
    if not inv:
        raise HTTPException(404, "Fatura não encontrada")
    s, e = iso_range(date.fromisoformat(inv["period_start"]), date.fromisoformat(inv["period_end"]))
    txs = await db.transactions.find({"restaurant_id": r["id"], "created_at": {"$gte": s, "$lt": e}}, {"_id": 0}).sort("created_at", 1).to_list(5000)
    settings = await get_settings()
    return {**inv, "transactions": txs, "pix_key": settings.get("billing_pix_key", ""), "pix_name": settings.get("billing_pix_name", settings.get("platform_name", "Zupi Delivery"))}


# ---------------- Admin ----------------

@router.get("/admin/billing")
async def admin_billing(status: str | None = None, user=Depends(admin)):
    await close_due_invoices()
    await enforce_billing_blocks()
    filt = {"status": status} if status else {}
    invoices = await db.invoices.find(filt, {"_id": 0}).sort([("status", 1), ("due_date", 1)]).to_list(500)
    allinv = await db.invoices.find({}, {"_id": 0, "status": 1, "amount": 1}).to_list(5000)
    totals = {s: round(sum(i["amount"] for i in allinv if i["status"] == s), 2) for s in ("open", "overdue", "paid")}
    settings = await get_settings()
    restaurants = await db.restaurants.find({"status": "active"}, {"_id": 0, "id": 1, "name": 1, "city": 1, "billing_period": 1, "billing_blocked": 1}).sort("name", 1).to_list(500)
    for r in restaurants:
        r["billing_period"] = r.get("billing_period") or settings.get("billing_period", "monthly")
    return {"invoices": invoices, "totals": totals, "counts": {s: len([i for i in allinv if i["status"] == s]) for s in ("open", "overdue", "paid")},
            "restaurants": restaurants, "default_period": settings.get("billing_period", "monthly"), "due_days": settings.get("billing_due_days", 5),
            "block_days": settings.get("billing_block_days", 7), "blocked_count": len([r for r in restaurants if r.get("billing_blocked")]),
            "pix_key": settings.get("billing_pix_key", ""), "pix_name": settings.get("billing_pix_name", "")}


@router.post("/admin/billing/generate")
async def admin_generate(user=Depends(admin)):
    n = await close_due_invoices()
    return {"created": n}


class PayIn(BaseModel):
    payment_note: str = ""


@router.post("/admin/billing/{iid}/pay")
async def admin_mark_paid(iid: str, data: PayIn, user=Depends(admin)):
    inv = await db.invoices.find_one({"id": iid})
    if not inv:
        raise HTTPException(404, "Fatura não encontrada")
    await db.invoices.update_one({"id": iid}, {"$set": {"status": "paid", "paid_at": now_iso(), "payment_note": data.payment_note}})
    await enforce_billing_blocks()
    r = await db.restaurants.find_one({"id": inv["restaurant_id"]}, {"_id": 0, "owner_id": 1})
    await notify(r.get("owner_id") if r else None, f"Pagamento da fatura {inv['number']} confirmado", "Obrigado! Sua fatura Zupi foi marcada como paga.", "invoice")
    await audit(user["id"], "pay", "invoice", iid, before={"status": inv["status"]}, after={"status": "paid"})
    return clean(await db.invoices.find_one({"id": iid}))


@router.post("/admin/billing/{iid}/reopen")
async def admin_reopen(iid: str, user=Depends(admin)):
    inv = await db.invoices.find_one({"id": iid})
    if not inv:
        raise HTTPException(404, "Fatura não encontrada")
    today = datetime.now(TZ).date().isoformat()
    await db.invoices.update_one({"id": iid}, {"$set": {"status": "overdue" if inv["due_date"] < today else "open", "paid_at": None}})
    return clean(await db.invoices.find_one({"id": iid}))


class PeriodIn(BaseModel):
    billing_period: str = Field(pattern="^(weekly|biweekly|monthly)$")


@router.put("/admin/billing/restaurants/{rid}/period")
async def admin_set_period(rid: str, data: PeriodIn, user=Depends(admin)):
    res = await db.restaurants.update_one({"id": rid}, {"$set": {"billing_period": data.billing_period, "billing_start": datetime.now(TZ).date().isoformat()}})
    if not res.matched_count:
        raise HTTPException(404, "Restaurante não encontrado")
    return {"billing_period": data.billing_period}


class BillingSettingsIn(BaseModel):
    billing_period: str = Field(pattern="^(weekly|biweekly|monthly)$")
    billing_due_days: int = Field(ge=1, le=30)
    billing_block_days: int = Field(default=7, ge=1, le=60)
    billing_pix_key: str = ""
    billing_pix_name: str = ""


@router.put("/admin/billing/settings")
async def admin_billing_settings(data: BillingSettingsIn, user=Depends(admin)):
    await db.settings.update_one({"id": "platform"}, {"$set": data.model_dump()}, upsert=True)
    return await get_settings()


# ---------------- Cron: lembrete de vencimento ----------------

async def enforce_billing_blocks() -> dict:
    """Pausa lojas com fatura vencida há mais de N dias; libera quando quitadas."""
    settings = await get_settings()
    grace = int(settings.get("billing_block_days", 7))
    today = datetime.now(TZ).date()
    limit = (today - timedelta(days=grace)).isoformat()
    blocked = unblocked = 0
    overdue_rids = set(await db.invoices.distinct("restaurant_id", {"status": "overdue", "due_date": {"$lt": limit}}))
    for rid in overdue_rids:
        r = await db.restaurants.find_one({"id": rid}, {"_id": 0, "owner_id": 1, "billing_blocked": 1, "name": 1})
        if not r or r.get("billing_blocked"):
            continue
        await db.restaurants.update_one({"id": rid}, {"$set": {"paused": True, "billing_blocked": True, "billing_blocked_at": now_iso()}})
        await notify(r.get("owner_id"), "Loja pausada por fatura em atraso",
                     f"Sua fatura Zupi está vencida há mais de {grace} dias. Pague via Pix para reativar a loja automaticamente.", "invoice")
        await audit("system", "billing_block", "restaurant", rid, after={"grace_days": grace})
        blocked += 1
    async for r in db.restaurants.find({"billing_blocked": True, "id": {"$nin": list(overdue_rids)}}, {"_id": 0, "id": 1, "owner_id": 1}):
        await db.restaurants.update_one({"id": r["id"]}, {"$set": {"paused": False, "billing_blocked": False}, "$unset": {"billing_blocked_at": ""}})
        await notify(r.get("owner_id"), "Loja reativada", "Pagamento confirmado — sua loja voltou a receber pedidos na Zupi.", "invoice")
        await audit("system", "billing_unblock", "restaurant", r["id"])
        unblocked += 1
    return {"blocked": blocked, "unblocked": unblocked}


async def send_invoice_reminders() -> dict:
    await close_due_invoices()
    await enforce_billing_blocks()
    today = datetime.now(TZ).date()
    target = (today + timedelta(days=2)).isoformat()
    sent = 0
    async for inv in db.invoices.find({"status": {"$in": ["open", "overdue"]}, "reminder_sent": {"$ne": True}, "due_date": {"$lte": target}}):
        r = await db.restaurants.find_one({"id": inv["restaurant_id"]}, {"_id": 0, "owner_id": 1})
        if r and r.get("owner_id"):
            venc = inv["due_date"][8:10] + "/" + inv["due_date"][5:7]
            late = inv["due_date"] < today.isoformat()
            await notify(r["owner_id"],
                         f"Fatura Zupi {inv['number']} {'vencida' if late else 'vence em ' + venc}",
                         f"Valor R$ {inv['amount']:.2f}. {'Regularize para manter sua loja ativa.' if late else 'Pague via Pix e mantenha sua loja em dia.'}", "invoice")
            sent += 1
        await db.invoices.update_one({"_id": inv["_id"]}, {"$set": {"reminder_sent": True, "reminder_at": now_iso()}})
    return {"sent": sent}


@router.post("/cron/invoice-reminders")
async def cron_invoice_reminders(request: Request, background_tasks: BackgroundTasks):
    # Cron endpoints must ack 2xx immediately; enqueue/background the actual work.
    auth = request.headers.get("Authorization", "")
    secret = os.environ.get("WEBHOOK_CRON_SECRET", "")
    if not auth.startswith("Bearer ") or not secret or not hmac.compare_digest(auth[7:], secret):
        raise HTTPException(401, "Não autorizado")
    run_id = request.headers.get("X-Webhook-Id") or uid()
    if await db.cron_runs.find_one({"run_id": run_id}):
        return {"status": "duplicate"}
    await db.cron_runs.insert_one({"run_id": run_id, "job": "invoice-reminders", "at": now_iso()})
    background_tasks.add_task(send_invoice_reminders)
    return {"status": "accepted", "run_id": run_id}
