import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from database import db
from security import require_roles
from utils import uid, now_iso
from routers_merchant import get_merchant_restaurant

router = APIRouter(prefix="/api", tags=["logistics"])
merchant = require_roles("restaurant")

OVERPASS = "https://overpass-api.de/api/interpreter"
HEADERS = {"User-Agent": "ZupiDelivery/1.0 (delivery marketplace)"}


async def fetch_osm_districts(city: str, state: str) -> list[str]:
    query = f"""[out:json][timeout:25];
area["name"="{city}"]["admin_level"="8"]->.a;
(nwr(area.a)["place"~"neighbourhood|suburb|quarter"];);
out tags;"""
    for _ in range(2):
        try:
            async with httpx.AsyncClient(timeout=40, headers=HEADERS) as c:
                r = await c.post(OVERPASS, data={"data": query})
                if r.status_code != 200:
                    continue
                names = {e.get("tags", {}).get("name", "").strip() for e in r.json().get("elements", [])}
                return sorted(n for n in names if n)
        except Exception:
            continue
    return []


async def city_districts(city: str) -> list[str]:
    doc = await db.districts.find_one({"city": city}, {"_id": 0})
    if doc and doc.get("names"):
        return doc["names"]
    c = await db.cities.find_one({"name": city}, {"_id": 0})
    names = await fetch_osm_districts(city, c.get("state", "SP") if c else "SP")
    if not names:
        used = await db.orders.distinct("address.district", {"address.city": city})
        names = sorted({(n or "").strip() for n in used if n and n.strip()})
    if names:
        await db.districts.update_one({"city": city}, {"$set": {"city": city, "names": names, "source": "osm", "updated_at": now_iso()}}, upsert=True)
    return names


@router.get("/cities/{city}/districts")
async def get_city_districts(city: str, q: str = ""):
    names = await city_districts(city)
    if q:
        ql = q.strip().lower()
        names = [n for n in names if ql in n.lower()]
    return names[:50]


class DistrictIn(BaseModel):
    name: str = Field(min_length=2, max_length=60)


@router.post("/merchant/logistics/districts")
async def add_district(data: DistrictIn, user=Depends(merchant)):
    r = await get_merchant_restaurant(user)
    name = data.name.strip()
    await db.districts.update_one({"city": r["city"]}, {"$addToSet": {"names": name}, "$setOnInsert": {"city": r["city"], "source": "manual", "updated_at": now_iso()}}, upsert=True)
    return {"name": name}


class ZonesIn(BaseModel):
    delivery_fee: float = 0
    delivery_zones: list[dict] = []


@router.put("/merchant/logistics/zones")
async def save_zones(data: ZonesIn, user=Depends(merchant)):
    r = await get_merchant_restaurant(user)
    zones = [{"district": z.get("district", "").strip(), "fee": float(z.get("fee") or 0)} for z in data.delivery_zones if z.get("district", "").strip()]
    await db.restaurants.update_one({"id": r["id"]}, {"$set": {"delivery_fee": data.delivery_fee, "delivery_zones": zones}})
    return {"delivery_fee": data.delivery_fee, "delivery_zones": zones}


@router.get("/merchant/logistics/couriers/report")
async def couriers_report(days: int = 1, user=Depends(merchant)):
    r = await get_merchant_restaurant(user)
    days = min(max(days, 1), 90)
    from datetime import datetime, timezone, timedelta
    since = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    couriers = await db.couriers.find({"restaurant_id": r["id"]}, {"_id": 0}).to_list(100)
    orders = await db.orders.find({"restaurant_id": r["id"], "created_at": {"$gte": since}, "courier_id": {"$ne": None},
                                   "status": {"$in": ["OUT_FOR_DELIVERY", "DELIVERED"]}}, {"_id": 0}).to_list(5000)
    rows = []
    for c in couriers:
        mine = [o for o in orders if o.get("courier_id") == c["id"]]
        delivered = [o for o in mine if o["status"] == "DELIVERED"]
        n = len(delivered)
        daily_total = round(c.get("daily_rate", 0) * days, 2)
        fees = round(sum(o.get("delivery_fee", 0) for o in delivered), 2)
        rows.append({
            "id": c["id"], "name": c["name"], "active": c.get("active", True), "daily_rate": c.get("daily_rate", 0),
            "deliveries": n, "in_progress": len(mine) - n, "daily_total": daily_total,
            "cost_per_delivery": round(daily_total / n, 2) if n else None,
            "delivery_fees": fees, "balance": round(fees - daily_total, 2),
        })
    rows.sort(key=lambda x: -x["deliveries"])
    return {"period_days": days, "since": since, "couriers": rows,
            "total_deliveries": sum(x["deliveries"] for x in rows), "total_daily": round(sum(x["daily_total"] for x in rows if x["active"]), 2)}


class CourierIn(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    phone: str = ""
    vehicle: str = "moto"
    daily_rate: float = 0
    active: bool = True


@router.get("/merchant/logistics/couriers")
async def list_couriers(user=Depends(merchant)):
    r = await get_merchant_restaurant(user)
    return await db.couriers.find({"restaurant_id": r["id"]}, {"_id": 0}).sort("name", 1).to_list(100)


@router.post("/merchant/logistics/couriers")
async def create_courier(data: CourierIn, user=Depends(merchant)):
    r = await get_merchant_restaurant(user)
    doc = {"id": uid(), "restaurant_id": r["id"], **data.model_dump(), "created_at": now_iso()}
    await db.couriers.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.put("/merchant/logistics/couriers/{cid}")
async def update_courier(cid: str, data: CourierIn, user=Depends(merchant)):
    r = await get_merchant_restaurant(user)
    res = await db.couriers.update_one({"id": cid, "restaurant_id": r["id"]}, {"$set": data.model_dump()})
    if not res.matched_count:
        raise HTTPException(404, "Entregador não encontrado")
    return await db.couriers.find_one({"id": cid}, {"_id": 0})


@router.delete("/merchant/logistics/couriers/{cid}")
async def delete_courier(cid: str, user=Depends(merchant)):
    r = await get_merchant_restaurant(user)
    await db.couriers.delete_one({"id": cid, "restaurant_id": r["id"]})
    return {"message": "ok"}
