import secrets
from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field

from database import db
from security import require_roles
from utils import uid, now_iso, can_transition, notify, STATUS_LABELS
from webhooks import CONNECTORS, _post, order_payload, fire
from routers_merchant import get_merchant_restaurant

router = APIRouter(prefix="/api", tags=["open-api"])
merchant = require_roles("restaurant")


async def api_restaurant(x_api_key: str = Header(None, alias="X-API-Key")) -> dict:
    if not x_api_key:
        raise HTTPException(401, "X-API-Key ausente")
    integ = await db.integrations.find_one({"api_key": x_api_key}, {"_id": 0})
    if not integ:
        raise HTTPException(401, "Chave de API inválida")
    r = await db.restaurants.find_one({"id": integ["restaurant_id"]}, {"_id": 0})
    if not r:
        raise HTTPException(404, "Restaurante não encontrado")
    await db.integrations.update_one({"restaurant_id": r["id"]}, {"$set": {"last_api_call": now_iso()}})
    return r


def default_integration(rid: str) -> dict:
    return {
        "restaurant_id": rid, "api_key": "zupi_" + secrets.token_urlsafe(32),
        "webhook": {"url": "", "secret": secrets.token_hex(16), "enabled": False},
        **{c: {"url": "", "token": "", "enabled": False} for c in CONNECTORS},
        "created_at": now_iso(),
    }


async def get_or_create_integration(rid: str) -> dict:
    integ = await db.integrations.find_one({"restaurant_id": rid}, {"_id": 0})
    if not integ:
        integ = default_integration(rid)
        await db.integrations.insert_one(dict(integ))
    return integ


# ---------- Merchant-side configuration ----------

@router.get("/merchant/integrations")
async def get_integrations(user=Depends(merchant)):
    r = await get_merchant_restaurant(user)
    return await get_or_create_integration(r["id"])


@router.post("/merchant/integrations/rotate-key")
async def rotate_key(user=Depends(merchant)):
    r = await get_merchant_restaurant(user)
    await get_or_create_integration(r["id"])
    key = "zupi_" + secrets.token_urlsafe(32)
    await db.integrations.update_one({"restaurant_id": r["id"]}, {"$set": {"api_key": key, "rotated_at": now_iso()}})
    return {"api_key": key}


class ConnectorIn(BaseModel):
    url: str = ""
    token: str = ""
    enabled: bool = False


class WebhookIn(BaseModel):
    url: str = ""
    secret: str = ""
    enabled: bool = False


class IntegrationsIn(BaseModel):
    webhook: WebhookIn
    saipos: ConnectorIn = ConnectorIn()
    takeeat: ConnectorIn = ConnectorIn()
    consumer: ConnectorIn = ConnectorIn()


@router.put("/merchant/integrations")
async def save_integrations(data: IntegrationsIn, user=Depends(merchant)):
    r = await get_merchant_restaurant(user)
    await get_or_create_integration(r["id"])
    await db.integrations.update_one({"restaurant_id": r["id"]}, {"$set": {**data.model_dump(), "updated_at": now_iso()}})
    return await db.integrations.find_one({"restaurant_id": r["id"]}, {"_id": 0})


class TestIn(BaseModel):
    connector: str = "webhook"


@router.post("/merchant/integrations/test")
async def test_integration(data: TestIn, user=Depends(merchant)):
    r = await get_merchant_restaurant(user)
    integ = await get_or_create_integration(r["id"])
    cfg = integ.get(data.connector) or {}
    if not cfg.get("url"):
        raise HTTPException(400, "Configure a URL antes de testar")
    order = await db.orders.find_one({"restaurant_id": r["id"]}, {"_id": 0}, sort=[("created_at", -1)])
    if not order:
        order = {"id": uid(), "code": "#TESTE", "status": "PENDING", "restaurant_id": r["id"], "created_at": now_iso(),
                 "customer_name": "Cliente Teste", "delivery_type": "delivery", "payment_method": "pix",
                 "items": [{"name": "Produto teste", "qty": 1, "unit_price": 10.0}], "subtotal": 10.0, "total": 10.0}
    target = {"name": data.connector, "url": cfg["url"], "secret": integ["webhook"].get("secret", ""), "token": cfg.get("token", "")}
    return await _post(target, order_payload(order, "order.test"), r["id"], "order.test")


@router.get("/merchant/integrations/logs")
async def integration_logs(user=Depends(merchant)):
    r = await get_merchant_restaurant(user)
    return await db.webhook_logs.find({"restaurant_id": r["id"]}, {"_id": 0}).sort("created_at", -1).to_list(50)


# ---------- Public Open API (X-API-Key) ----------

@router.get("/v1/restaurant")
async def v1_restaurant(r=Depends(api_restaurant)):
    return {k: r.get(k) for k in ("id", "name", "city", "status", "paused", "delivery_fee", "min_order", "prep_time", "delivery_zones", "payment_methods")}


