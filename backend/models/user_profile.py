from datetime import date, datetime
from typing import Optional

from sqlmodel import Field, SQLModel


class UserProfile(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", unique=True, index=True)
    language: str = Field(default="en")  # "en" | "zh"
    planner_enabled: bool = Field(default=False)
    goal: Optional[str] = Field(default=None)  # "exam" | "everyday" | "work"
    timeline_months: Optional[int] = Field(default=None)  # 3 | 6 | 12
    daily_minutes: Optional[int] = Field(default=None)  # 30 | 60 | 90 | 120
    current_level: Optional[str] = Field(default=None)  # "A1-Low" | "A1" | "A1-High" | "A2-Entry"
    weak_skills: str = Field(default="[]")  # JSON array: ["listening", "writing"]
    onboarding_completed: bool = Field(default=False)
    placement_completed: bool = Field(default=False)
    start_date: Optional[date] = Field(default=None)
    exam_date: Optional[date] = Field(default=None)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
