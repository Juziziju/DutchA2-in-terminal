#!/usr/bin/env python3
"""Dutch A2 flashcard system using SM-2 spaced repetition."""

import csv
import json
import os
import random
import subprocess
import sys
import termios
import tty
from datetime import date, timedelta
from pathlib import Path

# Paths
SCRIPT_DIR = Path(__file__).parent
VAULT_DIR = SCRIPT_DIR.parent
VOCAB_CSV = VAULT_DIR / "vocab_input.csv"
AUDIO_DIR = VAULT_DIR / "audio"
PROGRESS_JSON = SCRIPT_DIR / "progress.json"

MAX_NEW_CARDS = 20


# ── Terminal helpers ────────────────────────────────────────────────────────

def getch():
    """Read a single keypress without Enter. Returns named strings for arrow keys."""
    fd = sys.stdin.fileno()
    old = termios.tcgetattr(fd)
    try:
        tty.setraw(fd)
        ch = sys.stdin.read(1)
        if ch == "\x1b":
            # Arrow keys send ESC [ <letter> — all 3 bytes arrive together
            ch2 = sys.stdin.read(1)
            ch3 = sys.stdin.read(1)
            if ch2 == "[":
                if ch3 == "C": return "RIGHT"
                if ch3 == "B": return "DOWN"
            return "\x1b"
        return ch
    finally:
        termios.tcsetattr(fd, termios.TCSADRAIN, old)


def clear():
    os.system("clear")


# ── Vocab loading ───────────────────────────────────────────────────────────

def load_vocab():
    words = []
    with open(VOCAB_CSV, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            words.append({
                "dutch": row["dutch"].strip(),
                "english": row["english"].strip(),
                "example_dutch": row.get("example_dutch", "").strip(),
                "example_english": row.get("example_english", "").strip(),
            })
    return words


# ── Progress persistence ────────────────────────────────────────────────────

def load_progress():
    if PROGRESS_JSON.exists():
        with open(PROGRESS_JSON, encoding="utf-8") as f:
            return json.load(f)
    return {}


def save_progress(progress):
    with open(PROGRESS_JSON, "w", encoding="utf-8") as f:
        json.dump(progress, f, indent=2, ensure_ascii=False)


def card_key(dutch_word, direction):
    return f"{dutch_word}_{direction}"


def default_card_state(direction):
    return {
        "interval": 1,
        "ease_factor": 2.5,
        "repetitions": 0,
        "next_review": date.today().isoformat(),
        "direction": direction,
        "mastered": False,
    }


def mark_mastered(word, progress):
    """Mark both directions of a word as mastered."""
    for direction in ("nl_en", "en_nl"):
        key = card_key(word["dutch"], direction)
        if key not in progress:
            progress[key] = default_card_state(direction)
        progress[key]["mastered"] = True


# ── SM-2 algorithm ──────────────────────────────────────────────────────────

def sm2_update(state, quality):
    """Update SM-2 state given quality score (0=Again,2=Hard,4=Good,5=Easy)."""
    ef = state["ease_factor"]
    reps = state["repetitions"]
    interval = state["interval"]

    if quality == 0:  # Again
        reps = 0
        interval = 1
    else:
        if quality == 2:    # Hard
            ef = max(1.3, ef - 0.15)
            # interval stays
        elif quality == 4:  # Good
            pass            # EF unchanged
        elif quality == 5:  # Easy
            ef = ef + 0.15

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
    }


RATING_MAP = {
    "1": ("Again", 0),
    "2": ("Hard",  2),
    "3": ("Good",  4),
    "4": ("Easy",  5),
}


# ── Audio ───────────────────────────────────────────────────────────────────

def audio_filename(dutch_word):
    """Convert Dutch word to expected audio filename."""
    name = dutch_word.lower().strip("!?,.")
    name = name.replace(" ", "_")
    return AUDIO_DIR / f"{name}.mp3"


def play_audio(dutch_word):
    path = audio_filename(dutch_word)
    if path.exists():
        subprocess.Popen(
            ["afplay", str(path)],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )


# ── UI ──────────────────────────────────────────────────────────────────────

def divider():
    print("─" * 45)


def choose_direction():
    clear()
    print("\n  Choose direction")
    divider()
    print("  [1] NL -> EN")
    print("  [2] EN -> NL")
    print("  [3] Both (random)")
    divider()
    while True:
        ch = getch()
        if ch == "1": return ["nl_en"]
        if ch == "2": return ["en_nl"]
        if ch == "3": return ["nl_en", "en_nl"]
        if ch == "q": sys.exit(0)


def choose_spelling_mode():
    clear()
    print("\n  Spelling mode")
    divider()
    print("  Type the Dutch word to test spelling?")
    print("  [y] Yes   [n] No")
    divider()
    while True:
        ch = getch()
        if ch in ("y", "Y"): return True
        if ch in ("n", "N"): return False
        if ch == "q": sys.exit(0)


def spelling_matches(typed, correct):
    """Case-insensitive match, ignoring leading/trailing punctuation and spaces."""
    import re
    def normalise(s):
        return re.sub(r"[^\w\s]", "", s.strip().lower())
    return normalise(typed) == normalise(correct)


def show_card_front(card_num, total, due_count, new_count, word, direction, spelling_mode):
    clear()
    print(f"  Card {card_num}/{total}   Due: {due_count}   New: {new_count}")
    divider()
    print()
    if direction == "nl_en":
        print(f"  [NL -> EN]  {word['dutch']}")
        print()
        print("  SPACE reveal   -> / v  master   q quit")
    else:
        print(f"  [EN -> NL]  {word['english']}")
        print()
        if spelling_mode:
            print("  Type below to reveal   -> / v  master   q quit")
        else:
            print("  SPACE reveal   -> / v  master   q quit")
    divider()


