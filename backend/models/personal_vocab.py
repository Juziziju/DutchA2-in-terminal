from datetime import date, datetime
from typing import Optional
from sqlmodel import Field, SQLModel


class PersonalVocab(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    dutch: str = Field(index=True)
    english: str
    source: str = Field(default="reading")  # "reading" | "knm" | "manual"
    context_sentence: str = Field(default="")
    notes: str = Field(default="")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    # Inline SM-2 fields
    interval: int = Field(default=1)
    ease_factor: float = Field(default=2.5)
    repetitions: int = Field(default=0)
    next_review: date = Field(default_factory=date.today)
    mastered: bool = Field(default=False)
