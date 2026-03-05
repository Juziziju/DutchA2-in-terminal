from datetime import date, datetime
from typing import Optional

from sqlmodel import Field, SQLModel, UniqueConstraint


class DailyPlan(SQLModel, table=True):
    __table_args__ = (UniqueConstraint("user_id", "plan_date"),)

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    plan_date: date = Field(index=True)
    focus_headline: str = Field(default="")
    coach_message: str = Field(default="")
    progress_note: str = Field(default="")
    tasks_json: str = Field(default="[]")  # JSON array of task objects
    generated_at: datetime = Field(default_factory=datetime.utcnow)


class TaskLog(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    plan_id: int = Field(foreign_key="dailyplan.id", index=True)
    task_index: int = Field(default=0)
    task_type: str = Field(default="")  # "vocab_review" | "listening_quiz" | "intensive" | "reading" | "writing" | "shadow_reading"
    status: str = Field(default="pending")  # "pending" | "completed" | "skipped"
    score: Optional[int] = Field(default=None)
    time_spent_seconds: Optional[int] = Field(default=None)
    difficulty: Optional[str] = Field(default=None)
    completed_at: Optional[datetime] = Field(default=None)
    created_at: datetime = Field(default_factory=datetime.utcnow)
