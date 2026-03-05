from datetime import datetime
from typing import Optional

from sqlmodel import Field, SQLModel


class PlacementResult(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", unique=True, index=True)
    vocab_score: int = Field(default=0)  # out of 5
    listening_score: int = Field(default=0)  # out of 3
    reading_score: int = Field(default=0)  # out of 3
    writing_score: int = Field(default=0)  # 0-100, AI-graded
    writing_feedback: str = Field(default="{}")  # JSON: {errors, strengths, level_tag}
    overall_level: str = Field(default="A1-Low")
    completed_at: datetime = Field(default_factory=datetime.utcnow)
