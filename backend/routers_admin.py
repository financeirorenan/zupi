from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException, Depends, Response
from pydantic import BaseModel, Field

from database import db
from security import require_roles, hash_password, set_auth_cookies, public_user
from utils import uid, now_iso, audit, can_transition, notify, STATUS_LABELS

router = APIRouter(prefix="/api/admin", tags=["admin"])
admin = require_roles("admin")


@router.get("/dashboard")
async def admin_dashboard(user=Depends(admin)):
    orders = await db.orders.find({}, {"_id": 0}).to_list(50000)
    valid = [o for o in orders if o["status"] != "CANCELLED"]
    gmv = round(sum(o["total"] for o in valid), 2)
    tx_agg = await db.transactions.aggregate([{"$group": {"_id": None, "total": {"$sum": "$amount"}}}]).to_list(1)
    zupi_revenue = round(tx_agg[0]["total"], 2) if tx_agg else 0
    users_count = await db.users.count_documents({"role": "customer"})
    restaurants_count = await db.restaurants.count_documents({})
    active_restaurants = await db.restaurants.count_documents({"status": "active"})
    pending_restaurants = await db.restaurants.count_documents({"status": "pending"})
    cities_count = await db.cities.count_documents({"active": True})
    in_progress = [o for o in orders if o["status"] in ("PENDING", "ACCEPTED", "PREPARING", "READY", "OUT_FOR_DELIVERY")]
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    today_orders = [o for o in valid if o["created_at"][:10] == today]
    by_day: dict = {}
    for i in range(13, -1, -1):
        d = (datetime.now(timezone.utc) - timedelta(days=i)).strftime("%Y-%m-%d")
        by_day[d] = {"date": d[5:], "orders": 0, "gmv": 0.0}
    for o in valid:
        d = o["created_at"][:10]
        if d in by_day:
            by_day[d]["orders"] += 1
            by_day[d]["gmv"] = round(by_day[d]["gmv"] + o["total"], 2)
    rest_gmv: dict = {}
    city_gmv: dict = {}
    for o in valid:
        rg = rest_gmv.setdefault(o["restaurant_id"], {"name": o["restaurant_name"], "orders": 0, "gmv": 0.0})
        rg["orders"] += 1
        rg["gmv"] = round(rg["gmv"] + o["total"], 2)
        cg = city_gmv.setdefault(o.get("city", "—"), {"city": o.get("city", "—"), "orders": 0, "gmv": 0.0})
        cg["orders"] += 1
        cg["gmv"] = round(cg["gmv"] + o["total"], 2)
    return {
        "gmv": gmv, "zupi_revenue": zupi_revenue,
        "orders": len(valid), "cancelled": len(orders) - len(valid),
        "cancel_rate": round((len(orders) - len(valid)) / len(orders) * 100, 1) if orders else 0,
        "ticket_avg": round(gmv / len(valid), 2) if valid else 0,
        "users": users_count, "restaurants": restaurants_count,
        "active_restaurants": active_restaurants, "pending_restaurants": pending_restaurants,
        "cities": cities_count, "in_progress": len(in_progress),
        "today": {"orders": len(today_orders), "gmv": round(sum(o["total"] for o in today_orders), 2),
                  "revenue": round(sum(o.get("zupi_fee", 0) for o in today_orders), 2)},
        "by_day": list(by_day.values()),
        "top_restaurants": sorted(rest_gmv.values(), key=lambda x: -x["gmv"])[:8],
        "by_city": sorted(city_gmv.values(), key=lambda x: -x["gmv"]),
    }


