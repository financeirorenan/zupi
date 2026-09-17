import os
import secrets
import hashlib
import logging
from datetime import datetime, timezone, timedelta
from html import escape
from urllib.parse import urlparse

import httpx
from fastapi import APIRouter, HTTPException, Request, Response, BackgroundTasks
from pydantic import BaseModel, EmailStr, Field

from database import db
from security import (
    hash_password, verify_password, create_access_token, decode_token,
    set_auth_cookies, clear_auth_cookies, get_current_user, public_user,
)
from utils import uid, now_iso

router = APIRouter(prefix="/api/auth", tags=["auth"])
logger = logging.getLogger(__name__)

EMAIL_BASE_URL = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip().rstrip("/") or "https://integrations.emergentagent.com"
EMAIL_KEY = os.environ.get("EMERGENT_EMAIL_KEY", "")
EMAIL_FROM_NAME = os.environ.get("EMAIL_FROM_NAME") or "Zupi Delivery"

LOCK_LIMIT = 5
LOCK_WINDOW_MIN = 15
RESET_LIMIT = 5


class RegisterIn(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    email: EmailStr
    password: str = Field(min_length=6, max_length=100)
    phone: str | None = None
    role: str = "customer"


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class ForgotIn(BaseModel):
    email: EmailStr


class ResetIn(BaseModel):
    token: str
    password: str = Field(min_length=6, max_length=100)


class ProfileIn(BaseModel):
    name: str | None = None
    phone: str | None = None


async def send_password_reset_email(to_email: str, token: str, base: str | None = None) -> bool:
    base = (base or os.environ.get("FRONTEND_URL", "")).rstrip("/")
    link = f"{base}/reset-password?token={token}"
    if not EMAIL_KEY or EMAIL_KEY.startswith("{") or not base.startswith("https://"):
        if urlparse(base).hostname in ("localhost", "127.0.0.1", "::1"):
            logger.warning("Email not configured; password reset link: %s", link)
        else:
            logger.error("Password reset email not configured (EMERGENT_EMAIL_KEY / FRONTEND_URL)")
        return False
    brand = escape(EMAIL_FROM_NAME)
    html = (
        f'<table role="presentation" width="100%"><tr><td style="padding:24px;font-family:Arial,sans-serif">'
        f'<p>Recebemos um pedido para redefinir sua senha no {brand}.</p>'
        f'<p><a href="{escape(link)}">Redefinir minha senha</a></p>'
        f'<p>Este link expira em 1 hora e só pode ser usado uma vez. Se você não pediu, ignore este e-mail.</p>'
        f'<p style="font-size:12px;color:#888">Enviado por {brand}. Nunca pedimos sua senha por e-mail.</p>'
        f'</td></tr></table>'
    )
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{EMAIL_BASE_URL}/api/v1/email/send",
                headers={"X-Email-Key": EMAIL_KEY},
                json={"to": [to_email], "subject": f"Redefinir sua senha - {EMAIL_FROM_NAME}",
                      "html": html, "from_name": EMAIL_FROM_NAME},
            )
        resp.raise_for_status()
        return True
    except Exception as e:
        logger.error(f"Password reset email failed: {e}")
        return False


@router.post("/register")
async def register(data: RegisterIn, response: Response):
    email = data.email.lower().strip()
    if data.role not in ("customer", "restaurant"):
        raise HTTPException(400, "Tipo de conta inválido")
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(409, "E-mail já cadastrado")
    user = {
        "id": uid(), "name": data.name.strip(), "email": email,
        "password_hash": hash_password(data.password), "phone": data.phone,
        "role": data.role, "blocked": False, "token_version": 0,
        "created_at": now_iso(),
    }
    await db.users.insert_one(user)
    set_auth_cookies(response, user)
    return public_user(user)


@router.post("/login")
async def login(data: LoginIn, request: Request, response: Response):
    email = data.email.lower().strip()
    ip = request.client.host if request.client else "unknown"
    identifier = f"{ip}:{email}"
    since = (datetime.now(timezone.utc) - timedelta(minutes=LOCK_WINDOW_MIN)).isoformat()
    fails = await db.login_attempts.count_documents({"identifier": identifier, "at": {"$gte": since}})
    if fails >= LOCK_LIMIT:
        raise HTTPException(429, "Muitas tentativas. Tente novamente em alguns minutos.")
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(data.password, user["password_hash"]):
        await db.login_attempts.insert_one({"identifier": identifier, "email": email, "at": now_iso()})
        raise HTTPException(401, "E-mail ou senha incorretos")
    if user.get("blocked"):
        raise HTTPException(403, "Conta bloqueada. Fale com o suporte.")
    await db.login_attempts.delete_many({"identifier": identifier})
    set_auth_cookies(response, user)
    return public_user(user)


