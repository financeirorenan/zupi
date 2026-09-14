from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field

from database import db
from security import require_roles
from utils import (
    uid, now_iso, notify, audit, can_transition, get_settings, STATUS_LABELS,
)
from utils import TZ

router = APIRouter(prefix="/api/merchant", tags=["merchant"])
merchant = require_roles("restaurant")


async def get_merchant_restaurant(user: dict) -> dict:
    r = await db.restaurants.find_one({"owner_id": user["id"]}, {"_id": 0})
    if not r:
        raise HTTPException(404, "Restaurante não cadastrado")
    return r


class RestaurantUpsert(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    description: str = ""
    category: str = "Outros"
    phone: str = ""
    logo: str = ""
    cover: str = ""
    city: str
    state: str = "SP"
    address: dict = {}
    delivery_fee: float = 0
    min_order: float = 0
    prep_time: int = 40
    payment_methods: list[str] = ["pix", "cash", "card_machine"]
    delivery_zones: list[dict] = []
    hours: dict = {}


@router.get("/restaurant")
async def get_my_restaurant(user=Depends(merchant)):
    return await get_merchant_restaurant(user)


@router.post("/restaurant")
async def create_restaurant(data: RestaurantUpsert, user=Depends(merchant)):
    existing = await db.restaurants.find_one({"owner_id": user["id"]})
    if existing:
        raise HTTPException(409, "Você já possui um restaurante cadastrado")
    doc = {
        "id": uid(), "owner_id": user["id"], **data.model_dump(),
        "status": "pending", "featured": False, "paused": True,
        "rating": 0, "rating_count": 0, "order_count": 0, "created_at": now_iso(),
    }
    await db.restaurants.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.put("/restaurant")
async def update_restaurant(data: RestaurantUpsert, user=Depends(merchant)):
    r = await get_merchant_restaurant(user)
    await db.restaurants.update_one({"id": r["id"]}, {"$set": data.model_dump()})
    return await db.restaurants.find_one({"id": r["id"]}, {"_id": 0})


class PauseIn(BaseModel):
    paused: bool


@router.post("/pause")
async def pause_restaurant(data: PauseIn, user=Depends(merchant)):
    r = await get_merchant_restaurant(user)
    await db.restaurants.update_one({"id": r["id"]}, {"$set": {"paused": data.paused}})
    return {"paused": data.paused}


@router.get("/dashboard")
async def dashboard(days: int = 1, user=Depends(merchant)):
    r = await get_merchant_restaurant(user)
    days = min(max(days, 1), 90)
    since = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    orders = await db.orders.find(
        {"restaurant_id": r["id"], "created_at": {"$gte": since}}, {"_id": 0}
    ).to_list(20000)
    valid = [o for o in orders if o["status"] != "CANCELLED"]
    cancelled = [o for o in orders if o["status"] == "CANCELLED"]
    gross = round(sum(o["subtotal"] for o in valid), 2)
    discounts = round(sum(o.get("discount", 0) for o in valid), 2)
    fees = round(sum(o.get("zupi_fee", 0) for o in valid), 2)
    delivery_fees = round(sum(o.get("delivery_fee", 0) for o in valid), 2)
    in_progress = await db.orders.count_documents(
        {"restaurant_id": r["id"], "status": {"$in": ["PENDING", "ACCEPTED", "PREPARING", "READY", "OUT_FOR_DELIVERY"]}}
    )
    product_count: dict = {}
    hour_count: dict = {}
    for o in valid:
        for it in o["items"]:
            product_count[it["name"]] = product_count.get(it["name"], 0) + it["qty"]
        try:
            h = datetime.fromisoformat(o["created_at"]).astimezone(TZ).hour
            hour_count[h] = hour_count.get(h, 0) + 1
        except Exception:
            pass
    top_products = sorted(({"name": k, "qty": v} for k, v in product_count.items()), key=lambda x: -x["qty"])[:5]
    by_hour = [{"hour": h, "orders": hour_count.get(h, 0)} for h in range(8, 24)]
    return {
        "period_days": days,
        "gross": gross, "discounts": discounts, "delivery_fees": delivery_fees,
        "zupi_fees": fees, "net": round(gross - discounts + delivery_fees - fees, 2),
        "orders": len(valid), "cancelled": len(cancelled), "in_progress": in_progress,
        "ticket_avg": round(gross / len(valid), 2) if valid else 0,
        "rating": r.get("rating", 0), "rating_count": r.get("rating_count", 0),
        "top_products": top_products, "by_hour": by_hour,
    }


@router.get("/orders")
async def merchant_orders(status: str | None = None, user=Depends(merchant)):
    r = await get_merchant_restaurant(user)
    filt = {"restaurant_id": r["id"]}
    if status:
        filt["status"] = status
    return await db.orders.find(filt, {"_id": 0}).sort("created_at", -1).to_list(300)


class StatusIn(BaseModel):
    status: str
    prep_time: int | None = None


@router.post("/orders/{oid}/status")
async def set_order_status(oid: str, data: StatusIn, user=Depends(merchant)):
    r = await get_merchant_restaurant(user)
    o = await db.orders.find_one({"id": oid, "restaurant_id": r["id"]}, {"_id": 0})
    if not o:
        raise HTTPException(404, "Pedido não encontrado")
    if not can_transition(o["status"], data.status, "restaurant"):
        raise HTTPException(400, f"Não é possível mudar de {STATUS_LABELS.get(o['status'])} para {STATUS_LABELS.get(data.status, data.status)}")
    updates = {"status": data.status}
    if data.prep_time:
        updates["prep_time"] = data.prep_time
    await db.orders.update_one(
        {"id": oid},
        {"$set": updates, "$push": {"status_history": {"status": data.status, "at": now_iso(), "by": "restaurant"}}},
    )
    if data.status == "CANCELLED":
        await db.transactions.insert_one({
            "id": uid(), "type": "zupi_fee_reversal", "amount": -o["zupi_fee"], "order_id": oid,
            "restaurant_id": r["id"], "description": f"Estorno taxa Zupi pedido {o['code']}", "created_at": now_iso(),
        })
    await notify(o["customer_id"], f"Pedido {o['code']}: {STATUS_LABELS.get(data.status, data.status)}",
                 f"{r['name']} atualizou seu pedido.", "order", oid)
    return {"message": "ok", "status": data.status}


class MenuCategoryIn(BaseModel):
    name: str = Field(min_length=2, max_length=60)
    order: int = 0


@router.get("/menu/categories")
async def list_menu_categories(user=Depends(merchant)):
    r = await get_merchant_restaurant(user)
    return await db.menu_categories.find({"restaurant_id": r["id"]}, {"_id": 0}).sort("order", 1).to_list(100)


@router.post("/menu/categories")
async def create_menu_category(data: MenuCategoryIn, user=Depends(merchant)):
    r = await get_merchant_restaurant(user)
    doc = {"id": uid(), "restaurant_id": r["id"], **data.model_dump(), "created_at": now_iso()}
    await db.menu_categories.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.put("/menu/categories/{cid}")
async def update_menu_category(cid: str, data: MenuCategoryIn, user=Depends(merchant)):
    r = await get_merchant_restaurant(user)
    await db.menu_categories.update_one({"id": cid, "restaurant_id": r["id"]}, {"$set": data.model_dump()})
    return await db.menu_categories.find_one({"id": cid}, {"_id": 0})


@router.delete("/menu/categories/{cid}")
async def delete_menu_category(cid: str, user=Depends(merchant)):
    r = await get_merchant_restaurant(user)
    await db.products.delete_many({"category_id": cid, "restaurant_id": r["id"]})
    await db.menu_categories.delete_one({"id": cid, "restaurant_id": r["id"]})
    return {"message": "ok"}


class ProductIn(BaseModel):
    category_id: str
    name: str = Field(min_length=2, max_length=100)
    description: str = ""
    price: float = Field(ge=0)
    promo_price: float | None = None
    image: str = ""
    available: bool = True
    addons: list[dict] = []
    order: int = 0


def _clean_addons(addons: list[dict]) -> list[dict]:
    clean = []
    for a in addons:
        name = str(a.get("name", "")).strip()
        if not name:
            continue
        clean.append({"id": a.get("id") or uid(), "name": name[:60], "price": round(float(a.get("price", 0)), 2)})
    return clean[:20]


@router.get("/menu/products")
async def list_products(user=Depends(merchant)):
    r = await get_merchant_restaurant(user)
    return await db.products.find({"restaurant_id": r["id"]}, {"_id": 0}).sort("order", 1).to_list(500)


@router.post("/menu/products")
async def create_product(data: ProductIn, user=Depends(merchant)):
    r = await get_merchant_restaurant(user)
    payload = data.model_dump()
    payload["addons"] = _clean_addons(payload["addons"])
    doc = {"id": uid(), "restaurant_id": r["id"], **payload, "created_at": now_iso()}
    await db.products.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.put("/menu/products/{pid}")
async def update_product(pid: str, data: ProductIn, user=Depends(merchant)):
    r = await get_merchant_restaurant(user)
    payload = data.model_dump()
    payload["addons"] = _clean_addons(payload["addons"])
    await db.products.update_one({"id": pid, "restaurant_id": r["id"]}, {"$set": payload})
    return await db.products.find_one({"id": pid}, {"_id": 0})


@router.delete("/menu/products/{pid}")
async def delete_product(pid: str, user=Depends(merchant)):
    r = await get_merchant_restaurant(user)
    await db.products.delete_one({"id": pid, "restaurant_id": r["id"]})
    return {"message": "ok"}


@router.post("/menu/products/{pid}/duplicate")
async def duplicate_product(pid: str, user=Depends(merchant)):
    r = await get_merchant_restaurant(user)
    p = await db.products.find_one({"id": pid, "restaurant_id": r["id"]}, {"_id": 0})
    if not p:
        raise HTTPException(404, "Produto não encontrado")
    p["id"] = uid()
    p["name"] = f"{p['name']} (cópia)"
    p["addons"] = _clean_addons(p.get("addons", []))
    p["created_at"] = now_iso()
    await db.products.insert_one(p)
    p.pop("_id", None)
    return p


@router.post("/menu/products/{pid}/toggle")
async def toggle_product(pid: str, user=Depends(merchant)):
    r = await get_merchant_restaurant(user)
    p = await db.products.find_one({"id": pid, "restaurant_id": r["id"]}, {"_id": 0})
    if not p:
        raise HTTPException(404, "Produto não encontrado")
    await db.products.update_one({"id": pid}, {"$set": {"available": not p.get("available", True)}})
    return {"available": not p.get("available", True)}


class CouponIn(BaseModel):
    code: str = Field(min_length=3, max_length=20)
    type: str = "percent"
    value: float = Field(ge=0)
    min_order: float = 0
    max_uses: int | None = None
    valid_until: str | None = None
    first_purchase: bool = False
    active: bool = True


@router.get("/coupons")
async def list_coupons(user=Depends(merchant)):
    r = await get_merchant_restaurant(user)
    return await db.coupons.find({"restaurant_id": r["id"]}, {"_id": 0}).to_list(100)


@router.post("/coupons")
async def create_coupon(data: CouponIn, user=Depends(merchant)):
    r = await get_merchant_restaurant(user)
    code = data.code.upper().strip()
    if await db.coupons.find_one({"code": code}):
        raise HTTPException(409, "Código de cupom já existe")
    doc = {"id": uid(), "restaurant_id": r["id"], **data.model_dump(), "code": code, "used_count": 0, "created_at": now_iso()}
    await db.coupons.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.put("/coupons/{cid}")
async def update_coupon(cid: str, data: CouponIn, user=Depends(merchant)):
    r = await get_merchant_restaurant(user)
    payload = data.model_dump()
    payload["code"] = payload["code"].upper().strip()
    await db.coupons.update_one({"id": cid, "restaurant_id": r["id"]}, {"$set": payload})
    return await db.coupons.find_one({"id": cid}, {"_id": 0})


@router.delete("/coupons/{cid}")
async def delete_coupon(cid: str, user=Depends(merchant)):
    r = await get_merchant_restaurant(user)
    await db.coupons.delete_one({"id": cid, "restaurant_id": r["id"]})
    return {"message": "ok"}


@router.get("/finance")
async def finance(days: int = 30, user=Depends(merchant)):
    r = await get_merchant_restaurant(user)
    days = min(max(days, 1), 365)
    since = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    orders = await db.orders.find({"restaurant_id": r["id"], "created_at": {"$gte": since}}, {"_id": 0}).to_list(20000)
    valid = [o for o in orders if o["status"] != "CANCELLED"]
    txs = await db.transactions.find({"restaurant_id": r["id"], "created_at": {"$gte": since}}, {"_id": 0}).sort("created_at", -1).to_list(500)
    gross = round(sum(o["subtotal"] for o in valid), 2)
    discounts = round(sum(o.get("discount", 0) for o in valid), 2)
    delivery_fees = round(sum(o.get("delivery_fee", 0) for o in valid), 2)
    zupi_fees = round(sum(t["amount"] for t in txs), 2)
    by_day: dict = {}
    for o in valid:
        day = o["created_at"][:10]
        d = by_day.setdefault(day, {"date": day, "orders": 0, "gross": 0.0, "zupi_fee": 0.0})
        d["orders"] += 1
        d["gross"] = round(d["gross"] + o["subtotal"], 2)
        d["zupi_fee"] = round(d["zupi_fee"] + o.get("zupi_fee", 0), 2)
    settings = await get_settings()
    return {
        "period_days": days, "platform_fee": settings.get("platform_fee", 2.0),
        "gross": gross, "discounts": discounts, "delivery_fees": delivery_fees,
        "zupi_fees": zupi_fees, "net": round(gross - discounts + delivery_fees - zupi_fees, 2),
        "orders": len(valid), "by_day": sorted(by_day.values(), key=lambda x: x["date"]),
        "transactions": txs[:100],
    }


@router.get("/reviews")
async def merchant_reviews(user=Depends(merchant)):
    r = await get_merchant_restaurant(user)
    return await db.reviews.find({"restaurant_id": r["id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)


@router.get("/customers")
async def merchant_customers(user=Depends(merchant)):
    r = await get_merchant_restaurant(user)
    pipeline = [
        {"$match": {"restaurant_id": r["id"], "status": {"$ne": "CANCELLED"}}},
        {"$group": {"_id": "$customer_id", "name": {"$last": "$customer_name"}, "phone": {"$last": "$customer_phone"},
                    "orders": {"$sum": 1}, "total": {"$sum": "$total"}, "last_order": {"$max": "$created_at"}}},
        {"$sort": {"total": -1}}, {"$limit": 100},
    ]
    rows = await db.orders.aggregate(pipeline).to_list(100)
    return [{"customer_id": x["_id"], "name": x["name"], "phone": x["phone"], "orders": x["orders"],
             "total": round(x["total"], 2), "last_order": x["last_order"]} for x in rows]
