from datetime import date, datetime
from typing import Optional

from sqlmodel import Field, SQLModel


class WeeklyReport(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    week_start: date
    week_end: date
    report_json: str = Field(default="{}")  # JSON: {completion_rate, score_changes, ...}
    generated_at: datetime = Field(default_factory=datetime.utcnow)


class Roadmap(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", unique=True, index=True)
    phases_json: str = Field(default="[]")  # JSON: [{month, milestone, skill_weights}]
    generated_at: datetime = Field(default_factory=datetime.utcnow)
