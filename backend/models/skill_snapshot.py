from datetime import date
from typing import Optional

from sqlmodel import Field, SQLModel


class SkillSnapshot(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    skill: str = Field(index=True)  # "listening" | "reading" | "writing" | "vocabulary"
    assessed_level: str = Field(default="A1")
    avg_score: int = Field(default=0)  # rolling 7-day average
    snapshot_date: date = Field(default_factory=date.today)
