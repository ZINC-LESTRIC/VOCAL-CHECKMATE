"""Main FastAPI app: auth, users, games, admin, WebSocket."""
from __future__ import annotations

from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import json
import logging
import math
import os
from datetime import datetime, timezone
from typing import Optional

from bson import ObjectId
from fastapi import (
    APIRouter,
    Depends,
    FastAPI,
    HTTPException,
    Query,
    Request,
    Response,
    WebSocket,
    WebSocketDisconnect,
)
from motor.motor_asyncio import AsyncIOMotorClient
from starlette.middleware.cors import CORSMiddleware

from auth import (
    create_access_token,
    create_refresh_token,
    decode_token,
    get_current_admin,
    get_current_user,
    get_user_from_token,
    hash_password,
    public_user,
    verify_password,
)
from models import (
    AdminUpdateIn,
    ChangePasswordIn,
    CreateGameIn,
    FinishGameIn,
    FriendRequestIn,
    LoginIn,
    RegisterIn,
    UpdateProfileIn,
)
from ws_manager import manager

# ----------------------------------------------------------------------
# Mongo
# ----------------------------------------------------------------------
mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

# ----------------------------------------------------------------------
# App
# ----------------------------------------------------------------------
app = FastAPI(title="Voice Chess API")
api = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s - %(message)s")
log = logging.getLogger("voicechess")

# ----------------------------------------------------------------------
# Helpers
# ----------------------------------------------------------------------
DEFAULT_RATING = 1200


def set_auth_cookies(response: Response, access: str, refresh: str) -> None:
    response.set_cookie(
        key="access_token", value=access, httponly=True, secure=False,
        samesite="lax", max_age=60 * 60 * 24 * 7, path="/",
    )
    response.set_cookie(
        key="refresh_token", value=refresh, httponly=True, secure=False,
        samesite="lax", max_age=60 * 60 * 24 * 30, path="/",
    )


def clear_auth_cookies(response: Response) -> None:
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")


def elo_expected(my_rating: int, opp_rating: int) -> float:
    return 1.0 / (1.0 + math.pow(10, (opp_rating - my_rating) / 400.0))


def elo_update(rating: int, opp_rating: int, score: float, k: int = 24) -> int:
    expected = elo_expected(rating, opp_rating)
    return int(round(rating + k * (score - expected)))


# ----------------------------------------------------------------------
# Auth routes
# ----------------------------------------------------------------------
@api.post("/auth/register")
async def register(body: RegisterIn, response: Response):
    email = body.email.lower().strip()
    username = body.username.strip()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email already registered")
    if await db.users.find_one({"username_lc": username.lower()}):
        raise HTTPException(status_code=400, detail="Username already taken")

    doc = {
        "email": email,
        "username": username,
        "username_lc": username.lower(),
        "password_hash": hash_password(body.password),
        "name": "",
        "bio": "",
        "country": "",
        "avatar": "",
        "rating": DEFAULT_RATING,
        "stats": {"wins": 0, "losses": 0, "draws": 0, "games": 0},
        "role": "user",
        "banned": False,
        "board_theme": "obsidian",
        "piece_set": "classic",
        "sound_enabled": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "last_active": datetime.now(timezone.utc).isoformat(),
    }
    res = await db.users.insert_one(doc)
    uid = str(res.inserted_id)
    access = create_access_token(uid, email)
    refresh = create_refresh_token(uid)
    set_auth_cookies(response, access, refresh)
    doc["_id"] = res.inserted_id
    return {"user": public_user(doc), "access_token": access}


@api.post("/auth/login")
async def login(body: LoginIn, request: Request, response: Response):
    email = body.email.lower().strip()
    xff = request.headers.get("x-forwarded-for", "")
    ip = xff.split(",")[0].strip() if xff else (request.client.host if request.client else "unknown")
    identifier = f"{ip}:{email}"

    # brute force lockout
    attempts = await db.login_attempts.find_one({"identifier": identifier})
    if attempts and attempts.get("count", 0) >= 5:
        locked_until = attempts.get("locked_until")
        if locked_until and datetime.fromisoformat(locked_until) > datetime.now(timezone.utc):
            raise HTTPException(status_code=429, detail="Too many failed attempts. Try again later.")

    user = await db.users.find_one({"email": email})
    if not user or not verify_password(body.password, user["password_hash"]):
        from datetime import timedelta
        new_count = (attempts.get("count", 0) if attempts else 0) + 1
        locked_until = (datetime.now(timezone.utc) + timedelta(minutes=15)).isoformat() if new_count >= 5 else None
        await db.login_attempts.update_one(
            {"identifier": identifier},
            {"$set": {"count": new_count, "locked_until": locked_until}},
            upsert=True,
        )
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if user.get("banned"):
        raise HTTPException(status_code=403, detail="Account banned")

    await db.login_attempts.delete_one({"identifier": identifier})
    uid = str(user["_id"])
    access = create_access_token(uid, email)
    refresh = create_refresh_token(uid)
    set_auth_cookies(response, access, refresh)
    await db.users.update_one({"_id": user["_id"]}, {"$set": {"last_active": datetime.now(timezone.utc).isoformat()}})
    return {"user": public_user(user), "access_token": access}


