"""Admin auth — httpOnly cookie sessions, never tokens in JSON."""

import hashlib
import os
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Cookie, HTTPException, Request, Response
from typing import Optional

from lib.db import db
from models.schemas import AdminUser, LoginRequest

router = APIRouter(prefix="/auth", tags=["auth"])

COOKIE = "ads_session"
SESSION_DAYS = 7


def hash_password(password: str, salt: str) -> str:
    return hashlib.sha256((salt + password).encode()).hexdigest()


async def ensure_default_admin() -> None:
    existing = await db.admins.find_one({"username": "admin"})
    if existing:
        return
    salt = secrets.token_hex(8)
    await db.admins.insert_one(
        {
            "username": os.environ.get("ADMIN_USER", "admin"),
            "salt": salt,
            "password_hash": hash_password(os.environ.get("ADMIN_PASSWORD", "admin123"), salt),
        }
    )


async def current_admin(session: Optional[str]) -> str:
    if not session:
        raise HTTPException(status_code=401, detail="Oturum bulunamadı")
    doc = await db.sessions.find_one({"token": session})
    if not doc:
        raise HTTPException(status_code=401, detail="Oturum geçersiz")
    return str(doc["username"])


async def require_admin(ads_session: Optional[str] = Cookie(default=None)) -> str:
    return await current_admin(ads_session)


@router.post("/login", response_model=AdminUser)
async def login(payload: LoginRequest, request: Request, response: Response):
    await ensure_default_admin()
    user = await db.admins.find_one({"username": payload.username})
    if not user or hash_password(payload.password, user["salt"]) != user["password_hash"]:
        raise HTTPException(status_code=401, detail="Kullanıcı adı veya şifre hatalı")
    token = secrets.token_urlsafe(32)
    await db.sessions.insert_one(
        {
            "token": token,
            "username": user["username"],
            "expires_at": datetime.now(timezone.utc) + timedelta(days=SESSION_DAYS),
        }
    )
    # Ters vekil (Nginx/Cloudflare) arkasında şema X-Forwarded-Proto ile gelir.
    # HTTPS ise çerez `SameSite=None; Secure` olur — panel bir iframe içinde açıldığında
    # (Emergent Preview) tarayıcı çerezi çapraz-site sayıp atmasın diye zorunlu.
    forwarded = request.headers.get("x-forwarded-proto", "")
    is_https = forwarded.split(",")[0].strip() == "https" or request.url.scheme == "https"
    response.set_cookie(
        COOKIE,
        token,
        httponly=True,
        samesite="none" if is_https else "lax",
        secure=is_https,
        max_age=SESSION_DAYS * 86400,
        path="/",
    )
    return AdminUser(username=user["username"])


@router.get("/me", response_model=AdminUser)
async def me(ads_session: Optional[str] = Cookie(default=None)):
    username = await current_admin(ads_session)
    return AdminUser(username=username)


@router.post("/logout")
async def logout(
    request: Request, response: Response, ads_session: Optional[str] = Cookie(default=None)
):
    if ads_session:
        await db.sessions.delete_one({"token": ads_session})
    forwarded = request.headers.get("x-forwarded-proto", "")
    is_https = forwarded.split(",")[0].strip() == "https" or request.url.scheme == "https"
    # Çerez hangi niteliklerle yazıldıysa aynısıyla silinmeli, yoksa tarayıcı silmez.
    response.delete_cookie(
        COOKIE, path="/", samesite="none" if is_https else "lax", secure=is_https
    )
    return {"ok": True}
