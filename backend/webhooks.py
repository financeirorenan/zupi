import asyncio
import hmac
import hashlib
import json
import logging
import httpx

from database import db
from utils import uid, now_iso, STATUS_LABELS

logger = logging.getLogger(__name__)

CONNECTORS = ("saipos", "takeeat", "consumer")


def order_payload(order: dict, event: str) -> dict:
    return {
        "event": event, "sent_at": now_iso(), "order": {
            "id": order["id"], "code": order["code"], "status": order["status"],
            "status_label": STATUS_LABELS.get(order["status"], order["status"]),
            "restaurant_id": order["restaurant_id"], "created_at": order["created_at"],
            "customer": {"name": order.get("customer_name"), "phone": order.get("customer_phone")},
            "delivery_type": order.get("delivery_type"), "address": order.get("address"),
            "payment_method": order.get("payment_method"), "change_for": order.get("change_for"),
            "items": order.get("items", []), "subtotal": order.get("subtotal"), "discount": order.get("discount", 0),
            "delivery_fee": order.get("delivery_fee", 0), "total": order.get("total"),
            "coupon_code": order.get("coupon_code"), "notes": order.get("notes"), "courier_name": order.get("courier_name"),
        },
    }


def sign(secret: str, body: bytes) -> str:
    return hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()


async def _post(target: dict, payload: dict, restaurant_id: str, event: str):
    body = json.dumps(payload, ensure_ascii=False).encode()
    headers = {"Content-Type": "application/json", "X-Zupi-Event": event, "User-Agent": "Zupi-Webhooks/1.0"}
    if target.get("secret"):
        headers["X-Zupi-Signature"] = sign(target["secret"], body)
    if target.get("token"):
        headers["Authorization"] = f"Bearer {target['token']}"
    log = {"id": uid(), "restaurant_id": restaurant_id, "connector": target["name"], "url": target["url"], "event": event,
           "order_code": payload.get("order", {}).get("code"), "created_at": now_iso()}
    try:
        async with httpx.AsyncClient(timeout=10) as c:
            r = await c.post(target["url"], content=body, headers=headers)
            log.update({"status_code": r.status_code, "ok": 200 <= r.status_code < 300, "response": r.text[:300]})
    except Exception as e:
        log.update({"status_code": 0, "ok": False, "response": str(e)[:300]})
    await db.webhook_logs.insert_one(log)
    log.pop("_id", None)
    return log


def targets_for(integ: dict) -> list[dict]:
    out = []
    wh = integ.get("webhook") or {}
    if wh.get("enabled") and wh.get("url"):
        out.append({"name": "webhook", "url": wh["url"], "secret": wh.get("secret", ""), "token": ""})
    for name in CONNECTORS:
        c = integ.get(name) or {}
        if c.get("enabled") and c.get("url"):
            out.append({"name": name, "url": c["url"], "secret": integ.get("webhook", {}).get("secret", ""), "token": c.get("token", "")})
    return out


async def dispatch(order: dict, event: str):
    integ = await db.integrations.find_one({"restaurant_id": order["restaurant_id"]}, {"_id": 0})
    if not integ:
        return
    targets = targets_for(integ)
    if not targets:
        return
    payload = order_payload(order, event)
    await asyncio.gather(*[_post(t, payload, order["restaurant_id"], event) for t in targets])


def fire(order: dict, event: str):
    asyncio.create_task(dispatch(order, event))
