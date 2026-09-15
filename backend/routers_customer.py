from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field

from database import db
from security import require_roles
from webhooks import fire
from utils import (
    uid, now_iso, notify, can_transition, is_restaurant_open,
    get_settings, validate_coupon, delivery_fee_for, STATUS_LABELS,
)

router = APIRouter(prefix="/api", tags=["customer"])
customer = require_roles("customer", "admin")


class AddressIn(BaseModel):
    label: str = "Casa"
    cep: str = ""
    street: str
    number: str = ""
    complement: str = ""
    district: str
    city: str
    state: str = "SP"
    reference: str = ""
    lat: float | None = None
    lng: float | None = None


@router.get("/addresses")
async def list_addresses(user=Depends(customer)):
    return await db.addresses.find({"user_id": user["id"]}, {"_id": 0}).to_list(20)


@router.post("/addresses")
async def create_address(data: AddressIn, user=Depends(customer)):
    doc = {"id": uid(), "user_id": user["id"], **data.model_dump(), "created_at": now_iso()}
    await db.addresses.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.put("/addresses/{aid}")
async def update_address(aid: str, data: AddressIn, user=Depends(customer)):
    await db.addresses.update_one({"id": aid, "user_id": user["id"]}, {"$set": data.model_dump()})
    return await db.addresses.find_one({"id": aid}, {"_id": 0})


@router.delete("/addresses/{aid}")
async def delete_address(aid: str, user=Depends(customer)):
    await db.addresses.delete_one({"id": aid, "user_id": user["id"]})
    return {"message": "ok"}


class CouponValidateIn(BaseModel):
    code: str
    subtotal: float
    restaurant_id: str


@router.post("/coupons/validate")
async def coupon_validate(data: CouponValidateIn, user=Depends(customer)):
    result, error = await validate_coupon(data.code, data.subtotal, data.restaurant_id, user["id"])
    if error:
        raise HTTPException(400, error)
    return {"code": result["coupon"]["code"], "discount": result["discount"], "type": result["coupon"]["type"]}


class OrderItemIn(BaseModel):
    product_id: str
    qty: int = Field(default=1, ge=1, le=50)
    addons: list[str] = []
    notes: str = ""


class OrderIn(BaseModel):
    restaurant_id: str
    items: list[OrderItemIn]
    delivery_type: str = "delivery"
    address: dict | None = None
    payment_method: str
    coupon_code: str | None = None
    change_for: float | None = None


@router.post("/orders")
async def create_order(data: OrderIn, user=Depends(customer)):
    r = await db.restaurants.find_one({"id": data.restaurant_id}, {"_id": 0})
    if not r or r.get("status") != "active":
        raise HTTPException(404, "Restaurante não encontrado")
    if not is_restaurant_open(r):
        raise HTTPException(400, "Restaurante fechado no momento")
    if data.delivery_type not in ("delivery", "pickup"):
        raise HTTPException(400, "Tipo de entrega inválido")
    if data.payment_method not in ("pix", "card_machine", "cash", "online"):
        raise HTTPException(400, "Forma de pagamento inválida")
    if not data.items:
        raise HTTPException(400, "Carrinho vazio")

    items = []
    subtotal = 0.0
    for it in data.items:
        p = await db.products.find_one({"id": it.product_id, "restaurant_id": r["id"]}, {"_id": 0})
        if not p or not p.get("available"):
            raise HTTPException(400, f"Produto indisponível: {it.product_id}")
        price = float(p.get("promo_price") or p["price"])
        chosen_addons = []
        for aid in it.addons:
            addon = next((a for a in p.get("addons", []) if a["id"] == aid), None)
            if addon:
                chosen_addons.append({"name": addon["name"], "price": float(addon["price"])})
                price += float(addon["price"])
        line = round(price * it.qty, 2)
        subtotal += line
        items.append({
            "product_id": p["id"], "name": p["name"], "unit_price": round(price, 2),
            "qty": it.qty, "addons": chosen_addons, "notes": it.notes[:300], "line_total": line,
        })
    subtotal = round(subtotal, 2)

    if subtotal < float(r.get("min_order", 0)):
        raise HTTPException(400, f"Pedido mínimo de R$ {float(r.get('min_order', 0)):.2f}")

    address = None
    delivery_fee = 0.0
    if data.delivery_type == "delivery":
        if not data.address or not data.address.get("street"):
            raise HTTPException(400, "Informe o endereço de entrega")
        address = {k: data.address.get(k, "") for k in
                   ("label", "cep", "street", "number", "complement", "district", "city", "state", "reference")}
        delivery_fee = delivery_fee_for(r, address.get("district"))

    discount = 0.0
    coupon_code = None
    if data.coupon_code:
        result, error = await validate_coupon(data.coupon_code, subtotal, r["id"], user["id"])
        if error:
            raise HTTPException(400, error)
        discount = result["discount"]
        coupon_code = result["coupon"]["code"]
        await db.coupons.update_one({"id": result["coupon"]["id"]}, {"$inc": {"used_count": 1}})

    total = round(max(subtotal - discount, 0) + delivery_fee, 2)
    settings = await get_settings()
    zupi_fee = round(float(settings.get("platform_fee", 2.0)), 2)

    count = await db.orders.count_documents({})
    order = {
        "id": uid(), "code": f"#{1001 + count}",
        "customer_id": user["id"], "customer_name": user["name"], "customer_phone": user.get("phone", ""),
        "restaurant_id": r["id"], "restaurant_name": r["name"],
        "city": r.get("city", ""),
        "items": items, "subtotal": subtotal, "delivery_fee": round(delivery_fee, 2),
        "discount": discount, "coupon_code": coupon_code, "total": total, "zupi_fee": zupi_fee,
        "delivery_type": data.delivery_type, "address": address,
        "payment_method": data.payment_method, "change_for": data.change_for,
        "status": "PENDING",
        "status_history": [{"status": "PENDING", "at": now_iso()}],
        "pickup_code": uid()[:6].upper() if data.delivery_type == "pickup" else None,
        "reviewed": False, "created_at": now_iso(),
    }
    await db.orders.insert_one(order)
    order.pop("_id", None)
    await db.restaurants.update_one({"id": r["id"]}, {"$inc": {"order_count": 1}})
    await db.transactions.insert_one({
        "id": uid(), "type": "zupi_fee", "amount": zupi_fee, "order_id": order["id"],
        "restaurant_id": r["id"], "description": f"Taxa Zupi pedido {order['code']}", "created_at": now_iso(),
    })
    await notify(r["owner_id"], "Novo pedido recebido!", f"Pedido {order['code']} - R$ {total:.2f}", "order", order["id"])
    await notify(user["id"], "Pedido realizado!", f"Seu pedido {order['code']} foi enviado para {r['name']}", "order", order["id"])
    fire(order, "order.created")
    return order