def show_card_back(word, direction, typed=None):
    divider()
    if direction == "nl_en":
        print(f"  > {word['english']}")
    else:
        correct = word["dutch"]
        if typed is not None:
            if spelling_matches(typed, correct):
                print(f"  > {correct}  ✓")
            else:
                print(f"  > {correct}  ✗  (you typed: {typed})")
        else:
            print(f"  > {correct}  ♪")
    if word["example_dutch"]:
        print(f"  {word['example_dutch']}")
    if word["example_english"]:
        print(f"  {word['example_english']}")
    print()
    print("  [1] Again   [2] Hard   [3] Good   [4] Easy")
    divider()


# ── Session ─────────────────────────────────────────────────────────────────

def build_session(vocab, progress, directions):
    today = date.today().isoformat()
    due = []
    new = []

    for word in vocab:
        for direction in directions:
            key = card_key(word["dutch"], direction)
            if key in progress:
                state = progress[key]
                if state.get("mastered"):
                    continue
                if state["next_review"] <= today:
                    due.append((word, direction, key))
            else:
                new.append((word, direction, key))

    random.shuffle(due)
    random.shuffle(new)
    new = new[:MAX_NEW_CARDS]

    return due + new, len(due), len(new)


def run_session(session, due_count, new_count, progress, spelling_mode):
    total = len(session)
    stats = {"Again": 0, "Hard": 0, "Good": 0, "Easy": 0, "Mastered": 0}

    for i, (word, direction, key) in enumerate(session, 1):
        # Initialise state if new card
        if key not in progress:
            progress[key] = default_card_state(direction)

        # Show front
        show_card_front(i, total, due_count, new_count, word, direction, spelling_mode)

        # Auto-play when Dutch is shown on front
        if direction == "nl_en":
            play_audio(word["dutch"])

        typed = None
        mastered_this_card = False

        if direction == "en_nl" and spelling_mode:
            # Spelling input — read a full line (normal terminal mode)
            print("  > ", end="", flush=True)
            try:
                typed = input()
            except EOFError:
                typed = ""
            if typed.strip().lower() == "q":
                save_progress(progress)
                print("\n\nProgress saved. Goodbye!")
                return stats, True
        else:
            # Wait for SPACE / arrow keys / q
            while True:
                ch = getch()
                if ch == "q":
                    save_progress(progress)
                    print("\n\nProgress saved. Goodbye!")
                    return stats, True
                if ch in ("RIGHT", "DOWN"):
                    mastered_this_card = True
                    break
                if ch == " ":
                    break

        if mastered_this_card:
            mark_mastered(word, progress)
            save_progress(progress)
            stats["Mastered"] += 1
            # Brief confirmation
            clear()
            print(f"\n  Mastered: {word['dutch']} / {word['english']}")
            print("  This word won't appear again.")
            import time
            time.sleep(1)
            continue

        # Show back
        show_card_back(word, direction, typed)

        # Auto-play when Dutch is revealed on back
        if direction == "en_nl":
            play_audio(word["dutch"])

        # Get rating (arrow keys also trigger mastered here)
        rating_label = None
        quality = None
        while True:
            ch = getch()
            if ch == "q":
                save_progress(progress)
                print("\n\nProgress saved. Goodbye!")
                return stats, True
            if ch in ("RIGHT", "DOWN"):
                mark_mastered(word, progress)
                save_progress(progress)
                stats["Mastered"] += 1
                rating_label = None
                break
            if ch in RATING_MAP:
                rating_label, quality = RATING_MAP[ch]
                break

        if rating_label is None:
            # Mastered from the back — show brief confirmation
            clear()
            print(f"\n  Mastered: {word['dutch']} / {word['english']}")
            print("  This word won't appear again.")
            import time
            time.sleep(1)
            continue

        stats[rating_label] += 1
        progress[key] = sm2_update(progress[key], quality)
        save_progress(progress)

    return stats, False


def show_stats(stats, progress):
    clear()
    tomorrow = (date.today() + timedelta(days=1)).isoformat()

    total_reviewed = sum(stats.values())
    due_tomorrow = sum(
        1 for s in progress.values()
        if not s.get("mastered") and s["next_review"] == tomorrow
    )
    total_mastered = sum(1 for s in progress.values() if s.get("mastered"))

    print()
    print("  Session complete!")
    print(f"    Reviewed:  {total_reviewed} cards")
    print(
        f"    Again: {stats['Again']:3d}   Hard: {stats['Hard']:3d}"
        f"   Good: {stats['Good']:3d}   Easy: {stats['Easy']:3d}"
        f"   Mastered: {stats['Mastered']:3d}"
    )
    print(f"    Total mastered (all time): {total_mastered} cards")
    print(f"    Next session due tomorrow: {due_tomorrow} cards")
    print()


# ── Main ────────────────────────────────────────────────────────────────────

def main():
    vocab = load_vocab()
    progress = load_progress()

    directions = choose_direction()

    spelling_mode = False
    if "en_nl" in directions:
        spelling_mode = choose_spelling_mode()

    session, due_count, new_count = build_session(vocab, progress, directions)

    if not session:
        clear()
        print("\n  No cards due today. Come back tomorrow!")
        return

    clear()
    print(f"\n  Starting session: {due_count} due + {new_count} new = {len(session)} cards")
    if spelling_mode:
        print("  Spelling mode ON for EN -> NL cards")
    print("  Press any key to begin ...")
    getch()

    stats, quit_early = run_session(session, due_count, new_count, progress, spelling_mode)

    if not quit_early:
        show_stats(stats, progress)


if __name__ == "__main__":
    main()
