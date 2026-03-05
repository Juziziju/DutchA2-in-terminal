#!/usr/bin/env python3
"""Dutch A2 listening comprehension test using Qwen LLM + gTTS."""

import csv
import json
import os
import random
import subprocess
import sys
import termios
import time
import tty
from datetime import datetime
from pathlib import Path

# ── Paths ────────────────────────────────────────────────────────────────────

SCRIPT_DIR = Path(__file__).parent


def _load_dotenv():
    """Load .env from the script directory into os.environ (no extra deps)."""
    env_file = SCRIPT_DIR / ".env"
    if not env_file.exists():
        return
    with open(env_file, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            os.environ.setdefault(key, value)


_load_dotenv()
VAULT_DIR = SCRIPT_DIR.parent
VOCAB_CSV = VAULT_DIR / "vocab_input.csv"
LOG_JSON = SCRIPT_DIR / "listening_log.json"
AUDIO_LISTENING_DIR = VAULT_DIR / "audio_listening"

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


# ── Vocab loading ─────────────────────────────────────────────────────────────

def load_vocab():
    words = []
    with open(VOCAB_CSV, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            dutch = row["dutch"].strip()
            if dutch:
                words.append(dutch)
    return words


# ── API key check ─────────────────────────────────────────────────────────────

def check_api_key():
    key = os.environ.get("DASHSCOPE_API_KEY")
    if not key:
        print("\n  Missing API key: DASHSCOPE_API_KEY\n")
        print("  To fix this, run:")
        print("    export DASHSCOPE_API_KEY='your-key-here'\n")
        print("  Get a key at: https://dashscope.aliyun.com/")
        print()
        sys.exit(1)
    return key


# ── Qwen generation ───────────────────────────────────────────────────────────

SYSTEM_PROMPT = """You are a Dutch language teacher. Generate a Dutch A2-level listening exercise.
Return ONLY valid JSON with no markdown fences, no explanation, just the raw JSON object.

Schema:
{
  "topic": "string (topic in English)",
  "speakers": ["Name1", "Name2"],
  "dialogue": [
    {"speaker": "Name1", "text": "Dutch sentence", "english": "English translation"},
    ...
  ],
  "questions": [
    {
      "question": "Dutch question?",
      "options": {"A": "...", "B": "...", "C": "...", "D": "..."},
      "answer": "A"
    },
    ...
  ]
}

Requirements:
- 2 speakers, 8-12 dialogue lines total
- A2 level Dutch throughout
- Naturally incorporate the given vocabulary words
- Each dialogue line must include an "english" field with a natural English translation
- Exactly 4 multiple-choice questions (A/B/C/D) written in Dutch
- The answer field must be one of: A, B, C, D"""


def call_qwen(api_key, vocab_sample):
    from openai import OpenAI
    client = OpenAI(
        api_key=api_key,
        base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
    )
    user_msg = (
        f"Create a Dutch A2 listening dialogue that naturally uses these words: "
        f"{', '.join(vocab_sample)}. "
        f"Return only valid JSON."
    )
    response = client.chat.completions.create(
        model="qwen-plus",
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_msg},
        ],
        temperature=0.8,
    )
    return response.choices[0].message.content.strip()


def validate_dialogue(data):
    """Raise ValueError if the JSON structure is missing required fields."""
    required_top = {"topic", "speakers", "dialogue", "questions"}
    missing = required_top - set(data.keys())
    if missing:
        raise ValueError(f"Missing top-level keys: {missing}")
    if not isinstance(data["dialogue"], list) or len(data["dialogue"]) < 2:
        raise ValueError("dialogue must be a list with at least 2 entries")
    for i, line in enumerate(data["dialogue"]):
        if "speaker" not in line or "text" not in line or "english" not in line:
            raise ValueError(f"dialogue[{i}] missing speaker/text/english")
    if not isinstance(data["questions"], list) or len(data["questions"]) != 4:
        raise ValueError(f"questions must be a list of exactly 4 items, got {len(data.get('questions', []))}")
    for i, q in enumerate(data["questions"]):
        for key in ("question", "options", "answer"):
            if key not in q:
                raise ValueError(f"questions[{i}] missing '{key}'")
        if set(q["options"].keys()) != {"A", "B", "C", "D"}:
            raise ValueError(f"questions[{i}] options must have keys A, B, C, D")
        if q["answer"] not in ("A", "B", "C", "D"):
            raise ValueError(f"questions[{i}] answer must be A/B/C/D")


