"""Online multiplayer WebSocket manager (lobby + game rooms)."""
from __future__ import annotations

import asyncio
import json
import secrets
from typing import Dict, Set

from fastapi import WebSocket


class WSManager:
    """Track connections, lobby waiters, and active rooms in memory."""

    def __init__(self) -> None:
        # user_id -> WebSocket
        self.connections: Dict[str, WebSocket] = {}
        # user info cache: user_id -> {username, rating}
        self.users: Dict[str, dict] = {}
        # waiting matchmaking queue: tc_label -> list of user_ids
        self.queue: Dict[str, list[str]] = {}
        # invite codes: code -> {creator, time_control}
        self.invites: Dict[str, dict] = {}
        # room_id -> { white, black, fen, moves, time_control, ... }
        self.rooms: Dict[str, dict] = {}
        # user_id -> room_id
        self.user_room: Dict[str, str] = {}
        self.lock = asyncio.Lock()

    async def connect(self, user_id: str, info: dict, ws: WebSocket) -> None:
        await ws.accept()
        # close any existing connection for same user
        prev = self.connections.get(user_id)
        if prev is not None:
            try:
                await prev.close()
            except Exception:
                pass
        self.connections[user_id] = ws
        self.users[user_id] = info

    async def disconnect(self, user_id: str) -> None:
        self.connections.pop(user_id, None)
        for bucket in self.queue.values():
            if user_id in bucket:
                bucket.remove(user_id)
        # notify opponent
        room_id = self.user_room.get(user_id)
        if room_id:
            room = self.rooms.get(room_id)
            if room:
                opponent_id = room["black"] if room["white"] == user_id else room["white"]
                await self.send(opponent_id, {"type": "opponent_disconnect"})

    async def send(self, user_id: str, payload: dict) -> None:
        ws = self.connections.get(user_id)
        if ws is None:
            return
        try:
            await ws.send_text(json.dumps(payload))
        except Exception:
            self.connections.pop(user_id, None)

    async def join_queue(self, user_id: str, time_control: str | None = None) -> None:
        tc = time_control or "10+0"
        async with self.lock:
            bucket = self.queue.setdefault(tc, [])
            if user_id in bucket:
                return
            if bucket:
                other = bucket.pop(0)
                await self._start_game(other, user_id, tc)
                return
            bucket.append(user_id)
            await self.send(user_id, {"type": "queue_joined", "time_control": tc})

    async def leave_queue(self, user_id: str) -> None:
        async with self.lock:
            for bucket in self.queue.values():
                if user_id in bucket:
                    bucket.remove(user_id)
            await self.send(user_id, {"type": "queue_left"})

    async def create_invite(self, user_id: str, time_control: str | None = None) -> str:
        code = secrets.token_urlsafe(4).upper().replace("_", "A").replace("-", "B")[:6]
        self.invites[code] = {"creator": user_id, "time_control": time_control or "10+0"}
        await self.send(user_id, {"type": "invite_created", "code": code, "time_control": time_control or "10+0"})
        return code

    async def accept_invite(self, user_id: str, code: str) -> None:
        info = self.invites.pop(code.upper(), None)
        if not info or info["creator"] == user_id:
            await self.send(user_id, {"type": "error", "message": "Invalid invite code"})
            return
        creator = info["creator"]
        if creator not in self.connections:
            await self.send(user_id, {"type": "error", "message": "Inviter offline"})
            return
        await self._start_game(creator, user_id, info["time_control"])

    async def _start_game(self, p1: str, p2: str, time_control: str = "10+0") -> None:
        import random
        white, black = (p1, p2) if random.random() < 0.5 else (p2, p1)
        room_id = secrets.token_hex(6)
        self.rooms[room_id] = {
            "white": white,
            "black": black,
            "time_control": time_control,
            "fen": "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
            "moves": [],
            "result": None,
        }
        self.user_room[white] = room_id
        self.user_room[black] = room_id
        for uid, color in ((white, "white"), (black, "black")):
            opp = black if color == "white" else white
            await self.send(uid, {
                "type": "game_start",
                "room_id": room_id,
                "color": color,
                "time_control": time_control,
                "opponent": self.users.get(opp, {"username": "Opponent", "rating": 1200}),
            })

    async def move(self, user_id: str, data: dict) -> None:
        room_id = self.user_room.get(user_id)
        if not room_id:
            return
        room = self.rooms.get(room_id)
        if not room:
            return
        room["moves"].append(data.get("san", ""))
        room["fen"] = data.get("fen", room["fen"])
        opponent_id = room["black"] if room["white"] == user_id else room["white"]
        await self.send(opponent_id, {
            "type": "move",
            "from": data.get("from"),
            "to": data.get("to"),
            "promotion": data.get("promotion"),
            "san": data.get("san"),
            "fen": data.get("fen"),
            "clock": data.get("clock"),
        })

    async def chat(self, user_id: str, message: str) -> None:
        room_id = self.user_room.get(user_id)
        if not room_id:
            return
        room = self.rooms.get(room_id)
        if not room:
            return
        opponent_id = room["black"] if room["white"] == user_id else room["white"]
        info = self.users.get(user_id, {})
        await self.send(opponent_id, {
            "type": "chat",
            "from": info.get("username", "Opponent"),
            "message": message[:300],
        })

    async def resign(self, user_id: str) -> None:
        room_id = self.user_room.get(user_id)
        if not room_id:
            return
        room = self.rooms.get(room_id)
        if not room:
            return
        opponent_id = room["black"] if room["white"] == user_id else room["white"]
        await self.send(opponent_id, {"type": "opponent_resign"})
        room["result"] = "resign"

    async def lobby_stats(self, user_id: str) -> None:
        queued = sum(len(b) for b in self.queue.values())
        await self.send(user_id, {
            "type": "lobby_stats",
            "online": len(self.connections),
            "queued": queued,
        })


manager = WSManager()
