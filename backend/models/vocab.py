from typing import Optional
from sqlmodel import Field, SQLModel


class Vocab(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    dutch: str = Field(index=True)
    english: str
    category: str = Field(default="General")
    example_dutch: str = Field(default="")
    example_english: str = Field(default="")
    audio_file: str = Field(default="")  # relative filename inside audio/
