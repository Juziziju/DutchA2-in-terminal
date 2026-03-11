from datetime import datetime
from typing import Optional
from sqlmodel import Field, SQLModel


class KNMSession(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    category: str = Field(default="")
    score_pct: int = Field(default=0)
    total_questions: int = Field(default=0)
    correct_count: int = Field(default=0)
    date: datetime = Field(default_factory=datetime.utcnow)
    log_json: str = Field(default="{}")