def generate_dialogue(api_key, vocab_words):
    """Call Qwen, parse JSON, validate. Retries once on failure."""
    sample = random.sample(vocab_words, min(12, len(vocab_words)))

    for attempt in range(2):
        try:
            raw = call_qwen(api_key, sample)
            # Strip accidental markdown fences if present
            if raw.startswith("```"):
                lines = raw.splitlines()
                raw = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])
            data = json.loads(raw)
            validate_dialogue(data)
            return data, sample
        except Exception as e:
            if attempt == 0:
                print(f"\n  Generation attempt 1 failed ({e}), retrying...")
                time.sleep(2)
            else:
                print(f"\n  Generation failed after 2 attempts: {e}")
                sys.exit(1)


# ── Audio generation ──────────────────────────────────────────────────────────

def generate_audio(dialogue, session_prefix):
    """Generate one mp3 per dialogue line in audio_listening/. Returns list of Paths."""
    from gtts import gTTS
    AUDIO_LISTENING_DIR.mkdir(parents=True, exist_ok=True)
    files = []
    for i, line in enumerate(dialogue):
        path = AUDIO_LISTENING_DIR / f"{session_prefix}_line_{i:02d}.mp3"
        try:
            gTTS(text=line["text"], lang="nl").save(str(path))
            files.append(path)
        except Exception as e:
            print(f"  Warning: TTS failed for line {i} ({e}), skipping.")
            files.append(None)
    return files