@router.get("/orders/mine")
async def my_orders(user=Depends(customer)):
    return await db.orders.find({"customer_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)


async def _get_order_for_user(oid: str, user: dict) -> dict:
    o = await db.orders.find_one({"id": oid}, {"_id": 0})
    if not o:
        raise HTTPException(404, "Pedido não encontrado")
    if user["role"] == "admin":
        return o
    if user["role"] == "customer" and o["customer_id"] == user["id"]:
        return o
    if user["role"] == "restaurant":
        r = await db.restaurants.find_one({"owner_id": user["id"]}, {"_id": 0, "id": 1})
        if r and o["restaurant_id"] == r["id"]:
            return o
    raise HTTPException(403, "Sem permissão")


@router.get("/orders/{oid}")
async def get_order(oid: str, user=Depends(require_roles("customer", "restaurant", "admin"))):
    return await _get_order_for_user(oid, user)


@router.post("/orders/{oid}/cancel")
async def cancel_order(oid: str, user=Depends(customer)):
    o = await _get_order_for_user(oid, user)
    if not can_transition(o["status"], "CANCELLED", "customer"):
        raise HTTPException(400, "Este pedido não pode mais ser cancelado")
    await db.orders.update_one(
        {"id": oid},
        {"$set": {"status": "CANCELLED"},
         "$push": {"status_history": {"status": "CANCELLED", "at": now_iso(), "by": "customer"}}},
    )
    await db.transactions.insert_one({
        "id": uid(), "type": "zupi_fee_reversal", "amount": -o["zupi_fee"], "order_id": oid,
        "restaurant_id": o["restaurant_id"], "description": f"Estorno taxa Zupi pedido {o['code']}", "created_at": now_iso(),
    })
    r = await db.restaurants.find_one({"id": o["restaurant_id"]}, {"_id": 0, "owner_id": 1})
    if r:
        await notify(r["owner_id"], "Pedido cancelado", f"Pedido {o['code']} foi cancelado pelo cliente", "order", oid)
    return {"message": "Pedido cancelado"}


class ReorderOut(BaseModel):
    restaurant_id: str
    restaurant_name: str
    items: list[dict]


@router.post("/orders/{oid}/reorder")
async def reorder(oid: str, user=Depends(customer)):
    o = await _get_order_for_user(oid, user)
    items = []
    for it in o["items"]:
        p = await db.products.find_one({"id": it["product_id"], "available": True}, {"_id": 0})
        if not p:
            continue
        valid_addons = [a["id"] for a in p.get("addons", [])]
        items.append({
            "product_id": p["id"], "name": p["name"], "image": p.get("image", ""),
            "unit_price": float(p.get("promo_price") or p["price"]),
            "qty": it["qty"],
            "addons": [a for a in [] if a in valid_addons], "notes": it.get("notes", ""),
        })
    return {"restaurant_id": o["restaurant_id"], "restaurant_name": o["restaurant_name"], "items": items}


class ReviewIn(BaseModel):
    rating: int = Field(ge=1, le=5)
    food_rating: int = Field(default=5, ge=1, le=5)
    delivery_rating: int = Field(default=5, ge=1, le=5)
    comment: str = ""


@router.post("/orders/{oid}/review")
async def review_order(oid: str, data: ReviewIn, user=Depends(customer)):
    o = await _get_order_for_user(oid, user)
    if o["customer_id"] != user["id"]:
        raise HTTPException(403, "Sem permissão")
    if o["status"] != "DELIVERED":
        raise HTTPException(400, "Só é possível avaliar pedidos entregues")
    if o.get("reviewed"):
        raise HTTPException(400, "Pedido já avaliado")
    review = {
        "id": uid(), "order_id": oid, "customer_id": user["id"], "customer_name": user["name"],
        "restaurant_id": o["restaurant_id"], "rating": data.rating,
        "food_rating": data.food_rating, "delivery_rating": data.delivery_rating,
        "comment": data.comment[:500], "moderated": False, "created_at": now_iso(),
    }
    await db.reviews.insert_one(review)
    await db.orders.update_one({"id": oid}, {"$set": {"reviewed": True}})
    agg = await db.reviews.aggregate([
        {"$match": {"restaurant_id": o["restaurant_id"], "moderated": {"$ne": True}}},
        {"$group": {"_id": None, "avg": {"$avg": "$rating"}, "count": {"$sum": 1}}},
    ]).to_list(1)
    if agg:
        await db.restaurants.update_one(
            {"id": o["restaurant_id"]},
            {"$set": {"rating": round(agg[0]["avg"], 1), "rating_count": agg[0]["count"]}},
        )
    review.pop("_id", None)
    return review


@router.get("/favorites")
async def list_favorites(user=Depends(customer)):
    favs = await db.favorites.find({"user_id": user["id"]}, {"_id": 0}).to_list(100)
    ids = [f["restaurant_id"] for f in favs]
    rests = await db.restaurants.find({"id": {"$in": ids}, "status": "active"}, {"_id": 0}).to_list(100)
    for r in rests:
        r["is_open"] = is_restaurant_open(r)
    return rests


@router.post("/favorites/{rid}")
async def add_favorite(rid: str, user=Depends(customer)):
    await db.favorites.update_one(
        {"user_id": user["id"], "restaurant_id": rid},
        {"$set": {"user_id": user["id"], "restaurant_id": rid, "created_at": now_iso()}},
        upsert=True,
    )
    return {"message": "ok"}


@router.delete("/favorites/{rid}")
async def remove_favorite(rid: str, user=Depends(customer)):
    await db.favorites.delete_many({"user_id": user["id"], "restaurant_id": rid})
    return {"message": "ok"}


@router.get("/notifications")
async def list_notifications(user=Depends(require_roles("customer", "restaurant", "admin"))):
    items = await db.notifications.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(30)
    unread = await db.notifications.count_documents({"user_id": user["id"], "read": False})
    return {"items": items, "unread": unread}


class PushSubIn(BaseModel):
    subscription: dict


@router.post("/push/subscribe")
async def push_subscribe(data: PushSubIn, user=Depends(require_roles("customer", "restaurant", "admin"))):
    endpoint = data.subscription.get("endpoint")
    if not endpoint:
        raise HTTPException(400, "Assinatura inválida")
    await db.push_subscriptions.update_one(
        {"endpoint": endpoint},
        {"$set": {"user_id": user["id"], "subscription": data.subscription, "updated_at": now_iso()}, "$setOnInsert": {"id": uid(), "created_at": now_iso()}},
        upsert=True,
    )
    return {"message": "ok"}


@router.delete("/push/subscribe")
async def push_unsubscribe(data: PushSubIn, user=Depends(require_roles("customer", "restaurant", "admin"))):
    await db.push_subscriptions.delete_many({"endpoint": data.subscription.get("endpoint"), "user_id": user["id"]})
    return {"message": "ok"}


@router.post("/push/test")
async def push_test(user=Depends(require_roles("customer", "restaurant", "admin"))):
    await notify(user["id"], "Notificações ativadas!", "Você vai receber avisos a cada mudança nos seus pedidos.", "system")
    return {"message": "ok"}


@router.post("/notifications/read-all")
async def read_all_notifications(user=Depends(require_roles("customer", "restaurant", "admin"))):
    await db.notifications.update_many({"user_id": user["id"]}, {"$set": {"read": True}})
    return {"message": "ok"}


class TicketIn(BaseModel):
    subject: str = Field(min_length=3, max_length=120)
    category: str = "pedido"
    message: str = Field(min_length=3, max_length=1000)
    order_id: str | None = None


@router.post("/support")
async def create_ticket(data: TicketIn, user=Depends(require_roles("customer", "restaurant"))):
    ticket = {
        "id": uid(), "user_id": user["id"], "user_name": user["name"], "role": user["role"],
        "subject": data.subject, "category": data.category, "order_id": data.order_id,
        "status": "open",
        "messages": [{"from": user["name"], "from_role": user["role"], "text": data.message, "at": now_iso()}],
        "created_at": now_iso(),
    }
    await db.support_tickets.insert_one(ticket)
    ticket.pop("_id", None)
    return ticket


@router.get("/support/mine")
async def my_tickets(user=Depends(require_roles("customer", "restaurant"))):
    return await db.support_tickets.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(50)
