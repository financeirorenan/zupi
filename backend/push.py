import asyncio
import json
import logging
import os

from pywebpush import webpush, WebPushException

from database import db

logger = logging.getLogger(__name__)


def _send(sub: dict, payload: dict) -> bool:
    try:
        webpush(
            subscription_info=sub["subscription"],
            data=json.dumps(payload, ensure_ascii=False),
            vapid_private_key=os.environ["VAPID_PRIVATE_KEY"],
            vapid_claims={"sub": os.environ["VAPID_SUBJECT"]},
            ttl=3600,
        )
        return True
    except WebPushException as e:
        code = getattr(e.response, "status_code", None)
        if code in (404, 410):
            return False
        logger.warning(f"push failed: {e}")
        return True
    except Exception as e:
        logger.warning(f"push error: {e}")
        return True


async def push_to_user(user_id: str, title: str, body: str, url: str = "/app/pedidos", tag: str | None = None):
    subs = await db.push_subscriptions.find({"user_id": user_id}, {"_id": 0}).to_list(20)
    if not subs:
        return
    payload = {"title": title, "body": body, "url": url, "tag": tag or "zupi"}
    loop = asyncio.get_running_loop()
    results = await asyncio.gather(*[loop.run_in_executor(None, _send, s, payload) for s in subs])
    dead = [s["id"] for s, ok in zip(subs, results) if not ok]
    if dead:
        await db.push_subscriptions.delete_many({"id": {"$in": dead}})
