import re
from fastapi import APIRouter, HTTPException
from database import db
from utils import is_restaurant_open, now_iso

router = APIRouter(prefix="/api", tags=["public"])


def _with_open(r: dict) -> dict:
    r["is_open"] = is_restaurant_open(r)
    return r


@router.get("/cities")
async def list_cities():
    return await db.cities.find({"active": True}, {"_id": 0}).sort("name", 1).to_list(500)


@router.get("/categories")
async def list_categories():
    return await db.categories.find({"active": True}, {"_id": 0}).sort("order", 1).to_list(100)


@router.get("/restaurants")
async def list_restaurants(
    city: str | None = None, category: str | None = None, q: str | None = None,
    open_now: bool = False, free_delivery: bool = False, featured: bool = False,
    sort: str = "rating",
):
    filt: dict = {"status": "active"}
    if city:
        filt["city"] = city
    if category:
        filt["category"] = category
    if featured:
        filt["featured"] = True
    if free_delivery:
        filt["delivery_fee"] = 0
    if q:
        regex = {"$regex": re.escape(q), "$options": "i"}
        rest_ids = await db.products.distinct(
            "restaurant_id", {"available": True, "$or": [{"name": regex}, {"description": regex}]}
        )
        filt["$or"] = [{"name": regex}, {"category": regex}, {"description": regex}, {"id": {"$in": rest_ids}}]
    items = await db.restaurants.find(filt, {"_id": 0}).to_list(300)
    items = [_with_open(r) for r in items]
    if open_now:
        items = [r for r in items if r["is_open"]]
    key_map = {
        "rating": lambda r: -r.get("rating", 0),
        "delivery_fee": lambda r: r.get("delivery_fee", 0),
        "time": lambda r: r.get("prep_time", 40),
        "orders": lambda r: -r.get("order_count", 0),
    }
    kf = key_map.get(sort, key_map["rating"])
    items.sort(key=lambda r: (not r["is_open"], not r.get("featured", False), kf(r)))
    return items


@router.get("/restaurants/{rid}")
async def restaurant_detail(rid: str):
    r = await db.restaurants.find_one({"id": rid}, {"_id": 0})
    if not r or r.get("status") != "active":
        raise HTTPException(404, "Restaurante não encontrado")
    r = _with_open(r)
    cats = await db.menu_categories.find({"restaurant_id": rid}, {"_id": 0}).sort("order", 1).to_list(100)
    prods = await db.products.find({"restaurant_id": rid}, {"_id": 0}).sort("order", 1).to_list(500)
    menu = [{**c, "products": [p for p in prods if p["category_id"] == c["id"]]} for c in cats]
    reviews = await db.reviews.find({"restaurant_id": rid, "moderated": {"$ne": True}}, {"_id": 0}).sort("created_at", -1).to_list(20)
    return {"restaurant": r, "menu": menu, "reviews": reviews}


@router.get("/search")
async def search(q: str, city: str | None = None):
    regex = {"$regex": re.escape(q), "$options": "i"}
    prods = await db.products.find(
        {"available": True, "$or": [{"name": regex}, {"description": regex}]}, {"_id": 0}
    ).to_list(40)
    rest_ids = list({p["restaurant_id"] for p in prods})
    filt: dict = {"status": "active", "$or": [{"name": regex}, {"category": regex}, {"id": {"$in": rest_ids}}]}
    if city:
        filt["city"] = city
    rests = await db.restaurants.find(filt, {"_id": 0}).to_list(60)
    rests = [_with_open(r) for r in rests]
    return {"restaurants": rests, "products": prods[:20]}


@router.get("/banners")
async def list_banners(city: str | None = None):
    now = now_iso()
    filt: dict = {"active": True}
    if city:
        filt["$or"] = [{"city": ""}, {"city": city}, {"city": None}]
    banners = await db.banners.find(filt, {"_id": 0}).sort("position", 1).to_list(20)
    return [b for b in banners if (not b.get("start_date") or b["start_date"] <= now) and (not b.get("end_date") or b["end_date"] >= now)]
