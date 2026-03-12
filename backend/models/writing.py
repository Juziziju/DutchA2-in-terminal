from datetime import datetime
from typing import Optional
from sqlmodel import Field, SQLModel


class WritingSession(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    task_type: str = Field(default="email")  # "email" | "kort_verhaal" | "formulier"
    topic: str = Field(default="")
    score_pct: Optional[int] = Field(default=None)
    date: datetime = Field(default_factory=datetime.utcnow)
    duration_seconds: Optional[int] = Field(default=None)
    prompt_json: str = Field(default="{}")  # full prompt as JSON
    response_text: str = Field(default="")  # user's writing
    feedback_json: str = Field(default="{}")  # AI review as JSON


class WritingErrorWeight(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    error_category: str = Field(default="")
    count: int = Field(default=0)
    last_seen: datetime = Field(default_factory=datetime.utcnow)