@api.post("/auth/logout")
async def logout(response: Response, user: dict = Depends(get_current_user)):
    clear_auth_cookies(response)
    return {"ok": True}


@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return user


@api.post("/auth/refresh")
async def refresh(request: Request, response: Response):
    token = request.cookies.get("refresh_token")
    if not token:
        raise HTTPException(status_code=401, detail="Missing refresh token")
    try:
        payload = decode_token(token)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid refresh token")
    if payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid token type")
    uid = payload["sub"]
    user = await db.users.find_one({"_id": ObjectId(uid)})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    access = create_access_token(uid, user["email"])
    response.set_cookie(
        key="access_token", value=access, httponly=True, secure=False,
        samesite="lax", max_age=60 * 60 * 24 * 7, path="/",
    )
    return {"access_token": access}


# ----------------------------------------------------------------------
# User routes
# ----------------------------------------------------------------------
@api.get("/users/me")
async def get_me(user: dict = Depends(get_current_user)):
    return user


@api.put("/users/me")
async def update_me(body: UpdateProfileIn, user: dict = Depends(get_current_user)):
    update: dict = {}
    if body.username is not None:
        new_lc = body.username.lower()
        # uniqueness check
        existing = await db.users.find_one({"username_lc": new_lc, "_id": {"$ne": ObjectId(user["id"])}})
        if existing:
            raise HTTPException(status_code=400, detail="Username already taken")
        update["username"] = body.username
        update["username_lc"] = new_lc
    for fld in ("name", "bio", "country", "avatar", "board_theme", "piece_set"):
        val = getattr(body, fld)
        if val is not None:
            update[fld] = val
    if body.sound_enabled is not None:
        update["sound_enabled"] = body.sound_enabled
    if update:
        await db.users.update_one({"_id": ObjectId(user["id"])}, {"$set": update})
    doc = await db.users.find_one({"_id": ObjectId(user["id"])})
    return public_user(doc)


@api.post("/users/me/password")
async def change_password(body: ChangePasswordIn, user: dict = Depends(get_current_user)):
    doc = await db.users.find_one({"_id": ObjectId(user["id"])})
    if not verify_password(body.current_password, doc["password_hash"]):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    await db.users.update_one(
        {"_id": ObjectId(user["id"])},
        {"$set": {"password_hash": hash_password(body.new_password)}},
    )
    return {"ok": True}


@api.get("/users/leaderboard")
async def leaderboard(limit: int = Query(20, le=100)):
    cur = db.users.find({"banned": {"$ne": True}}).sort("rating", -1).limit(limit)
    return [public_user(d) async for d in cur]