class V1Pause(BaseModel):
    paused: bool


@router.post("/v1/restaurant/pause")
async def v1_pause(data: V1Pause, r=Depends(api_restaurant)):
    await db.restaurants.update_one({"id": r["id"]}, {"$set": {"paused": data.paused}})
    return {"paused": data.paused}


@router.get("/v1/orders")
async def v1_orders(status: str | None = None, since: str | None = None, limit: int = 50, r=Depends(api_restaurant)):
    filt: dict = {"restaurant_id": r["id"]}
    if status:
        filt["status"] = status
    if since:
        filt["created_at"] = {"$gte": since}
    orders = await db.orders.find(filt, {"_id": 0}).sort("created_at", -1).to_list(min(max(limit, 1), 200))
    return [order_payload(o, "order.read")["order"] for o in orders]


@router.get("/v1/orders/{oid}")
async def v1_order(oid: str, r=Depends(api_restaurant)):
    o = await db.orders.find_one({"id": oid, "restaurant_id": r["id"]}, {"_id": 0})
    if not o:
        raise HTTPException(404, "Pedido não encontrado")
    return order_payload(o, "order.read")["order"]


class V1Status(BaseModel):
    status: str
    prep_time: int | None = None


@router.post("/v1/orders/{oid}/status")
async def v1_status(oid: str, data: V1Status, r=Depends(api_restaurant)):
    o = await db.orders.find_one({"id": oid, "restaurant_id": r["id"]}, {"_id": 0})
    if not o:
        raise HTTPException(404, "Pedido não encontrado")
    if not can_transition(o["status"], data.status, "restaurant"):
        raise HTTPException(400, f"Transição inválida: {o['status']} -> {data.status}")
    updates = {"status": data.status}
    if data.prep_time:
        updates["prep_time"] = data.prep_time
    await db.orders.update_one({"id": oid}, {"$set": updates, "$push": {"status_history": {"status": data.status, "at": now_iso(), "by": "pdv"}}})
    if data.status == "CANCELLED":
        await db.transactions.insert_one({"id": uid(), "type": "zupi_fee_reversal", "amount": -o["zupi_fee"], "order_id": oid,
                                          "restaurant_id": r["id"], "description": f"Estorno taxa Zupi pedido {o['code']}", "created_at": now_iso()})
    await notify(o["customer_id"], f"Pedido {o['code']}: {STATUS_LABELS.get(data.status, data.status)}", f"{r['name']} atualizou seu pedido.", "order", oid)
    o.update(updates)
    fire(o, "order.status_changed")
    return {"id": oid, "status": data.status}


@router.get("/v1/menu")
async def v1_menu(r=Depends(api_restaurant)):
    cats = await db.menu_categories.find({"restaurant_id": r["id"]}, {"_id": 0}).sort("order", 1).to_list(200)
    prods = await db.products.find({"restaurant_id": r["id"]}, {"_id": 0}).to_list(2000)
    return {"categories": cats, "products": prods}


class V1Product(BaseModel):
    price: float | None = Field(default=None, ge=0)
    promo_price: float | None = None
    available: bool | None = None
    external_id: str | None = None


@router.patch("/v1/menu/products/{pid}")
async def v1_product(pid: str, data: V1Product, r=Depends(api_restaurant)):
    updates = {k: v for k, v in data.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(400, "Nada para atualizar")
    res = await db.products.update_one({"id": pid, "restaurant_id": r["id"]}, {"$set": updates})
    if not res.matched_count:
        raise HTTPException(404, "Produto não encontrado")
    return await db.products.find_one({"id": pid}, {"_id": 0})


# ---------- Leads (site institucional) ----------

class LeadIn(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    business: str = ""
    city: str = Field(min_length=2, max_length=60)
    phone: str = Field(min_length=8, max_length=20)
    email: str = ""
    message: str = ""


@router.post("/leads")
async def create_lead(data: LeadIn):
    doc = {"id": uid(), **data.model_dump(), "status": "new", "created_at": now_iso()}
    await db.leads.insert_one(doc)
    doc.pop("_id", None)
    return {"message": "ok", "id": doc["id"]}


@router.get("/admin/leads")
async def admin_leads(user=Depends(require_roles("admin"))):
    return await db.leads.find({}, {"_id": 0}).sort("created_at", -1).to_list(200)


class LeadStatusIn(BaseModel):
    status: str = Field(pattern="^(new|contacted|closed)$")
    notes: str = ""


@router.patch("/admin/leads/{lid}")
async def admin_lead_status(lid: str, data: LeadStatusIn, user=Depends(require_roles("admin"))):
    res = await db.leads.update_one({"id": lid}, {"$set": {**data.model_dump(), "updated_at": now_iso()}})
    if not res.matched_count:
        raise HTTPException(404, "Lead não encontrado")
    return await db.leads.find_one({"id": lid}, {"_id": 0})
