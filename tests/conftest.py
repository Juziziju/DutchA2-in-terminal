"""Shared test fixtures — in-memory SQLite DB, test client, auth helper."""

import pytest
from datetime import date, datetime, timedelta
from fastapi.testclient import TestClient
from sqlalchemy.pool import StaticPool
from sqlmodel import SQLModel, Session, create_engine

from backend.main import app
from backend.database import get_session
from backend.models.user import User
from backend.models.vocab import Vocab
from backend.models.progress import FlashcardProgress
from backend.models.review_log import FlashcardReviewLog
from backend.models.listening import ListeningSession
from backend.models.speaking import SpeakingSession
from backend.models.exam import ExamResult
from backend.core.auth import create_access_token, hash_password


@pytest.fixture(name="engine")
def engine_fixture():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)
    yield engine
    engine.dispose()


@pytest.fixture(name="session")
def session_fixture(engine):
    with Session(engine) as session:
        yield session


@pytest.fixture(name="client")
def client_fixture(engine):
    def override():
        with Session(engine) as session:
            yield session

    app.dependency_overrides[get_session] = override
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture(name="user")
def user_fixture(session):
    user = User(username="testuser", hashed_password=hash_password("testpass123"))
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


@pytest.fixture(name="auth_headers")
def auth_headers_fixture(user):
    token = create_access_token({"sub": str(user.id)})
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(name="sample_vocab")
def sample_vocab_fixture(session):
    words = []
    for i in range(5):
        v = Vocab(dutch=f"woord{i}", english=f"word{i}", category="test", example_dutch=f"voorbeeld {i}", example_english=f"example {i}", audio_file=f"w{i}.mp3")
        session.add(v)
        words.append(v)
    session.commit()
    for v in words:
        session.refresh(v)
    return words
