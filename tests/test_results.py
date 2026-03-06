"""Test results endpoints — flashcard stats, listening history, streak."""

from datetime import date, datetime, timedelta
from backend.models.progress import FlashcardProgress
from backend.models.review_log import FlashcardReviewLog
from backend.models.listening import ListeningSession
from backend.models.speaking import SpeakingSession
from backend.models.exam import ExamResult


def test_flashcard_stats(client, auth_headers, sample_vocab, session, user):
    # Create some progress
    prog = FlashcardProgress(
        user_id=user.id, vocab_id=sample_vocab[0].id, direction="nl_en",
        repetitions=3, mastered=False, next_review=date.today(),
    )
    prog2 = FlashcardProgress(
        user_id=user.id, vocab_id=sample_vocab[1].id, direction="nl_en",
        repetitions=5, mastered=True,
    )
    session.add_all([prog, prog2])
    session.commit()

    resp = client.get("/results/flashcards", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["total_cards"] == 5  # 5 sample vocab
    assert data["mastered"] == 1
    assert data["due_today"] == 1
    assert data["total_reviewed"] == 2


def test_listening_history(client, auth_headers, session, user):
    ls = ListeningSession(
        user_id=user.id, topic="Test topic", score_pct=80,
        mode="quiz", level="A2",
    )
    session.add(ls)
    session.commit()

    resp = client.get("/results/listening", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["topic"] == "Test topic"
    assert data[0]["score_pct"] == 80


def test_streak_empty(client, auth_headers):
    """No activity → streak = 0."""
    resp = client.get("/results/streak", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["streak"] == 0


def test_streak_today_only(client, auth_headers, session, user):
    """Activity only today → streak = 1."""
    session.add(FlashcardReviewLog(
        user_id=user.id, vocab_id=1, direction="nl_en", rating="good",
    ))
    session.commit()

    resp = client.get("/results/streak", headers=auth_headers)
    assert resp.json()["streak"] == 1


def test_streak_consecutive_days(client, auth_headers, session, user):
    """Activity on 3 consecutive days (today, yesterday, day before) → streak = 3."""
    now = datetime.utcnow()
    for days_ago in range(3):
        session.add(FlashcardReviewLog(
            user_id=user.id, vocab_id=1, direction="nl_en", rating="good",
            created_at=now - timedelta(days=days_ago),
        ))
    session.commit()

    resp = client.get("/results/streak", headers=auth_headers)
    assert resp.json()["streak"] == 3


def test_streak_gap_breaks_streak(client, auth_headers, session, user):
    """Activity today and 3 days ago (gap yesterday) → streak = 1."""
    now = datetime.utcnow()
    session.add(FlashcardReviewLog(
        user_id=user.id, vocab_id=1, direction="nl_en", rating="good",
        created_at=now,
    ))
    session.add(FlashcardReviewLog(
        user_id=user.id, vocab_id=1, direction="nl_en", rating="good",
        created_at=now - timedelta(days=3),
    ))
    session.commit()

    resp = client.get("/results/streak", headers=auth_headers)
    assert resp.json()["streak"] == 1


def test_streak_counts_all_activities(client, auth_headers, session, user):
    """Streak combines flashcards, listening, speaking, and exams."""
    now = datetime.utcnow()
    # Today: flashcard review
    session.add(FlashcardReviewLog(
        user_id=user.id, vocab_id=1, direction="nl_en", rating="good",
        created_at=now,
    ))
    # Yesterday: listening session
    session.add(ListeningSession(
        user_id=user.id, topic="test", score_pct=70, mode="quiz",
        date=now - timedelta(days=1),
    ))
    # Day before: speaking session
    session.add(SpeakingSession(
        user_id=user.id, scene="self_intro", question_id="si_s1",
        question_type="short", mode="scene_drill", score_pct=60,
        date=now - timedelta(days=2),
    ))
    # 3 days ago: exam
    session.add(ExamResult(
        user_id=user.id, source="ai", scores_json='{}', avg_score=75, passed=True,
        date=now - timedelta(days=3),
    ))
    session.commit()

    resp = client.get("/results/streak", headers=auth_headers)
    assert resp.json()["streak"] == 4


def test_exam_results(client, auth_headers, session, user):
    session.add(ExamResult(
        user_id=user.id, source="ai", scores_json='{"reading": 80}',
        avg_score=80, passed=True,
    ))
    session.commit()

    resp = client.get("/results/exam", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["passed"] is True


def test_flashcard_trend(client, auth_headers, session, user):
    now = datetime.utcnow()
    for rating in ["good", "good", "again"]:
        session.add(FlashcardReviewLog(
            user_id=user.id, vocab_id=1, direction="nl_en",
            rating=rating, created_at=now,
        ))
    session.commit()

    resp = client.get("/results/flashcards/trend", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["reviewed"] == 3
    # 2 out of 3 are "good" (correct)
    assert data[0]["correct_pct"] == 67
