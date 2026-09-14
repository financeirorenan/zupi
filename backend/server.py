from dotenv import load_dotenv
load_dotenv()

import logging
import os
from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware

from database import db, client
from routers_auth import router as auth_router
from routers_public import router as public_router
from routers_customer import router as customer_router
from routers_merchant import router as merchant_router
from routers_admin import router as admin_router
from seed import seed_admin, seed_demo

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

app = FastAPI(title="Zupi Delivery API")

app.include_router(auth_router)
app.include_router(public_router)
app.include_router(customer_router)
app.include_router(merchant_router)
app.include_router(admin_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.environ.get("FRONTEND_URL", "http://localhost:3000"), "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
async def health():
    return {"status": "ok", "app": "Zupi Delivery"}


@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("id", unique=True)
    await db.password_reset_tokens.create_index("expires_at", expireAfterSeconds=0)
    await db.password_reset_tokens.create_index("token_hash", unique=True)
    await db.login_attempts.create_index("identifier")
    await db.login_attempts.create_index("email")
    await db.password_reset_requests.create_index("email")
    await db.password_reset_requests.create_index("created_at", expireAfterSeconds=900)
    await db.restaurants.create_index([("city", 1), ("status", 1)])
    await db.products.create_index("restaurant_id")
    await db.orders.create_index("customer_id")
    await db.orders.create_index([("restaurant_id", 1), ("created_at", -1)])
    await db.notifications.create_index("user_id")
    await db.transactions.create_index("restaurant_id")
    await db.coupons.create_index("code", unique=True)
    await seed_admin(db)
    await seed_demo(db)
    logger.info("Zupi Delivery API pronta")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
