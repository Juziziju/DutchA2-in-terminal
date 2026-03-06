"""Pure data aggregation functions for speaking analytics — no LLM calls."""

import json
from collections import Counter, defaultdict
from datetime import date, datetime, timedelta
from typing import Any

from backend.models.speaking import SpeakingSession


def _parse_feedback(session: SpeakingSession) -> dict:
    try:
        return json.loads(session.feedback_json) if session.feedback_json else {}
    except (json.JSONDecodeError, TypeError):
        return {}


def _session_date(session: SpeakingSession) -> date:
    if isinstance(session.date, datetime):
        return session.date.date()
    if isinstance(session.date, date):
        return session.date
    return datetime.fromisoformat(str(session.date)).date()


def aggregate_missed_words(sessions: list[SpeakingSession]) -> list[dict]:
    """Top 20 missed phrases from non-shadow sessions."""
    counts: Counter[str] = Counter()
    last_seen: dict[str, str] = {}
    for s in sessions:
        if s.mode == "shadow_reading":
            continue
        fb = _parse_feedback(s)
        for phrase in fb.get("missing_phrases", []):
            p = phrase.strip().lower()
            if not p:
                continue
            counts[p] += 1
            d = s.date.isoformat() if s.date else ""
            if p not in last_seen or d > last_seen[p]:
                last_seen[p] = d
    return [
        {"phrase": phrase, "count": count, "last_seen": last_seen.get(phrase, "")}
        for phrase, count in counts.most_common(20)
    ]


def aggregate_shadow_misses(sessions: list[SpeakingSession]) -> list[dict]:
    """Top 15 missed words from shadow reading sessions."""
    counts: Counter[str] = Counter()
    for s in sessions:
        if s.mode != "shadow_reading":
            continue
        fb = _parse_feedback(s)
        for word in fb.get("word_misses", []):
            w = word.strip().lower()
            if w:
                counts[w] += 1
    return [
        {"word": word, "miss_count": count}
        for word, count in counts.most_common(15)
    ]


def aggregate_grammar_errors(sessions: list[SpeakingSession]) -> list[dict]:
    """Top 10 grammar errors from non-shadow sessions."""
    error_key_count: Counter[tuple[str, str]] = Counter()
    for s in sessions:
        if s.mode == "shadow_reading":
            continue
        fb = _parse_feedback(s)
        for ge in fb.get("grammar_errors", []):
            if isinstance(ge, dict) and "error" in ge and "correction" in ge:
                key = (ge["error"].strip(), ge["correction"].strip())
                error_key_count[key] += 1
    return [
        {"error": err, "correction": corr, "count": count}
        for (err, corr), count in error_key_count.most_common(10)
    ]


def compute_weekly_trends(sessions: list[SpeakingSession]) -> list[dict]:
    """Last 12 weeks: avg scores and session counts."""
    today = date.today()
    # Monday of this week
    start_of_week = today - timedelta(days=today.weekday())
    weeks: list[dict] = []

    for i in range(12):
        week_start = start_of_week - timedelta(weeks=11 - i)
        week_end = week_start + timedelta(days=6)
        week_sessions = [
            s for s in sessions
            if week_start <= _session_date(s) <= week_end
        ]
        scores = [s.score_pct for s in week_sessions if s.score_pct is not None]
        vocab_scores = []
        grammar_scores = []
        completeness_scores = []
        for s in week_sessions:
            fb = _parse_feedback(s)
            if "vocabulary_score" in fb:
                vocab_scores.append(fb["vocabulary_score"])
            if "grammar_score" in fb:
                grammar_scores.append(fb["grammar_score"])
            if "completeness_score" in fb:
                completeness_scores.append(fb["completeness_score"])

        weeks.append({
            "week": week_start.isoformat(),
            "avg_score": round(sum(scores) / len(scores)) if scores else None,
            "avg_vocab": round(sum(vocab_scores) / len(vocab_scores)) if vocab_scores else None,
            "avg_grammar": round(sum(grammar_scores) / len(grammar_scores)) if grammar_scores else None,
            "avg_completeness": round(sum(completeness_scores) / len(completeness_scores)) if completeness_scores else None,
            "session_count": len(week_sessions),
        })
    return weeks


def compute_weak_areas(sessions: list[SpeakingSession]) -> dict:
    """Sub-score averages for non-shadow sessions in the last 30 days."""
    cutoff = date.today() - timedelta(days=30)
    recent = [
        s for s in sessions
        if s.mode != "shadow_reading" and _session_date(s) >= cutoff
    ]
    vocab_scores = []
    grammar_scores = []
    completeness_scores = []
    for s in recent:
        fb = _parse_feedback(s)
        if "vocabulary_score" in fb:
            vocab_scores.append(fb["vocabulary_score"])
        if "grammar_score" in fb:
            grammar_scores.append(fb["grammar_score"])
        if "completeness_score" in fb:
            completeness_scores.append(fb["completeness_score"])

    vocab_avg = round(sum(vocab_scores) / len(vocab_scores)) if vocab_scores else None
    grammar_avg = round(sum(grammar_scores) / len(grammar_scores)) if grammar_scores else None
    completeness_avg = round(sum(completeness_scores) / len(completeness_scores)) if completeness_scores else None

    avgs = {"vocabulary": vocab_avg, "grammar": grammar_avg, "completeness": completeness_avg}
    valid = {k: v for k, v in avgs.items() if v is not None}
    weakest = min(valid, key=lambda k: valid[k]) if valid else None
    strongest = max(valid, key=lambda k: valid[k]) if valid else None

    return {
        "weakest": weakest,
        "strongest": strongest,
        "vocab_avg": vocab_avg,
        "grammar_avg": grammar_avg,
        "completeness_avg": completeness_avg,
    }


def compute_mode_stats(sessions: list[SpeakingSession]) -> dict:
    """Counts by mode and by scene."""
    by_mode: Counter[str] = Counter()
    by_scene: Counter[str] = Counter()
    for s in sessions:
        by_mode[s.mode] += 1
        by_scene[s.scene] += 1
    return {
        "by_mode": dict(by_mode),
        "by_scene": dict(by_scene),
    }


def compute_comparison(sessions: list[SpeakingSession]) -> dict:
    """This week vs last week average score."""
    today = date.today()
    start_of_week = today - timedelta(days=today.weekday())
    start_of_last_week = start_of_week - timedelta(weeks=1)

    this_week = [
        s.score_pct for s in sessions
        if s.score_pct is not None and _session_date(s) >= start_of_week
    ]
    last_week = [
        s.score_pct for s in sessions
        if s.score_pct is not None and start_of_last_week <= _session_date(s) < start_of_week
    ]

    tw_avg = round(sum(this_week) / len(this_week)) if this_week else None
    lw_avg = round(sum(last_week) / len(last_week)) if last_week else None
    delta = (tw_avg - lw_avg) if tw_avg is not None and lw_avg is not None else None

    return {
        "this_week_avg": tw_avg,
        "last_week_avg": lw_avg,
        "delta": delta,
    }
