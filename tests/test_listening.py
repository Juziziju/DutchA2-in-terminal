"""Test listening endpoints — basic validation (actual LLM calls mocked)."""

from datetime import datetime
from backend.models.listening import ListeningSession


def test_listening_submit(client, auth_headers, session, user, sample_vocab):
    """Test submitting listening answers (doesn't need LLM)."""
    resp = client.post("/listening/submit", headers=auth_headers, json={
        "session_id": "test_123",
        "topic": "At the bakery",
        "dialogue": [
            {"speaker": "A", "text": "Hallo", "english": "Hello"},
            {"speaker": "B", "text": "Dag", "english": "Bye"},
        ],
        "questions": [
            {"question": "Wie zegt hallo?", "options": {"A": "A", "B": "B", "C": "C", "D": "D"}, "answer": "A"},
        ],
        "user_answers": ["A"],
        "vocab_used": ["hallo"],
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["score"] == 1
    assert data["total"] == 1
    assert data["score_pct"] == 100
    assert data["correct"] == [True]


def test_listening_submit_wrong_answer(client, auth_headers, session, user, sample_vocab):
    resp = client.post("/listening/submit", headers=auth_headers, json={
        "session_id": "test_456",
        "topic": "Test",
        "dialogue": [{"speaker": "A", "text": "Hoi", "english": "Hi"}],
        "questions": [
            {"question": "Q?", "options": {"A": "a", "B": "b", "C": "c", "D": "d"}, "answer": "A"},
        ],
        "user_answers": ["B"],
        "vocab_used": [],
    })
    data = resp.json()
    assert data["score"] == 0
    assert data["score_pct"] == 0
    assert data["correct"] == [False]


def test_listening_submit_answer_count_mismatch(client, auth_headers, sample_vocab):
    resp = client.post("/listening/submit", headers=auth_headers, json={
        "session_id": "test_789",
        "topic": "Test",
        "dialogue": [],
        "questions": [
            {"question": "Q?", "options": {"A": "a", "B": "b", "C": "c", "D": "d"}, "answer": "A"},
        ],
        "user_answers": [],  # 0 answers for 1 question
        "vocab_used": [],
    })
    assert resp.status_code == 400


def test_intensive_submit(client, auth_headers, session, user, sample_vocab):
    resp = client.post("/listening/submit-intensive", headers=auth_headers, json={
        "session_id": "int_001",
        "topic": "Dictation test",
        "lines": [
            {"speaker": "A", "text": "Ik ga naar huis", "english": "I go home"},
            {"speaker": "A", "text": "Het is laat", "english": "It is late"},
        ],
        "user_texts": ["Ik ga naar huis", "Het is vroeg"],
        "vocab_used": [],
        "level": "A2",
        "content_type": "dialogue",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["score_pct"] == 50  # 1 out of 2 correct
    assert data["results"][0]["correct"] is True
    assert data["results"][1]["correct"] is False
