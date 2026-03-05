from datetime import date
from typing import Optional
from sqlmodel import Field, SQLModel


class FlashcardProgress(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    vocab_id: int = Field(foreign_key="vocab.id", index=True)
    direction: str  # "nl_en" | "en_nl"
    interval: int = Field(default=1)
    ease_factor: float = Field(default=2.5)
    repetitions: int = Field(default=0)
    next_review: date = Field(default_factory=date.today)
    mastered: bool = Field(default=False)
