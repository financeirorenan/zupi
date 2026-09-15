import uuid
import asyncio
from datetime import datetime, timezone
from zoneinfo import ZoneInfo
from database import db

TZ = ZoneInfo("America/Sao_Paulo")

ORDER_STATUSES = ["PENDING", "ACCEPTED", "PREPARING", "READY", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED"]

STATUS_LABELS = {
    "PENDING": "Pedido recebido",
    "ACCEPTED": "Restaurante aceitou",
    "PREPARING": "Em preparação",
    "READY": "Pronto",
    "OUT_FOR_DELIVERY": "Saiu para entrega",
    "DELIVERED": "Entregue",
    "CANCELLED": "Cancelado",
}

TRANSITIONS = {
    "PENDING": {"ACCEPTED": ["restaurant", "admin"], "CANCELLED": ["customer", "restaurant", "admin"]},
    "ACCEPTED": {"PREPARING": ["restaurant", "admin"], "CANCELLED": ["restaurant", "admin"]},
    "PREPARING": {"READY": ["restaurant", "admin"]},
    "READY": {"OUT_FOR_DELIVERY": ["restaurant", "admin"], "DELIVERED": ["restaurant", "admin"]},
    "OUT_FOR_DELIVERY": {"DELIVERED": ["restaurant", "admin"]},
}


def uid() -> str:
    return str(uuid.uuid4())


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def can_transition(current: str, target: str, role: str) -> bool:
    return role in TRANSITIONS.get(current, {}).get(target, [])


async def notify(user_id: str, title: str, body: str, ntype: str = "order", order_id: str | None = None):
    if not user_id:
        return
    await db.notifications.insert_one({
        "id": uid(), "user_id": user_id, "title": title, "body": body,
        "type": ntype, "order_id": order_id, "read": False, "created_at": now_iso(),
    })
    from push import push_to_user
    url = f"/pedido/{order_id}" if order_id else ("/admin/leads" if ntype == "lead" else "/app")
    asyncio.create_task(push_to_user(user_id, title, body, url, tag=order_id or ntype))


async def audit(actor_id: str, action: str, entity: str, entity_id: str, before=None, after=None):
    await db.audit_logs.insert_one({
        "id": uid(), "actor_id": actor_id, "action": action, "entity": entity,
        "entity_id": entity_id, "before": before, "after": after, "at": now_iso(),
    })


def is_restaurant_open(r: dict) -> bool:
    if r.get("paused"):
        return False
    now = datetime.now(TZ)
    windows = (r.get("hours") or {}).get(str(now.weekday()), [])
    cur = now.strftime("%H:%M")
    return any(w.get("open", "") <= cur <= w.get("close", "") for w in windows)


async def get_settings() -> dict:
    s = await db.settings.find_one({"id": "platform"}, {"_id": 0})
    if not s:
        s = {"id": "platform", "platform_fee": 2.0, "platform_name": "Zupi Delivery"}
        await db.settings.insert_one(dict(s))
    s.pop("_id", None)
    return s


async def validate_coupon(code: str, subtotal: float, restaurant_id: str, user_id: str | None):
    c = await db.coupons.find_one({"code": code.upper().strip(), "active": True}, {"_id": 0})
    if not c:
        return None, "Cupom inválido ou expirado"
    if c.get("valid_until") and c["valid_until"] < now_iso():
        return None, "Cupom expirado"
    if c.get("restaurant_id") and c["restaurant_id"] != restaurant_id:
        return None, "Cupom não válido para este restaurante"
    if c.get("city") and c["city"]:
        rest = await db.restaurants.find_one({"id": restaurant_id}, {"_id": 0, "city": 1})
        if rest and rest.get("city") != c["city"]:
            return None, "Cupom não válido nesta cidade"
    if subtotal < c.get("min_order", 0):
        return None, f"Pedido mínimo de R$ {c.get('min_order', 0):.2f} para este cupom"
    if c.get("max_uses") and c.get("used_count", 0) >= c["max_uses"]:
        return None, "Cupom esgotado"
    if c.get("first_purchase") and user_id:
        past = await db.orders.count_documents({"customer_id": user_id, "status": {"$ne": "CANCELLED"}})
        if past > 0:
            return None, "Cupom válido apenas na primeira compra"
    if c["type"] == "percent":
        discount = round(subtotal * c["value"] / 100, 2)
    else:
        discount = round(min(c["value"], subtotal), 2)
    return {"coupon": c, "discount": discount}, None


def delivery_fee_for(restaurant: dict, district: str | None) -> float:
    if district:
        d = district.strip().lower()
        for z in restaurant.get("delivery_zones", []):
            if z.get("district", "").strip().lower() == d:
                return float(z.get("fee", restaurant.get("delivery_fee", 0)))
    return float(restaurant.get("delivery_fee", 0))
