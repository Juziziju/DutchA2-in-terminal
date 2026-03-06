from datetime import datetime
from typing import Optional
from sqlmodel import Field, SQLModel


class CustomScene(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    scene_id: str = Field(index=True)  # e.g. "custom_1_1678..."
    title_en: str = Field(default="")
    title_nl: str = Field(default="")
    level: str = Field(default="A2")
    vocab_json: str = Field(default="[]")  # JSON array of {dutch, english, example}
    sentences_json: str = Field(default="[]")  # JSON array of {text, english}
    questions_json: str = Field(default='{"short":[],"long":[]}')  # exam questions
    created_at: datetime = Field(default_factory=datetime.utcnow)
