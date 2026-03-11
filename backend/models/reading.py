from datetime import datetime
from typing import Optional
from sqlmodel import Field, SQLModel


class ReadingSession(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    content_type: str = Field(default="short_text")
    level: str = Field(default="A2")
    topic: str = Field(default="")
    score_pct: int = Field(default=0)
    total_questions: int = Field(default=0)
    correct_count: int = Field(default=0)
    date: datetime = Field(default_factory=datetime.utcnow)
    duration_seconds: Optional[int] = Field(default=None)
    passage_json: str = Field(default="{}")  # full passage + questions as JSON
