"""Test flashcard session, review, and due-card priority."""

from datetime import date, timedelta
from backend.models.progress import FlashcardProgress


def test_session_returns_cards(client, auth_headers, sample_vocab):
    resp = client.get("/flashcards/session", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["cards"]) > 0
    assert data["new_count"] > 0


def test_session_empty_vocab(client, auth_headers):
    """No vocab → no cards."""
    resp = client.get("/flashcards/session", headers=auth_headers)
    assert resp.status_code == 200
    assert len(resp.json()["cards"]) == 0


def test_due_cards_appear_first(client, auth_headers, sample_vocab, session, user):
    """Due cards should appear before new cards in the session."""
    # Create a due progress record for the first vocab
    prog = FlashcardProgress(
        user_id=user.id,
        vocab_id=sample_vocab[0].id,
        direction="nl_en",
        repetitions=1,
        next_review=date.today() - timedelta(days=1),  # overdue
    )
    session.add(prog)
    session.commit()

    resp = client.get("/flashcards/session?directions=nl_en", headers=auth_headers)
    data = resp.json()
    assert data["due_count"] >= 1
    # First card should be the due card (not new)
    assert data["cards"][0]["is_new"] is False
    assert data["cards"][0]["vocab_id"] == sample_vocab[0].id


def test_due_cards_capped_session(client, auth_headers, session, user):
    """When many due cards exist, new cards get limited to fit session."""
    from backend.models.vocab import Vocab
    # Create 35 vocab items with due progress
    for i in range(35):
        v = Vocab(dutch=f"due_word_{i}", english=f"due_{i}", category="test")
        session.add(v)
        session.flush()
        prog = FlashcardProgress(
            user_id=user.id,
            vocab_id=v.id,
            direction="nl_en",
            repetitions=2,
            next_review=date.today() - timedelta(days=1),
        )
        session.add(prog)
    # Also add some new vocab
    for i in range(10):
        v = Vocab(dutch=f"new_word_{i}", english=f"new_{i}", category="test")
        session.add(v)
    session.commit()

    resp = client.get("/flashcards/session?directions=nl_en", headers=auth_headers)
    data = resp.json()
    # Should have all 35 due cards, and 0 new (since 35 >= MAX_SESSION=30... wait, all due are included)
    assert data["due_count"] == 35
    # New count should be 0 since due >= MAX_SESSION
    assert data["new_count"] == 0


def test_review_creates_progress(client, auth_headers, sample_vocab):
    resp = client.post("/flashcards/review", headers=auth_headers, json={
        "progress_id": -1,
        "vocab_id": sample_vocab[0].id,
        "direction": "nl_en",
        "rating": "good",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["interval"] >= 1
    assert data["mastered"] is False


def test_review_mastered(client, auth_headers, sample_vocab):
    resp = client.post("/flashcards/review", headers=auth_headers, json={
        "progress_id": -1,
        "vocab_id": sample_vocab[0].id,
        "direction": "nl_en",
        "rating": "mastered",
    })
    assert resp.status_code == 200
    assert resp.json()["mastered"] is True


def test_mastered_cards_excluded(client, auth_headers, sample_vocab, session, user):
    """Mastered cards should not appear in sessions."""
    prog = FlashcardProgress(
        user_id=user.id,
        vocab_id=sample_vocab[0].id,
        direction="nl_en",
        mastered=True,
        repetitions=5,
    )
    session.add(prog)
    session.commit()

    resp = client.get("/flashcards/session?directions=nl_en", headers=auth_headers)
    data = resp.json()
    card_ids = [c["vocab_id"] for c in data["cards"]]
    # The mastered card might still appear via en_nl if we query both
    # But with nl_en only, the mastered one should be excluded
    mastered_in_session = [c for c in data["cards"] if c["vocab_id"] == sample_vocab[0].id and c["direction"] == "nl_en"]
    assert len(mastered_in_session) == 0


def test_review_invalid_rating(client, auth_headers, sample_vocab):
    resp = client.post("/flashcards/review", headers=auth_headers, json={
        "progress_id": -1,
        "vocab_id": sample_vocab[0].id,
        "direction": "nl_en",
        "rating": "invalid_rating",
    })
    assert resp.status_code == 400
