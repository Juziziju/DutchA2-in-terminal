"""Sprint progress tracking model."""

from datetime import datetime
from typing import Optional

from sqlmodel import Field, SQLModel


class SprintProgress(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    sprint_day: int = Field(index=True)  # 1-20
    vocab_reviewed: int = Field(default=0)
    vocab_mastered: int = Field(default=0)
    speaking_sessions: int = Field(default=0)
    speaking_avg_score: Optional[int] = Field(default=None)
    completed: bool = Field(default=False)
    completed_at: Optional[datetime] = Field(default=None)
    created_at: datetime = Field(default_factory=datetime.utcnow)
