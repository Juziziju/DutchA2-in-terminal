from datetime import datetime
from typing import Optional
from sqlmodel import Field, SQLModel


class ListeningSession(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    topic: str = Field(default="")
    score_pct: int = Field(default=0)
    mode: str = Field(default="quiz")  # "quiz" | "intensive"
    level: Optional[str] = Field(default=None)  # "A1" | "A2" | "B1"
    content_type: Optional[str] = Field(default=None)  # "dialogue" | "news" | "article"
    duration_seconds: Optional[int] = Field(default=None)
    date: datetime = Field(default_factory=datetime.utcnow)
    log_json: str = Field(default="{}")  # full session data as JSON string
