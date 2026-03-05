from datetime import datetime
from typing import Optional
from sqlmodel import Field, SQLModel


class ExamResult(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    date: datetime = Field(default_factory=datetime.utcnow)
    source: str = Field(default="ai")  # "official" | "ai"
    scores_json: str = Field(default="{}")  # section_code → score
    avg_score: Optional[int] = Field(default=None)
    passed: bool = Field(default=False)
