"""SQLModel database engine + session dependency."""

from sqlmodel import SQLModel, Session, create_engine
from backend.config import DATABASE_URL

def _make_engine():
    kwargs = {}
    if DATABASE_URL.startswith("sqlite"):
        kwargs["connect_args"] = {"check_same_thread": False}
    return create_engine(DATABASE_URL, **kwargs)


engine = _make_engine()


def create_db_and_tables():
    SQLModel.metadata.create_all(engine)


def get_session():
    with Session(engine) as session:
        yield session