def play_dialogue(audio_files, dialogue, after_line_callback=None):
    """Play each audio file sequentially (blocking). Calls callback after each line."""
    n = len(audio_files)
    for i, (path, line) in enumerate(zip(audio_files, dialogue), 1):
        clear()
        print(f"\n  Playing dialogue...  ({n} lines)\n")
        divider()
        print(f"  Line {i}/{n}: {line['speaker']} speaking...")
        print()
        print("  (listening...)")
        divider()
        if path and path.exists():
            subprocess.run(["afplay", str(path)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        else:
            time.sleep(1)  # pause for skipped lines
        if after_line_callback:
            after_line_callback(i, n)


# ── Pre-play screen ───────────────────────────────────────────────────────────

def show_pre_play(data, sample):
    clear()
    print("\n  Dutch A2 Listening Test")
    divider()
    print(f"  Topic: {data['topic']}")
    vocab_str = ", ".join(sample[:10])
    if len(sample) > 10:
        vocab_str += ", ..."
    print(f"  Vocab: {vocab_str}")
    print()
    print("  Read the questions before you listen:")
    print()
    for i, q in enumerate(data["questions"], 1):
        print(f"  Q{i}. {q['question']}")
        for letter in ("A", "B", "C", "D"):
            print(f"      {letter}) {q['options'][letter]}")
        print()
    divider()
    print("  SPACE  play dialogue    q  quit")
    divider()


def pre_play_loop(data, sample, audio_files):
    """Handle SPACE (play), R (replay), ENTER (go to questions), q (quit)."""
    played = False

    while True:
        show_pre_play(data, sample)
        if played:
            print("  R  replay    ENTER  go to questions\n")

        ch = getch()

        if ch == "q":
            sys.exit(0)

        if ch == " ":
            play_dialogue(audio_files, data["dialogue"])
            time.sleep(0.5)
            played = True
            # After playing, show post-play options
            post_play_choice = post_play_loop(data, sample, audio_files)
            if post_play_choice == "questions":
                return
            # If replay, loop again
        elif ch in ("\r", "\n") and played:
            return
        elif ch in ("r", "R") and played:
            play_dialogue(audio_files, data["dialogue"])
            time.sleep(0.5)


def post_play_loop(data, sample, audio_files):
    """After playing, show options. Returns 'questions' or 'replay'."""
    while True:
        clear()
        print("\n  Dutch A2 Listening Test")
        divider()
        print(f"  Topic: {data['topic']}")
        print()
        print("  Dialogue finished.")
        print()
        print("  R  replay from start    ENTER  go to questions    q  quit")
        divider()

        ch = getch()
        if ch == "q":
            sys.exit(0)
        if ch in ("r", "R"):
            play_dialogue(audio_files, data["dialogue"])
            time.sleep(0.5)
        if ch in ("\r", "\n"):
            return "questions"


# ── Question loop ─────────────────────────────────────────────────────────────

def run_questions(questions):
    """Present 4 questions, collect single-keypress answers. Returns list of answers."""
    user_answers = []

    for i, q in enumerate(questions, 1):
        while True:
            clear()
            print(f"\n  Question {i}/4")
            divider()
            print(f"  {q['question']}")
            print()
            for letter in ("A", "B", "C", "D"):
                print(f"    {letter}) {q['options'][letter]}")
            print()
            print("  Your answer: ", end="", flush=True)

            ch = getch().upper()
            if ch == "Q":
                sys.exit(0)
            if ch in ("A", "B", "C", "D"):
                print(ch)
                user_answers.append(ch)
                time.sleep(0.3)
                break

    return user_answers


# ── Results screen ────────────────────────────────────────────────────────────

def calc_score(questions, user_answers):
    score = sum(1 for q, ua in zip(questions, user_answers) if ua == q["answer"])
    total = len(questions)
    pct = round(score / total * 100)
    return score, total, pct


def draw_results(questions, user_answers):
    score, total, pct = calc_score(questions, user_answers)
    clear()
    print(f"\n  Results: {score}/{total}  ({pct}%)")
    divider()
    for i, (q, ua) in enumerate(zip(questions, user_answers), 1):
        correct = q["answer"]
        mark = "✓" if ua == correct else "✗"
        q_text = q["question"]
        if len(q_text) > 30:
            q_text = q_text[:27] + "..."
        print(f"  Q{i}  {q_text:<32}  {ua}  {correct}  {mark}")
    print()
    print("  R  replay    V  transcript    E  explanation    ENTER  exit")
    divider()


def show_results(questions, user_answers):
    draw_results(questions, user_answers)
    score, total, pct = calc_score(questions, user_answers)
    return score, pct


# ── Logging ───────────────────────────────────────────────────────────────────

def append_log(data, sample, questions, user_answers, score, pct):
    if LOG_JSON.exists():
        with open(LOG_JSON, encoding="utf-8") as f:
            log = json.load(f)
    else:
        log = {"sessions": []}

    session_questions = []
    for q, ua in zip(questions, user_answers):
        session_questions.append({
            "question": q["question"],
            "options": q["options"],
            "answer": q["answer"],
            "user_answer": ua,
            "correct": ua == q["answer"],
        })

    log["sessions"].append({
        "date": datetime.now().isoformat(timespec="seconds"),
        "topic": data["topic"],
        "vocab_used": sample,
        "dialogue": data["dialogue"],
        "questions": session_questions,
        "score": score,
        "total": len(questions),
        "percentage": pct,
    })

    with open(LOG_JSON, "w", encoding="utf-8") as f:
        json.dump(log, f, indent=2, ensure_ascii=False)


# ── Explanation ───────────────────────────────────────────────────────────────

def get_explanation(api_key, data, questions, user_answers):
    from openai import OpenAI
    client = OpenAI(
        api_key=api_key,
        base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
    )

    transcript = "\n".join(
        f"{line['speaker']}: {line['text']} ({line.get('english', '')})"
        for line in data["dialogue"]
    )

    qa_summary = ""
    for i, (q, ua) in enumerate(zip(questions, user_answers), 1):
        correct = q["answer"]
        correct_text = q["options"][correct]
        user_text = q["options"][ua]
        status = "correct" if ua == correct else "incorrect"
        qa_summary += (
            f"Q{i}: {q['question']}\n"
            f"  User answered {ua}) {user_text} — {status}\n"
            f"  Correct answer: {correct}) {correct_text}\n\n"
        )

    prompt = (
        f"The student just completed a Dutch A2 listening exercise.\n\n"
        f"Topic: {data['topic']}\n\n"
        f"Dialogue transcript:\n{transcript}\n\n"
        f"Questions and student answers:\n{qa_summary}"
        f"Please explain in English, for each question, why the correct answer is right "
        f"and (if the student was wrong) why their choice was incorrect. "
        f"Reference specific lines from the dialogue to support each explanation. "
        f"Keep it clear and encouraging for an A2 learner."
    )

    clear()
    print("\n  Getting explanation from Qwen...\n")
    divider()

    try:
        response = client.chat.completions.create(
            model="qwen-plus",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.5,
            stream=True,
        )
        for chunk in response:
            delta = chunk.choices[0].delta.content
            if delta:
                print(delta, end="", flush=True)
        print("\n")
    except Exception as e:
        print(f"\n  Error getting explanation: {e}\n")

    divider()
    print("\n  ENTER  back to results")
    while True:
        ch = getch()
        if ch in ("\r", "\n", "q"):
            return


# ── Post-results loop ─────────────────────────────────────────────────────────

def show_transcript(data):
    clear()
    print("\n  Dialogue Transcript")
    divider()
    for line in data["dialogue"]:
        print(f"  {line['speaker']}: {line['text']}")
        english = line.get("english", "")
        if english:
            print(f"             ({english})")
    divider()
    print("\n  ENTER  back to results")
    while True:
        ch = getch()
        if ch in ("\r", "\n", "q"):
            return


def post_results_loop(api_key, data, questions, user_answers, audio_files):
    while True:
        draw_results(questions, user_answers)
        ch = getch()
        if ch == "q":
            sys.exit(0)
        elif ch in ("\r", "\n"):
            return
        elif ch in ("r", "R"):
            play_dialogue(audio_files, data["dialogue"])
            time.sleep(0.5)
        elif ch in ("v", "V"):
            show_transcript(data)
        elif ch in ("e", "E"):
            get_explanation(api_key, data, questions, user_answers)


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    api_key = check_api_key()

    # Load vocab
    try:
        vocab_words = load_vocab()
    except FileNotFoundError:
        print(f"\n  Error: vocab file not found at {VOCAB_CSV}")
        sys.exit(1)

    if len(vocab_words) < 5:
        print("\n  Error: vocab_input.csv has fewer than 5 words.")
        sys.exit(1)

    # Show loading screen
    clear()
    print("\n  Dutch A2 Listening Test")
    divider()
    print("  Generating dialogue with Qwen...")
    print()

    data, sample = generate_dialogue(api_key, vocab_words)

    print("  Generating audio with gTTS...")
    session_prefix = datetime.now().strftime("%Y%m%d_%H%M%S")
    audio_files = generate_audio(data["dialogue"], session_prefix)

    # Pre-play → play → questions
    pre_play_loop(data, sample, audio_files)

    user_answers = run_questions(data["questions"])

    score, pct = show_results(data["questions"], user_answers)

    append_log(data, sample, data["questions"], user_answers, score, pct)

    post_results_loop(api_key, data, data["questions"], user_answers, audio_files)

    clear()
    print("\n  Session saved to listening_log.json. Goodbye!\n")


if __name__ == "__main__":
    main()
