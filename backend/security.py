import os
import jwt
import bcrypt
from datetime import datetime, timezone, timedelta
from fastapi import HTTPException, Request, Response
from database import db

JWT_ALGORITHM = "HS256"


def jwt_secret() -> str:
    return os.environ["JWT_SECRET"]


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


def create_access_token(user: dict) -> str:
    payload = {
        "sub": user["id"],
        "email": user["email"],
        "ver": user.get("token_version", 0),
        "exp": datetime.now(timezone.utc) + timedelta(minutes=60),
        "type": "access",
    }
    return jwt.encode(payload, jwt_secret(), algorithm=JWT_ALGORITHM)


def create_refresh_token(user: dict) -> str:
    payload = {
        "sub": user["id"],
        "ver": user.get("token_version", 0),
        "exp": datetime.now(timezone.utc) + timedelta(days=7),
        "type": "refresh",
    }
    return jwt.encode(payload, jwt_secret(), algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    return jwt.decode(token, jwt_secret(), algorithms=[JWT_ALGORITHM])


def set_auth_cookies(response: Response, user: dict):
    response.set_cookie("access_token", create_access_token(user), httponly=True, secure=True, samesite="none", max_age=3600, path="/")
    response.set_cookie("refresh_token", create_refresh_token(user), httponly=True, secure=True, samesite="none", max_age=604800, path="/")


def clear_auth_cookies(response: Response):
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")


def public_user(user: dict) -> dict:
    u = {k: v for k, v in user.items() if k not in ("_id", "password_hash")}
    return u


async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        raise HTTPException(401, "Não autenticado")
    try:
        payload = decode_token(token)
        if payload.get("type") != "access":
            raise HTTPException(401, "Token inválido")
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Sessão expirada")
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Token inválido")
    user = await db.users.find_one({"id": payload["sub"]})
    if not user:
        raise HTTPException(401, "Usuário não encontrado")
    if payload.get("ver", 0) != user.get("token_version", 0):
        raise HTTPException(401, "Sessão expirada")
    if user.get("blocked"):
        raise HTTPException(403, "Conta bloqueada. Fale com o suporte.")
    return public_user(user)


def require_roles(*roles: str):
    async def dep(request: Request) -> dict:
        user = await get_current_user(request)
        if user["role"] not in roles:
            raise HTTPException(403, "Sem permissão")
        return user
    return dep