@api.get("/users/{user_id}")
async def get_user(user_id: str):
    try:
        oid = ObjectId(user_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid id")
    doc = await db.users.find_one({"_id": oid})
    if not doc:
        raise HTTPException(status_code=404, detail="User not found")
    return public_user(doc)


# ----------------------------------------------------------------------
# Game routes
# ----------------------------------------------------------------------
@api.post("/games")
async def create_game(body: CreateGameIn, user: dict = Depends(get_current_user)):
    doc = {
        "owner_id": user["id"],
        "mode": body.mode,
        "color": body.color,
        "engine_level": body.engine_level,
        "time_control": body.time_control,
        "opponent_id": body.opponent_id,
        "result": None,
        "termination": None,
        "moves": [],
        "pgn": "",
        "final_fen": "",
        "rating_change": 0,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "finished_at": None,
    }
    res = await db.games.insert_one(doc)
    doc["id"] = str(res.inserted_id)
    doc.pop("_id", None)
    return doc


@api.post("/games/{game_id}/finish")
async def finish_game(game_id: str, body: FinishGameIn, user: dict = Depends(get_current_user)):
    try:
        oid = ObjectId(game_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid id")
    game = await db.games.find_one({"_id": oid})
    if not game or game["owner_id"] != user["id"]:
        raise HTTPException(status_code=404, detail="Game not found")

    user_doc = await db.users.find_one({"_id": ObjectId(user["id"])})
    rating = int(user_doc.get("rating", DEFAULT_RATING))
    rating_change = 0
    stats_update = {}

    # Determine score from user perspective
    user_color = game.get("color", "white")
    if body.result == "draw":
        score = 0.5
        stats_update = {"stats.draws": 1, "stats.games": 1}
    elif body.result == user_color:
        score = 1.0
        stats_update = {"stats.wins": 1, "stats.games": 1}
    elif body.result == "aborted":
        score = None
        stats_update = {}
    else:
        score = 0.0
        stats_update = {"stats.losses": 1, "stats.games": 1}

    # Compute rating change vs opponent rating
    if score is not None:
        if game["mode"] == "ai":
            level = int(game.get("engine_level") or 4)
            opp_rating = {1: 400, 2: 800, 3: 1200, 4: 1600, 5: 2000, 6: 2400, 7: 2800, 8: 3200}.get(level, 1600)
            k = 16
        elif game["mode"] == "online" and game.get("opponent_id"):
            opp = await db.users.find_one({"_id": ObjectId(game["opponent_id"])})
            opp_rating = int(opp.get("rating", DEFAULT_RATING)) if opp else DEFAULT_RATING
            k = 24
        else:
            opp_rating = None
            k = 0
        if opp_rating is not None and k > 0:
            new_rating = elo_update(rating, opp_rating, score, k=k)
            rating_change = new_rating - rating
            await db.users.update_one(
                {"_id": ObjectId(user["id"])},
                {"$set": {"rating": new_rating}},
            )

    update_doc = {
        "moves": body.moves,
        "pgn": body.pgn,
        "final_fen": body.final_fen,
        "result": body.result,
        "termination": body.termination,
        "rating_change": rating_change,
        "finished_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.games.update_one({"_id": oid}, {"$set": update_doc})
    if stats_update:
        await db.users.update_one({"_id": ObjectId(user["id"])}, {"$inc": stats_update})

    return {"rating_change": rating_change}


@api.get("/games/me")
async def my_games(user: dict = Depends(get_current_user), limit: int = Query(30, le=100)):
    cur = db.games.find({"owner_id": user["id"]}).sort("created_at", -1).limit(limit)
    out = []
    async for g in cur:
        g["id"] = str(g.pop("_id"))
        out.append(g)
    return out


@api.get("/games/{game_id}")
async def get_game(game_id: str, user: dict = Depends(get_current_user)):
    try:
        oid = ObjectId(game_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid id")
    g = await db.games.find_one({"_id": oid})
    if not g:
        raise HTTPException(status_code=404, detail="Not found")
    # allow owner or opponent (online games) to view
    if g.get("owner_id") != user["id"] and g.get("opponent_id") != user["id"]:
        # Still allow read so that both players of an online game can review.
        pass
    g["id"] = str(g.pop("_id"))
    return g


# ----------------------------------------------------------------------
# Friends routes
# ----------------------------------------------------------------------
def _friend_public(doc: dict, online_ids: set) -> dict:
    out = public_user(doc)
    out["online"] = out["id"] in online_ids
    # trim heavy fields for list views
    out.pop("avatar", None) if isinstance(out.get("avatar"), str) and len(out.get("avatar", "")) > 4000 else None
    return out


@api.get("/friends")
async def list_friends(user: dict = Depends(get_current_user)):
    uid = user["id"]
    cur = db.friendships.find({
        "status": "accepted",
        "$or": [{"user_a": uid}, {"user_b": uid}],
    })
    friend_ids: list[str] = []
    edges = []
    async for f in cur:
        other = f["user_b"] if f["user_a"] == uid else f["user_a"]
        friend_ids.append(other)
        edges.append({"id": str(f["_id"]), "friend_id": other})
    if not friend_ids:
        return []
    docs = await db.users.find({"_id": {"$in": [ObjectId(x) for x in friend_ids]}}).to_list(500)
    online_ids = set(manager.connections.keys())
    by_id = {str(d["_id"]): d for d in docs}
    return [
        {**_friend_public(by_id[e["friend_id"]], online_ids), "friendship_id": e["id"]}
        for e in edges if e["friend_id"] in by_id
    ]


@api.get("/friends/requests")
async def list_friend_requests(user: dict = Depends(get_current_user)):
    uid = user["id"]
    cur = db.friendships.find({"status": "pending", "$or": [{"user_a": uid}, {"user_b": uid}]})
    incoming: list[dict] = []
    outgoing: list[dict] = []
    online_ids = set(manager.connections.keys())
    async for f in cur:
        other_id = f["user_b"] if f["user_a"] == uid else f["user_a"]
        other = await db.users.find_one({"_id": ObjectId(other_id)})
        if not other:
            continue
        item = {**_friend_public(other, online_ids), "friendship_id": str(f["_id"])}
        if f["requester_id"] == uid:
            outgoing.append(item)
        else:
            incoming.append(item)
    return {"incoming": incoming, "outgoing": outgoing}


@api.post("/friends/request")
async def request_friend(body: FriendRequestIn, user: dict = Depends(get_current_user)):
    target = await db.users.find_one({"username_lc": body.username.lower()})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    target_id = str(target["_id"])
    if target_id == user["id"]:
        raise HTTPException(status_code=400, detail="Cannot friend yourself")
    a, b = sorted([user["id"], target_id])
    existing = await db.friendships.find_one({"user_a": a, "user_b": b})
    if existing:
        if existing["status"] == "accepted":
            raise HTTPException(status_code=400, detail="Already friends")
        if existing["status"] == "pending":
            # If the OTHER side already requested, auto-accept.
            if existing["requester_id"] != user["id"]:
                await db.friendships.update_one(
                    {"_id": existing["_id"]},
                    {"$set": {"status": "accepted", "updated_at": datetime.now(timezone.utc).isoformat()}},
                )
                return {"id": str(existing["_id"]), "status": "accepted"}
            raise HTTPException(status_code=400, detail="Request already pending")
    res = await db.friendships.insert_one({
        "user_a": a, "user_b": b, "status": "pending",
        "requester_id": user["id"],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"id": str(res.inserted_id), "status": "pending"}


@api.post("/friends/{friendship_id}/accept")
async def accept_friend(friendship_id: str, user: dict = Depends(get_current_user)):
    try:
        oid = ObjectId(friendship_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid id")
    f = await db.friendships.find_one({"_id": oid})
    if not f or f["status"] != "pending":
        raise HTTPException(status_code=404, detail="Request not found")
    if user["id"] not in (f["user_a"], f["user_b"]) or f["requester_id"] == user["id"]:
        raise HTTPException(status_code=403, detail="Not the recipient")
    await db.friendships.update_one({"_id": oid}, {"$set": {
        "status": "accepted",
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }})
    return {"ok": True}


@api.post("/friends/{friendship_id}/decline")
async def decline_friend(friendship_id: str, user: dict = Depends(get_current_user)):
    try:
        oid = ObjectId(friendship_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid id")
    f = await db.friendships.find_one({"_id": oid})
    if not f:
        raise HTTPException(status_code=404, detail="Not found")
    if user["id"] not in (f["user_a"], f["user_b"]):
        raise HTTPException(status_code=403, detail="Forbidden")
    await db.friendships.delete_one({"_id": oid})
    return {"ok": True}


@api.delete("/friends/{friendship_id}")
async def remove_friend(friendship_id: str, user: dict = Depends(get_current_user)):
    try:
        oid = ObjectId(friendship_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid id")
    f = await db.friendships.find_one({"_id": oid})
    if not f:
        raise HTTPException(status_code=404, detail="Not found")
    if user["id"] not in (f["user_a"], f["user_b"]):
        raise HTTPException(status_code=403, detail="Forbidden")
    await db.friendships.delete_one({"_id": oid})
    return {"ok": True}


# ----------------------------------------------------------------------
# Admin routes
# ----------------------------------------------------------------------
@api.get("/admin/stats")
async def admin_stats(admin: dict = Depends(get_current_admin)):
    total_users = await db.users.count_documents({})
    banned_users = await db.users.count_documents({"banned": True})
    total_games = await db.games.count_documents({})
    finished_games = await db.games.count_documents({"finished_at": {"$ne": None}})
    online_count = len(manager.connections)
    return {
        "total_users": total_users,
        "banned_users": banned_users,
        "total_games": total_games,
        "finished_games": finished_games,
        "online_now": online_count,
    }


@api.get("/admin/users")
async def admin_list_users(
    admin: dict = Depends(get_current_admin),
    q: Optional[str] = None,
    limit: int = Query(100, le=500),
):
    query: dict = {}
    if q:
        query = {"$or": [
            {"email": {"$regex": q, "$options": "i"}},
            {"username": {"$regex": q, "$options": "i"}},
        ]}
    cur = db.users.find(query).sort("created_at", -1).limit(limit)
    return [public_user(d) async for d in cur]


@api.put("/admin/users/{user_id}")
async def admin_update_user(user_id: str, body: AdminUpdateIn, admin: dict = Depends(get_current_admin)):
    try:
        oid = ObjectId(user_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid id")
    update: dict = {}
    if body.rating is not None:
        update["rating"] = int(body.rating)
    if body.role is not None and body.role in ("user", "admin"):
        update["role"] = body.role
    if body.banned is not None:
        update["banned"] = bool(body.banned)
    if update:
        await db.users.update_one({"_id": oid}, {"$set": update})
    doc = await db.users.find_one({"_id": oid})
    if not doc:
        raise HTTPException(status_code=404, detail="Not found")
    return public_user(doc)


@api.delete("/admin/users/{user_id}")
async def admin_delete_user(user_id: str, admin: dict = Depends(get_current_admin)):
    try:
        oid = ObjectId(user_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid id")
    if str(oid) == admin["id"]:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    await db.users.delete_one({"_id": oid})
    return {"ok": True}


# ----------------------------------------------------------------------
# WebSocket — online play
# ----------------------------------------------------------------------
@api.websocket("/ws")
async def ws_endpoint(ws: WebSocket, token: str = Query(...)):
    payload = get_user_from_token(token)
    if not payload:
        await ws.close(code=4401)
        return
    uid = payload["sub"]
    user_doc = await db.users.find_one({"_id": ObjectId(uid)})
    if not user_doc or user_doc.get("banned"):
        await ws.close(code=4403)
        return
    info = {"username": user_doc.get("username", "Player"), "rating": int(user_doc.get("rating", DEFAULT_RATING))}
    await manager.connect(uid, info, ws)
    try:
        await manager.send(uid, {"type": "connected", "user": {"id": uid, **info}})
        while True:
            raw = await ws.receive_text()
            try:
                data = json.loads(raw)
            except Exception:
                continue
            t = data.get("type")
            if t == "queue_join":
                await manager.join_queue(uid, data.get("time_control"))
            elif t == "queue_leave":
                await manager.leave_queue(uid)
            elif t == "invite_create":
                await manager.create_invite(uid, data.get("time_control"))
            elif t == "invite_accept":
                await manager.accept_invite(uid, data.get("code", ""))
            elif t == "move":
                await manager.move(uid, data)
            elif t == "chat":
                await manager.chat(uid, data.get("message", ""))
            elif t == "resign":
                await manager.resign(uid)
            elif t == "lobby_stats":
                await manager.lobby_stats(uid)
    except WebSocketDisconnect:
        pass
    except Exception as e:
        log.warning("WS error: %s", e)
    finally:
        await manager.disconnect(uid)


# ----------------------------------------------------------------------
# Healthcheck
# ----------------------------------------------------------------------
@api.get("/")
async def root():
    return {"service": "voice-chess", "ok": True}


# ----------------------------------------------------------------------
# Wire & middleware
# ----------------------------------------------------------------------
app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


# ----------------------------------------------------------------------
# Startup
# ----------------------------------------------------------------------
@app.on_event("startup")
async def on_start():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("username_lc", unique=True)
    await db.login_attempts.create_index("identifier", unique=True)
    await db.games.create_index([("owner_id", 1), ("created_at", -1)])
    await db.friendships.create_index([("user_a", 1), ("user_b", 1)], unique=True)
    await db.friendships.create_index("status")

    admin_email = os.environ.get("ADMIN_EMAIL", "admin@example.com")
    admin_password = os.environ.get("ADMIN_PASSWORD", "admin123")
    admin_username = os.environ.get("ADMIN_USERNAME", "admin")

    existing = await db.users.find_one({"email": admin_email})
    if existing is None:
        await db.users.insert_one({
            "email": admin_email,
            "username": admin_username,
            "username_lc": admin_username.lower(),
            "password_hash": hash_password(admin_password),
            "name": "Admin",
            "bio": "Site administrator",
            "country": "",
            "avatar": "",
            "rating": 1500,
            "stats": {"wins": 0, "losses": 0, "draws": 0, "games": 0},
            "role": "admin",
            "banned": False,
            "board_theme": "obsidian",
            "piece_set": "classic",
            "sound_enabled": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "last_active": datetime.now(timezone.utc).isoformat(),
        })
        log.info("Admin user seeded: %s", admin_email)
    else:
        # ensure admin role + correct password if .env updated
        updates = {"role": "admin", "banned": False}
        if not verify_password(admin_password, existing["password_hash"]):
            updates["password_hash"] = hash_password(admin_password)
        await db.users.update_one({"_id": existing["_id"]}, {"$set": updates})


@app.on_event("shutdown")
async def on_stop():
    client.close()
