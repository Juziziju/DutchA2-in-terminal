from datetime import datetime
from typing import Optional
from sqlmodel import Field, SQLModel


class SpeakingSession(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    scene: str = Field(default="")
    question_id: str = Field(default="")
    question_type: str = Field(default="short")  # "short" | "long"
    mode: str = Field(default="scene_drill")  # "scene_drill" | "mixed_drill" | "mock_exam"
    audio_file: Optional[str] = Field(default=None)
    transcript: Optional[str] = Field(default=None)
    feedback_json: str = Field(default="{}")
    score_pct: Optional[int] = Field(default=None)
    date: datetime = Field(default_factory=datetime.utcnow)
    duration_seconds: Optional[int] = Field(default=None)