@router.post("/logout")
async def logout(response: Response):
    clear_auth_cookies(response)
    return {"message": "ok"}


@router.get("/me")
async def me(request: Request):
    return await get_current_user(request)


@router.post("/refresh")
async def refresh(request: Request, response: Response):
    token = request.cookies.get("refresh_token")
    if not token:
        raise HTTPException(401, "Não autenticado")
    try:
        payload = decode_token(token)
        if payload.get("type") != "refresh":
            raise HTTPException(401, "Token inválido")
    except jwt_error():
        raise HTTPException(401, "Token inválido")
    user = await db.users.find_one({"id": payload["sub"]})
    if not user or payload.get("ver", 0) != user.get("token_version", 0) or user.get("blocked"):
        clear_auth_cookies(response)
        raise HTTPException(401, "Sessão expirada")
    response.set_cookie("access_token", create_access_token(user, payload.get("imp")), httponly=True, secure=True, samesite="none", max_age=3600, path="/")
    return {"message": "ok"}


@router.post("/impersonate/stop")
async def stop_impersonation(request: Request, response: Response):
    token = request.cookies.get("access_token") or request.cookies.get("refresh_token")
    if not token:
        raise HTTPException(401, "Não autenticado")
    try:
        payload = decode_token(token)
    except jwt_error():
        raise HTTPException(401, "Token inválido")
    admin_id = payload.get("imp")
    if not admin_id:
        raise HTTPException(400, "Sessão não é de suporte")
    admin_user = await db.users.find_one({"id": admin_id})
    if not admin_user or admin_user.get("role") != "admin" or admin_user.get("blocked"):
        clear_auth_cookies(response)
        raise HTTPException(401, "Admin não encontrado")
    set_auth_cookies(response, admin_user)
    return public_user(admin_user)


def jwt_error():
    import jwt as _jwt
    return (_jwt.ExpiredSignatureError, _jwt.InvalidTokenError)


@router.put("/profile")
async def update_profile(data: ProfileIn, request: Request):
    user = await get_current_user(request)
    updates = {}
    if data.name:
        updates["name"] = data.name.strip()
    if data.phone is not None:
        updates["phone"] = data.phone
    if updates:
        await db.users.update_one({"id": user["id"]}, {"$set": updates})
    return await db.users.find_one({"id": user["id"]}, {"_id": 0, "password_hash": 0})


@router.post("/forgot-password")
async def forgot_password(data: ForgotIn, request: Request, background_tasks: BackgroundTasks):
    generic = {"message": "Se o e-mail estiver cadastrado, enviamos um link de redefinição."}
    email = data.email.lower().strip()
    since = (datetime.now(timezone.utc) - timedelta(minutes=LOCK_WINDOW_MIN)).isoformat()
    recent = await db.password_reset_requests.count_documents({"email": email, "created_at": {"$gte": since}})
    await db.password_reset_requests.insert_one({"email": email, "created_at": now_iso()})
    if recent >= RESET_LIMIT:
        return generic
    user = await db.users.find_one({"email": email})
    if not user:
        return generic
    token = secrets.token_urlsafe(32)
    await db.password_reset_tokens.insert_one({
        "token_hash": hashlib.sha256(token.encode()).hexdigest(),
        "user_id": user["id"], "email": email, "used": False,
        "expires_at": (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat(),
    })
    origin = request.headers.get("origin") or ""
    base = origin if origin.startswith("https://") else None
    background_tasks.add_task(send_password_reset_email, user["email"], token, base)
    return generic


@router.post("/reset-password")
async def reset_password(data: ResetIn, response: Response):
    h = hashlib.sha256(data.token.encode()).hexdigest()
    rec = await db.password_reset_tokens.find_one_and_update(
        {"token_hash": h, "used": False, "expires_at": {"$gt": now_iso()}},
        {"$set": {"used": True}},
    )
    if not rec:
        raise HTTPException(400, "Link inválido ou expirado")
    await db.users.update_one(
        {"id": rec["user_id"]},
        {"$set": {"password_hash": hash_password(data.password)}, "$inc": {"token_version": 1}},
    )
    await db.password_reset_tokens.delete_many({"user_id": rec["user_id"], "used": False})
    await db.login_attempts.delete_many({"email": rec["email"]})
    clear_auth_cookies(response)
    return {"message": "Senha redefinida com sucesso"}
