"""SM-2 spaced repetition algorithm — extracted from scripts/flashcard.py."""

from datetime import date, timedelta


def sm2_update(state: dict, quality: int) -> dict:
    """
    Update SM-2 state given a quality score.

    quality values:
      0 = Again (complete blackout)
      2 = Hard
      4 = Good
      5 = Easy
    """
    ef = state["ease_factor"]
    reps = state["repetitions"]
    interval = state["interval"]

    if quality == 0:  # Again
        reps = 0
        interval = 1
    else:
        if quality == 2:    # Hard
            ef = max(1.3, ef - 0.15)
        elif quality == 5:  # Easy
            ef = ef + 0.15
        # quality == 4 (Good): EF unchanged

        if reps == 0:
            interval = 1
        elif reps == 1:
            interval = 6
        else:
            interval = round(interval * ef)

        reps += 1

    next_review = (date.today() + timedelta(days=interval)).isoformat()
    return {
        "interval": interval,
        "ease_factor": round(ef, 4),
        "repetitions": reps,
        "next_review": next_review,
        "direction": state["direction"],
        "mastered": state.get("mastered", False),
    }


QUALITY_MAP = {
    "again": 0,
    "hard": 2,
    "good": 4,
    "easy": 5,
}
