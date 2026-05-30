"""JWT auth helpers: hashing, tokens, current-user dependency."""
from __future__ import annotations

import os
from datetime import datetime, timezone, timedelta
from typing import Optional

import bcrypt
import jwt
from bson import ObjectId
from fastapi import HTTPException, Request

JWT_ALGORITHM = "HS256"
ACCESS_TTL_MIN = 60 * 24 * 7  # 7 days for a lean-back chess app
REFRESH_TTL_DAYS = 30


def get_jwt_secret() -> str:
    return os.environ["JWT_SECRET"]


def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def create_access_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TTL_MIN),
        "type": "access",
    }
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)


def create_refresh_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(days=REFRESH_TTL_DAYS),
        "type": "refresh",
    }
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    return jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])


def public_user(doc: dict) -> dict:
    """Strip private fields and stringify the id."""
    if not doc:
        return doc
    out = {**doc}
    out["id"] = str(out.pop("_id"))
    out.pop("password_hash", None)
    return out


async def get_current_user(request: Request) -> dict:
    """Read token from cookie or Authorization header and resolve the user."""
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = decode_token(token)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    if payload.get("type") != "access":
        raise HTTPException(status_code=401, detail="Invalid token type")

    from server import db  # late import to avoid cycle

    try:
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid user id")
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    if user.get("banned"):
        raise HTTPException(status_code=403, detail="Account banned")
    return public_user(user)


async def get_current_admin(request: Request) -> dict:
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    return user


def get_user_from_token(token: str) -> Optional[dict]:
    """Used by WebSocket; returns payload dict or None."""
    try:
        payload = decode_token(token)
        if payload.get("type") != "access":
            return None
        return payload
    except Exception:
        return None
