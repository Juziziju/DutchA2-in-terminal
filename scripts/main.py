#!/usr/bin/env python3
"""Dutch A2 Blitz — unified launcher."""

import json
import os
import sys
import termios
import time
import tty
from datetime import datetime
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent

# Per-user data dir — each OS user gets their own history
USER_DATA_DIR = Path.home() / ".dutch_a2_blitz"
USER_DATA_DIR.mkdir(exist_ok=True)
MOCK_EXAM_LOG = USER_DATA_DIR / "mock_exam_log.json"

# ── Terminal helpers ──────────────────────────────────────────────────────────

def getch():
    """Read a single keypress without Enter."""
    fd = sys.stdin.fileno()
    old = termios.tcgetattr(fd)
    try:
        tty.setraw(fd)
        ch = sys.stdin.read(1)
        if ch == "\x1b":
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


def divider():
    print("─" * 45)


def fmt_time(seconds: int) -> str:
    m, s = divmod(max(0, seconds), 60)
    return f"{m:02d}:{s:02d}"


# ── Root menu ─────────────────────────────────────────────────────────────────

def root_menu():
    while True:
        clear()
        print("╔═══════════════════════════════════════════╗")
        print("║         DUTCH A2 BLITZ                    ║")
        print("╚═══════════════════════════════════════════╝")
        print("  [S] STUDY      active learning")
        print("  [M] MOCK EXAM  inburgeringsexamen A2")
        divider()
        print("  [Q] Quit")
        print()
        print("  > ", end="", flush=True)
        ch = getch().upper()
        if ch == "S":
            study_menu()
        elif ch == "M":
            mock_exam_menu()
        elif ch in ("Q", "\x03"):
            clear()
            print("Tot ziens!")
            print()
            sys.exit(0)


# ── Study menu ────────────────────────────────────────────────────────────────

def study_menu():
    while True:
        clear()
        print("  STUDY")
        divider()
        print("  [1] Listening      AI dialogue + quiz")
        print("  [2] Flashcards     spaced repetition")
        divider()
        print("  [3] Reading        coming soon ~")
        print("  [4] Dictation      coming soon ~")
        print("  [5] Grammar        coming soon ~")
        divider()
        print("  [S] Sync Vocab     import from Busuu")
        print("  [R] Rebuild Notes  regenerate Vocabs.md")
        divider()
        print("  [B] Back   [Q] Quit")
        print()
        print("  > ", end="", flush=True)
        ch = getch().upper()

        if ch == "1":
            _run_module("listening")
        elif ch == "2":
            _run_module("flashcard")
        elif ch in ("3", "4", "5"):
            _coming_soon()
        elif ch == "S":
            _run_sync_vocab()
        elif ch == "R":
            _run_generate_vocab()
        elif ch in ("B", "\x1b"):
            return
        elif ch in ("Q", "\x03"):
            clear()
            print("Tot ziens!")
            print()
            sys.exit(0)


