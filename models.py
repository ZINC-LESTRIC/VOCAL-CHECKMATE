"""Pydantic schemas for request/response bodies."""
from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, EmailStr, Field


class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)
    username: str = Field(min_length=3, max_length=24)


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class UpdateProfileIn(BaseModel):
    username: Optional[str] = Field(default=None, min_length=3, max_length=24)
    name: Optional[str] = Field(default=None, max_length=80)
    bio: Optional[str] = Field(default=None, max_length=400)
    country: Optional[str] = Field(default=None, max_length=60)
    avatar: Optional[str] = Field(default=None, max_length=200000)  # data URL allowed
    board_theme: Optional[str] = Field(default=None, max_length=40)
    piece_set: Optional[str] = Field(default=None, max_length=40)
    sound_enabled: Optional[bool] = None


class ChangePasswordIn(BaseModel):
    current_password: str
    new_password: str = Field(min_length=6, max_length=128)


class CreateGameIn(BaseModel):
    mode: str  # "ai" | "local" | "online"
    color: str = "white"  # white | black | random
    engine_level: Optional[int] = None  # 1..8
    time_control: Optional[str] = None  # "5+0", "10+0", "unlimited"
    opponent_id: Optional[str] = None


class FinishGameIn(BaseModel):
    pgn: str
    moves: List[str] = Field(default_factory=list)
    final_fen: str
    result: str  # "white" | "black" | "draw" | "aborted"
    termination: Optional[str] = None  # "checkmate" | "resign" | "stalemate" | etc.


class AdminUpdateIn(BaseModel):
    rating: Optional[int] = None
    role: Optional[str] = None
    banned: Optional[bool] = None


class FriendRequestIn(BaseModel):
    username: str = Field(min_length=3, max_length=24)