class AdminRestaurantIn(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    owner_email: str
    owner_password: str = Field(min_length=6)
    owner_name: str = ""
    category: str = "Outros"
    city: str
    state: str = "SP"
    phone: str = ""
    delivery_fee: float = 0
    min_order: float = 0
    prep_time: int = 40


@router.get("/restaurants")
async def admin_restaurants(status: str | None = None, user=Depends(admin)):
    filt = {"status": status} if status else {}
    return await db.restaurants.find(filt, {"_id": 0}).sort("created_at", -1).to_list(500)


@router.post("/restaurants")
async def admin_create_restaurant(data: AdminRestaurantIn, user=Depends(admin)):
    email = data.owner_email.lower().strip()
    owner = await db.users.find_one({"email": email})
    if not owner:
        owner = {
            "id": uid(), "name": data.owner_name or data.name, "email": email,
            "password_hash": hash_password(data.owner_password), "phone": data.phone,
            "role": "restaurant", "blocked": False, "token_version": 0, "created_at": now_iso(),
        }
        await db.users.insert_one(owner)
    doc = {
        "id": uid(), "owner_id": owner["id"], "name": data.name, "description": "",
        "category": data.category, "phone": data.phone, "logo": "", "cover": "",
        "city": data.city, "state": data.state, "address": {},
        "delivery_fee": data.delivery_fee, "min_order": data.min_order, "prep_time": data.prep_time,
        "payment_methods": ["pix", "cash", "card_machine"], "delivery_zones": [], "hours": {},
        "status": "active", "featured": False, "paused": False,
        "rating": 0, "rating_count": 0, "order_count": 0, "created_at": now_iso(),
    }
    await db.restaurants.insert_one(doc)
    doc.pop("_id", None)
    await audit(user["id"], "create", "restaurant", doc["id"], after={"name": data.name})
    return doc


class AdminRestaurantUpdate(BaseModel):
    name: str | None = None
    category: str | None = None
    delivery_fee: float | None = None
    min_order: float | None = None
    prep_time: int | None = None
    featured: bool | None = None
    phone: str | None = None
    description: str | None = None


@router.put("/restaurants/{rid}")
async def admin_update_restaurant(rid: str, data: AdminRestaurantUpdate, user=Depends(admin)):
    before = await db.restaurants.find_one({"id": rid}, {"_id": 0})
    if not before:
        raise HTTPException(404, "Restaurante não encontrado")
    updates = {k: v for k, v in data.model_dump().items() if v is not None}
    await db.restaurants.update_one({"id": rid}, {"$set": updates})
    await audit(user["id"], "update", "restaurant", rid, before={k: before.get(k) for k in updates}, after=updates)
    return await db.restaurants.find_one({"id": rid}, {"_id": 0})


@router.post("/restaurants/{rid}/approve")
async def approve_restaurant(rid: str, user=Depends(admin)):
    r = await db.restaurants.find_one_and_update({"id": rid}, {"$set": {"status": "active", "paused": False}}, return_document=True)
    if not r:
        raise HTTPException(404, "Restaurante não encontrado")
    await audit(user["id"], "approve", "restaurant", rid, before={"status": r.get("status")}, after={"status": "active"})
    await notify(r["owner_id"], "Restaurante aprovado!", f"{r['name']} já está visível no Zupi Delivery.", "system")
    return {"message": "ok"}


@router.post("/restaurants/{rid}/block")
async def block_restaurant(rid: str, user=Depends(admin)):
    r = await db.restaurants.find_one({"id": rid}, {"_id": 0})
    if not r:
        raise HTTPException(404, "Restaurante não encontrado")
    new = "blocked" if r.get("status") != "blocked" else "active"
    await db.restaurants.update_one({"id": rid}, {"$set": {"status": new}})
    await audit(user["id"], "block" if new == "blocked" else "unblock", "restaurant", rid, before={"status": r.get("status")}, after={"status": new})
    return {"status": new}


@router.post("/restaurants/{rid}/impersonate")
async def impersonate_merchant(rid: str, response: Response, user=Depends(admin)):
    r = await db.restaurants.find_one({"id": rid}, {"_id": 0})
    if not r:
        raise HTTPException(404, "Restaurante não encontrado")
    owner = await db.users.find_one({"id": r.get("owner_id")})
    if not owner:
        raise HTTPException(404, "Lojista dono do restaurante não encontrado")
    set_auth_cookies(response, owner, impersonated_by=user["id"])
    await audit(user["id"], "impersonate", "restaurant", rid, after={"owner_id": owner["id"]})
    u = public_user(owner)
    u["impersonated_by"] = user["id"]
    return u


@router.get("/users")
async def admin_users(role: str | None = None, user=Depends(admin)):
    filt = {"role": role} if role else {}
    return await db.users.find(filt, {"_id": 0, "password_hash": 0}).sort("created_at", -1).to_list(1000)


@router.post("/users/{uid_}/block")
async def block_user(uid_: str, user=Depends(admin)):
    target = await db.users.find_one({"id": uid_}, {"_id": 0, "password_hash": 0})
    if not target:
        raise HTTPException(404, "Usuário não encontrado")
    if target["role"] == "admin":
        raise HTTPException(400, "Não é possível bloquear um administrador")
    new = not target.get("blocked", False)
    await db.users.update_one({"id": uid_}, {"$set": {"blocked": new}})
    await audit(user["id"], "block" if new else "unblock", "user", uid_, before={"blocked": target.get("blocked")}, after={"blocked": new})
    return {"blocked": new}


class CityIn(BaseModel):
    name: str = Field(min_length=2, max_length=60)
    state: str = "SP"
    active: bool = True


@router.get("/cities")
async def admin_cities(user=Depends(admin)):
    cities = await db.cities.find({}, {"_id": 0}).sort("name", 1).to_list(500)
    for c in cities:
        c["restaurants"] = await db.restaurants.count_documents({"city": c["name"]})
    return cities


@router.post("/cities")
async def create_city(data: CityIn, user=Depends(admin)):
    doc = {"id": uid(), **data.model_dump(), "created_at": now_iso()}
    await db.cities.insert_one(doc)
    doc.pop("_id", None)
    await audit(user["id"], "create", "city", doc["id"], after={"name": data.name})
    return doc


@router.put("/cities/{cid}")
async def update_city(cid: str, data: CityIn, user=Depends(admin)):
    await db.cities.update_one({"id": cid}, {"$set": data.model_dump()})
    return await db.cities.find_one({"id": cid}, {"_id": 0})


class CategoryIn(BaseModel):
    name: str = Field(min_length=2, max_length=40)
    icon: str = "utensils"
    image: str = ""
    order: int = 0
    active: bool = True


@router.get("/categories")
async def admin_categories(user=Depends(admin)):
    return await db.categories.find({}, {"_id": 0}).sort("order", 1).to_list(100)


@router.post("/categories")
async def create_category(data: CategoryIn, user=Depends(admin)):
    doc = {"id": uid(), **data.model_dump(), "created_at": now_iso()}
    await db.categories.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.put("/categories/{cid}")
async def update_category(cid: str, data: CategoryIn, user=Depends(admin)):
    await db.categories.update_one({"id": cid}, {"$set": data.model_dump()})
    return await db.categories.find_one({"id": cid}, {"_id": 0})


@router.delete("/categories/{cid}")
async def delete_category(cid: str, user=Depends(admin)):
    await db.categories.delete_one({"id": cid})
    return {"message": "ok"}


class AdminCouponIn(BaseModel):
    code: str = Field(min_length=3, max_length=20)
    type: str = "percent"
    value: float = Field(ge=0)
    min_order: float = 0
    city: str = ""
    max_uses: int | None = None
    valid_until: str | None = None
    first_purchase: bool = False
    active: bool = True


@router.get("/coupons")
async def admin_coupons(user=Depends(admin)):
    return await db.coupons.find({}, {"_id": 0}).to_list(200)


@router.post("/coupons")
async def admin_create_coupon(data: AdminCouponIn, user=Depends(admin)):
    code = data.code.upper().strip()
    if await db.coupons.find_one({"code": code}):
        raise HTTPException(409, "Código já existe")
    doc = {"id": uid(), "restaurant_id": None, **data.model_dump(), "code": code, "used_count": 0, "created_at": now_iso()}
    await db.coupons.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.delete("/coupons/{cid}")
async def admin_delete_coupon(cid: str, user=Depends(admin)):
    await db.coupons.delete_one({"id": cid})
    return {"message": "ok"}


class BannerIn(BaseModel):
    title: str = Field(min_length=2, max_length=80)
    subtitle: str = ""
    image: str = ""
    link: str = ""
    city: str = ""
    position: int = 0
    start_date: str | None = None
    end_date: str | None = None
    active: bool = True


@router.get("/banners")
async def admin_banners(user=Depends(admin)):
    return await db.banners.find({}, {"_id": 0}).sort("position", 1).to_list(100)


@router.post("/banners")
async def create_banner(data: BannerIn, user=Depends(admin)):
    doc = {"id": uid(), **data.model_dump(), "created_at": now_iso()}
    await db.banners.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.put("/banners/{bid}")
async def update_banner(bid: str, data: BannerIn, user=Depends(admin)):
    await db.banners.update_one({"id": bid}, {"$set": data.model_dump()})
    return await db.banners.find_one({"id": bid}, {"_id": 0})


@router.delete("/banners/{bid}")
async def delete_banner(bid: str, user=Depends(admin)):
    await db.banners.delete_one({"id": bid})
    return {"message": "ok"}


@router.get("/orders")
async def admin_orders(status: str | None = None, user=Depends(admin)):
    filt = {"status": status} if status else {}
    return await db.orders.find(filt, {"_id": 0}).sort("created_at", -1).to_list(500)


class AdminStatusIn(BaseModel):
    status: str


@router.post("/orders/{oid}/status")
async def admin_set_status(oid: str, data: AdminStatusIn, user=Depends(admin)):
    o = await db.orders.find_one({"id": oid}, {"_id": 0})
    if not o:
        raise HTTPException(404, "Pedido não encontrado")
    if not can_transition(o["status"], data.status, "admin"):
        raise HTTPException(400, "Transição de status inválida")
    await db.orders.update_one(
        {"id": oid},
        {"$set": {"status": data.status}, "$push": {"status_history": {"status": data.status, "at": now_iso(), "by": "admin"}}},
    )
    await audit(user["id"], "status_change", "order", oid, before={"status": o["status"]}, after={"status": data.status})
    if data.status == "CANCELLED":
        await db.transactions.insert_one({
            "id": uid(), "type": "zupi_fee_reversal", "amount": -o["zupi_fee"], "order_id": oid,
            "restaurant_id": o["restaurant_id"], "description": f"Estorno taxa Zupi pedido {o['code']}", "created_at": now_iso(),
        })
    await notify(o["customer_id"], f"Pedido {o['code']}: {STATUS_LABELS.get(data.status, data.status)}", "Atualização feita pelo suporte Zupi.", "order", oid)
    return {"message": "ok"}


@router.get("/finance")
async def admin_finance(user=Depends(admin)):
    txs = await db.transactions.find({}, {"_id": 0}).sort("created_at", -1).to_list(2000)
    total = round(sum(t["amount"] for t in txs), 2)
    by_rest: dict = {}
    for t in txs:
        d = by_rest.setdefault(t["restaurant_id"], {"restaurant_id": t["restaurant_id"], "amount": 0.0, "count": 0})
        d["amount"] = round(d["amount"] + t["amount"], 2)
        if t["amount"] > 0:
            d["count"] += 1
    rests = await db.restaurants.find({}, {"_id": 0, "id": 1, "name": 1}).to_list(500)
    names = {r["id"]: r["name"] for r in rests}
    rows = [{"restaurant": names.get(k, "—"), **v} for k, v in by_rest.items()]
    return {"zupi_revenue": total, "transactions": txs[:200], "by_restaurant": sorted(rows, key=lambda x: -x["amount"])}


@router.get("/reviews")
async def admin_reviews(user=Depends(admin)):
    return await db.reviews.find({}, {"_id": 0}).sort("created_at", -1).to_list(200)


@router.post("/reviews/{rid}/moderate")
async def moderate_review(rid: str, user=Depends(admin)):
    rv = await db.reviews.find_one({"id": rid}, {"_id": 0})
    if not rv:
        raise HTTPException(404, "Avaliação não encontrada")
    await db.reviews.update_one({"id": rid}, {"$set": {"moderated": True}})
    await audit(user["id"], "moderate", "review", rid)
    agg = await db.reviews.aggregate([
        {"$match": {"restaurant_id": rv["restaurant_id"], "moderated": {"$ne": True}}},
        {"$group": {"_id": None, "avg": {"$avg": "$rating"}, "count": {"$sum": 1}}},
    ]).to_list(1)
    await db.restaurants.update_one(
        {"id": rv["restaurant_id"]},
        {"$set": {"rating": round(agg[0]["avg"], 1) if agg else 0, "rating_count": agg[0]["count"] if agg else 0}},
    )
    return {"message": "ok"}


@router.get("/support")
async def admin_support(user=Depends(admin)):
    return await db.support_tickets.find({}, {"_id": 0}).sort("created_at", -1).to_list(200)


class ReplyIn(BaseModel):
    message: str = Field(min_length=1, max_length=1000)
    close: bool = False


@router.post("/support/{tid}/reply")
async def reply_ticket(tid: str, data: ReplyIn, user=Depends(admin)):
    t = await db.support_tickets.find_one({"id": tid}, {"_id": 0})
    if not t:
        raise HTTPException(404, "Ticket não encontrado")
    msg = {"from": "Suporte Zupi", "from_role": "admin", "text": data.message, "at": now_iso()}
    updates = {"status": "closed" if data.close else "open"}
    await db.support_tickets.update_one({"id": tid}, {"$push": {"messages": msg}, "$set": updates})
    await notify(t["user_id"], "Resposta do suporte", data.message[:120], "support", tid)
    return {"message": "ok"}


@router.get("/audit")
async def admin_audit(user=Depends(admin)):
    return await db.audit_logs.find({}, {"_id": 0}).sort("at", -1).to_list(300)


class SettingsIn(BaseModel):
    platform_fee: float = Field(ge=0, le=50)
    platform_name: str = "Zupi Delivery"


@router.get("/settings")
async def get_admin_settings(user=Depends(admin)):
    from utils import get_settings
    return await get_settings()


@router.put("/settings")
async def update_settings(data: SettingsIn, user=Depends(admin)):
    from utils import get_settings
    before = await get_settings()
    await db.settings.update_one({"id": "platform"}, {"$set": data.model_dump()}, upsert=True)
    await audit(user["id"], "update", "settings", "platform", before={"platform_fee": before.get("platform_fee")}, after=data.model_dump())
    return await get_settings()