def _run_module(name: str):
    """Import and call main() from a sibling script.

    Sub-scripts call sys.exit(0) on their internal quit key. We catch that
    here so it acts as 'go back' rather than killing main.py. A non-zero
    exit (error) is re-raised so real crashes still surface.
    """
    import importlib.util
    spec = importlib.util.spec_from_file_location(name, SCRIPT_DIR / f"{name}.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    try:
        mod.main()
    except SystemExit as e:
        if e.code not in (0, None):
            raise


def _count_vocab_csv() -> int:
    """Return number of word rows in vocab_input.csv (0 if missing)."""
    import csv as _csv
    p = SCRIPT_DIR.parent / "vocab_input.csv"
    if not p.exists():
        return 0
    with open(p, newline="", encoding="utf-8") as f:
        return sum(1 for row in _csv.DictReader(f) if row.get("dutch", "").strip())


def _run_sync_vocab():
    clear()
    print()
    print("  Sync Vocab — import from Busuu")
    divider()
    print("  Reads your exported Busuu CSV and appends any new")
    print("  words to vocab_input.csv. Also downloads missing")
    print("  audio files for the new entries.")
    print()
    print("  Press Enter to continue, or B to cancel.")
    ch = input("  > ").strip().upper()
    if ch == "B":
        return

    before = _count_vocab_csv()
    _run_module("sync_vocab")
    after = _count_vocab_csv()
    added = max(0, after - before)

    clear()
    print()
    print("  Sync Vocab — done")
    divider()
    print(f"  Words before  : {before}")
    print(f"  Words after   : {after}")
    print(f"  New words added: {added}")
    if added == 0:
        print()
        print("  Already up to date — nothing new to add.")
    divider()
    print("  Press any key to go back.")
    getch()


def _run_generate_vocab():
    import csv as _csv
    from collections import Counter

    clear()
    print()
    print("  Rebuild Notes — regenerate Vocabs.md")
    divider()
    print("  Reads vocab_input.csv and rewrites Vocabs.md")
    print("  from scratch. Run this after a sync or any manual")
    print("  edits to the CSV.")
    print()
    print("  Press Enter to continue, or B to cancel.")
    ch = input("  > ").strip().upper()
    if ch == "B":
        return

    # Snapshot categories before run
    vocab_path = SCRIPT_DIR.parent / "vocab_input.csv"
    cat_counts: Counter = Counter()
    total_words = 0
    if vocab_path.exists():
        with open(vocab_path, newline="", encoding="utf-8") as f:
            for row in _csv.DictReader(f):
                if row.get("dutch", "").strip():
                    cat = row.get("category", "General").strip() or "General"
                    cat_counts[cat] += 1
                    total_words += 1

    _run_module("generate_vocab")

    clear()
    print()
    print("  Rebuild Notes — done")
    divider()
    print(f"  Total words  : {total_words}")
    print(f"  Categories   : {len(cat_counts)}")
    if cat_counts:
        print()
        for cat, count in sorted(cat_counts.items(), key=lambda x: -x[1]):
            print(f"    {cat:<20} {count} words")
    divider()
    out = SCRIPT_DIR.parent / "Vocabs.md"
    if out.exists():
        print(f"  Vocabs.md updated ({out.stat().st_size // 1024 + 1} KB)")
    divider()
    print("  Press any key to go back.")
    getch()


def _explain_and_run(title: str, lines: list[str], module: str):
    clear()
    print()
    print(f"  {title}")
    divider()
    for line in lines:
        print(f"  {line}")
    print()
    print("  Press Enter to continue, or B to cancel.")
    ch = input("  > ").strip().upper()
    if ch != "B":
        _run_module(module)


def _coming_soon():
    clear()
    print()
    print("  Coming soon ~")
    print()
    print("  Press any key to go back.")
    getch()


# ── Mock exam ─────────────────────────────────────────────────────────────────
#
# Inburgeringsexamen sections (A2, permanent residency):
#
#   LZ  Lezen          Reading comprehension    ~35 min
#   LU  Luisteren      Listening comprehension  ~30 min
#   SC  Schrijven      Writing                  ~45 min
#   SP  Spreken        Speaking                 ~15 min
#   KNM Kennis NL Mij  Society knowledge        ~40 min
#
# Each section is a stub — real content comes from either:
#   (O) Official material (DUO / oefenexamens)
#   (A) AI-generated practice questions
#
# Timer: per-section countdown. User can terminate early → see partial score,
#        or extend by +5 min increments.

# Default minutes per section
SECTION_DEFAULTS = {
    "LZ":  35,
    "LU":  30,
    "SC":  45,
    "SP":  15,
    "KNM": 40,
}

SECTION_LABELS = {
    "LZ":  "Lezen          (Reading)",
    "LU":  "Luisteren      (Listening)",
    "SC":  "Schrijven      (Writing)",
    "SP":  "Spreken        (Speaking)",
    "KNM": "KNM            (Society)",
}

PASS_SCORE = 60  # % required to pass each section


# ── Exam session state ────────────────────────────────────────────────────────

class ExamSession:
    """Holds live state for one mock exam attempt."""

    def __init__(self, source: str, custom_times: dict):
        self.source = source          # "official" | "ai"
        self.times = custom_times     # section_code → minutes
        self.scores: dict[str, int | None] = {k: None for k in SECTION_DEFAULTS}
        self.started_at = datetime.now()

    def section_result(self, code: str) -> str:
        s = self.scores.get(code)
        if s is None:
            return "—"
        mark = "PASS" if s >= PASS_SCORE else "FAIL"
        return f"{s:3d}%  {mark}"

    def overall(self) -> tuple[int | None, bool]:
        """Returns (avg_score_or_None, all_passed)."""
        done = [v for v in self.scores.values() if v is not None]
        if not done:
            return None, False
        avg = sum(done) // len(done)
        all_passed = all(v >= PASS_SCORE for v in done)
        return avg, all_passed


# ── Mock exam top menu ────────────────────────────────────────────────────────

def mock_exam_menu():
    while True:
        clear()
        print("  MOCK EXAM — Inburgeringsexamen A2")
        divider()
        print("  Full exam simulation for permanent residency")
        print()
        print("  [1] Full exam        all 5 sections in order")
        print("  [2] Single section   pick one to practice")
        divider()
        print("  [T] Timer settings   adjust per-section time")
        print("  [R] Results history  past mock scores")
        divider()
        print("  [B] Back   [Q] Quit")
        print()
        print("  > ", end="", flush=True)
        ch = getch().upper()

        if ch == "1":
            source = _pick_source()
            if source:
                times = dict(SECTION_DEFAULTS)
                session = ExamSession(source, times)
                _run_full_exam(session)
        elif ch == "2":
            source = _pick_source()
            if source:
                times = dict(SECTION_DEFAULTS)
                session = ExamSession(source, times)
                _run_single_section_menu(session)
        elif ch == "T":
            _timer_settings_menu()
        elif ch == "R":
            _results_history()
        elif ch in ("B", "\x1b"):
            return
        elif ch in ("Q", "\x03"):
            clear()
            print("Tot ziens!")
            print()
            sys.exit(0)


def _pick_source() -> str | None:
    """Ask user: official material or AI-generated. Returns 'official'/'ai'/None."""
    clear()
    print("  Material source")
    divider()
    print("  [O] Official   DUO / oefenexamen.nl material")
    print("  [A] AI         AI-generated practice questions")
    divider()
    print("  [B] Back")
    print()
    print("  > ", end="", flush=True)
    ch = getch().upper()
    if ch == "O":
        return "official"
    if ch == "A":
        return "ai"
    return None


# ── Full exam flow ────────────────────────────────────────────────────────────

def _run_full_exam(session: ExamSession):
    clear()
    print()
    print("  FULL MOCK EXAM")
    divider()
    src_label = "Official material" if session.source == "official" else "AI-generated"
    print(f"  Source  : {src_label}")
    print(f"  Sections: LZ → LU → SC → SP → KNM")
    print(f"  Total   : ~{sum(session.times.values())} min")
    divider()
    print("  Press Enter to begin, or B to cancel.")
    ch = input("  > ").strip().upper()
    if ch == "B":
        return

    for code in ["LZ", "LU", "SC", "SP", "KNM"]:
        score = _run_section(code, session)
        session.scores[code] = score
        if score is None:
            # user quit the whole exam
            break

    _show_exam_results(session)


# ── Single section menu ───────────────────────────────────────────────────────

def _run_single_section_menu(session: ExamSession):
    codes = list(SECTION_DEFAULTS.keys())
    keys  = ["1", "2", "3", "4", "5"]
    while True:
        clear()
        print("  SINGLE SECTION")
        divider()
        for key, code in zip(keys, codes):
            mins = session.times[code]
            print(f"  [{key}] {SECTION_LABELS[code]}   ({mins} min)")
        divider()
        print("  [B] Back")
        print()
        print("  > ", end="", flush=True)
        ch = getch()
        if ch in keys:
            code = codes[keys.index(ch)]
            score = _run_section(code, session)
            session.scores[code] = score
            if score is not None:
                _show_section_result(code, score)
        elif ch.upper() in ("B", "\x1b"):
            return
        elif ch.upper() in ("Q", "\x03"):
            clear()
            print("Tot ziens!")
            print()
            sys.exit(0)


# ── Section runner ────────────────────────────────────────────────────────────

def _run_section(code: str, session: ExamSession) -> int | None:
    """
    Run one exam section with a countdown timer.

    Controls during exam:
      [E] End early  → evaluate what's done so far
      [X] Extend     → add 5 minutes
      [Q] Quit exam  → abort, return None

    Returns score (0–100) or None if user quit the whole exam.
    """
    total_seconds = session.times[code] * 60
    remaining = total_seconds
    label = SECTION_LABELS[code]
    src   = session.source

    clear()
    print()
    print(f"  ── {label} ──")
    divider()
    print(f"  Source  : {'Official' if src == 'official' else 'AI-generated'}")
    print(f"  Time    : {session.times[code]} min")
    print()

    # ── Section content stub ─────────────────────────────────────────────────
    # TODO: replace each stub with real question engine per section
    if src == "official":
        _stub_official(code)
    else:
        _stub_ai(code)
    # ────────────────────────────────────────────────────────────────────────

    print()
    divider()
    print("  Controls: [E] End & evaluate   [X] +5 min   [Q] Quit exam")
    divider()
    print()

    # Countdown loop — checks stdin every second using select
    import select
    deadline = time.time() + remaining

    while True:
        remaining = int(deadline - time.time())
        timer_str = fmt_time(remaining)
        # Overwrite the timer line in place
        print(f"\r  Time remaining: {timer_str}  ", end="", flush=True)

        if remaining <= 0:
            print()
            print()
            print("  Time's up!")
            break

        # Non-blocking keypress check (1-second poll)
        rlist, _, _ = select.select([sys.stdin], [], [], 1.0)
        if rlist:
            ch = sys.stdin.read(1).upper()
            if ch == "E":
                print()
                print()
                print("  Section ended early.")
                break
            elif ch == "X":
                deadline += 300  # +5 min
                print(f"\r  Extended by 5 min.          ", flush=True)
                time.sleep(1)
            elif ch in ("Q", "\x03"):
                print()
                return None  # abort whole exam

    # ── Scoring stub: returns placeholder score ──────────────────────────────
    # TODO: replace with real answer evaluation
    score = _stub_score(code)
    return score


# ── Section content stubs ─────────────────────────────────────────────────────

def _stub_official(code: str):
    stubs = {
        "LZ":  "  [stub] Display official reading passage + multiple-choice questions.",
        "LU":  "  [stub] Play official audio clip → multiple-choice comprehension questions.",
        "SC":  "  [stub] Display official writing prompt → user types response.",
        "SP":  "  [stub] Display speaking prompt → user records / reads aloud.",
        "KNM": "  [stub] Display official KNM multiple-choice questions (society/law/culture).",
    }
    print(stubs.get(code, "  [stub] Content goes here."))
    print()
    print("  (Official DUO material integration — coming soon)")


def _stub_ai(code: str):
    stubs = {
        "LZ":  "  [stub] AI-generated Dutch reading text + comprehension questions.",
        "LU":  "  [stub] AI-generated dialogue → gTTS audio + comprehension questions.",
        "SC":  "  [stub] AI-generated writing scenario prompt.",
        "SP":  "  [stub] AI-generated speaking scenario.",
        "KNM": "  [stub] AI-generated KNM quiz (history, government, civic rules).",
    }
    print(stubs.get(code, "  [stub] Content goes here."))
    print()
    print("  (AI question generation — coming soon)")


def _stub_score(code: str) -> int:
    """Placeholder: returns a fixed score until real grading is implemented."""
    # TODO: replace with real answer evaluation per section
    return 75


# ── Result screens ────────────────────────────────────────────────────────────

def _show_section_result(code: str, score: int):
    clear()
    print()
    print(f"  Result — {SECTION_LABELS[code]}")
    divider()
    mark = "PASS" if score >= PASS_SCORE else "FAIL"
    print(f"  Score : {score}%")
    print(f"  Result: {mark}  (pass threshold: {PASS_SCORE}%)")
    divider()
    print("  Press any key to continue.")
    getch()


def _show_exam_results(session: ExamSession):
    avg, all_passed = session.overall()
    clear()
    print()
    print("  MOCK EXAM RESULTS")
    divider()
    for code in SECTION_DEFAULTS:
        label = SECTION_LABELS[code].split("(")[0].strip()
        result = session.section_result(code)
        print(f"  {label:<22} {result}")
    divider()
    if avg is not None:
        overall_mark = "PASS" if all_passed else "FAIL"
        print(f"  Overall average : {avg}%  →  {overall_mark}")
    else:
        print("  No sections completed.")
    divider()
    print("  Press any key to continue.")
    getch()

    # Save result to history
    _save_result(session)


def _save_result(session: ExamSession):
    if MOCK_EXAM_LOG.exists():
        with open(MOCK_EXAM_LOG, encoding="utf-8") as f:
            log = json.load(f)
    else:
        log = {"results": []}

    avg, all_passed = session.overall()
    entry = {
        "date":   session.started_at.isoformat(timespec="seconds"),
        "source": session.source,
        "scores": session.scores,
        "avg":    avg,
        "passed": all_passed,
    }
    log["results"].append(entry)
    with open(MOCK_EXAM_LOG, "w", encoding="utf-8") as f:
        json.dump(log, f, indent=2)


# ── Timer settings ────────────────────────────────────────────────────────────

def _timer_settings_menu():
    """Let user set custom minutes per section. Changes are session-only (not persisted)."""
    codes = list(SECTION_DEFAULTS.keys())
    keys  = ["1", "2", "3", "4", "5"]
    # Use a local mutable copy for display
    custom = dict(SECTION_DEFAULTS)
    while True:
        clear()
        print("  TIMER SETTINGS")
        divider()
        print("  Adjust default time per section (minutes).")
        print("  These apply to your next exam session.")
        print()
        for key, code in zip(keys, codes):
            default = SECTION_DEFAULTS[code]
            current = custom[code]
            marker = f"  [{key}] {SECTION_LABELS[code]}   {current} min"
            if current != default:
                marker += f"  (default: {default})"
            print(marker)
        divider()
        print("  Enter a section number to change its time,")
        print("  or [B] to go back.")
        print()
        print("  > ", end="", flush=True)
        ch = getch()
        if ch in keys:
            code = codes[keys.index(ch)]
            print()
            try:
                val = input(f"  New time for {code} (minutes, Enter to keep {custom[code]}): ").strip()
                if val:
                    mins = int(val)
                    if 1 <= mins <= 120:
                        custom[code] = mins
                        print(f"  Set to {mins} min.")
                    else:
                        print("  Out of range (1–120). Keeping current.")
            except ValueError:
                print("  Not a number. Keeping current.")
            time.sleep(1)
        elif ch.upper() in ("B", "\x1b"):
            return


# ── Results history ───────────────────────────────────────────────────────────

def _results_history():
    clear()
    print()
    print("  RESULTS HISTORY")
    divider()
    if not MOCK_EXAM_LOG.exists():
        print("  No mock exams completed yet.")
        print()
        print("  Press any key to go back.")
        getch()
        return

    with open(MOCK_EXAM_LOG, encoding="utf-8") as f:
        log = json.load(f)

    results = log.get("results", [])
    if not results:
        print("  No results recorded.")
    else:
        for i, r in enumerate(results[-10:], 1):  # show last 10
            date_str = r["date"][:10]
            avg  = r.get("avg")
            passed = r.get("passed", False)
            src  = r.get("source", "?")[0].upper()
            mark = "PASS" if passed else "FAIL"
            avg_str = f"{avg}%" if avg is not None else "—"
            print(f"  {i:2}. {date_str}  [{src}]  avg {avg_str:>4}  {mark}")

    divider()
    print("  Press any key to go back.")
    getch()


# ── Entry point ───────────────────────────────────────────────────────────────

def main():
    clear()
    print()
    print("  Dutch A2 Blitz")
    divider()
    print("  STUDY   — practice listening & flashcards")
    print("  MOCK EXAM — simulate the full inburgeringsexamen")
    print()
    print("  Tip: sub-module quit (q) returns here.")
    print("       Press Q from any main menu to exit.")
    divider()
    print("  Press any key to continue.")
    getch()
    root_menu()


if __name__ == "__main__":
    main()
