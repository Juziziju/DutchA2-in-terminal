#!/usr/bin/env python3
"""
sync_vocab.py
=============
Syncs new words from DutchA2/csv/convertcsv.csv (Busuu JSON export) into:
  - DutchA2/vocab_input.csv   (appends new rows only)
  - DutchA2/audio/            (generates audio for new words only)

Run after exporting new vocabulary from Busuu.

USAGE:
    python3 DutchA2/scripts/sync_vocab.py

REQUIRES:
    pip install gTTS
"""

import csv
import json
import re
import sys
from pathlib import Path

# ── Paths ──────────────────────────────────────────────────────────────────

SCRIPT_DIR   = Path(__file__).parent
VAULT_DIR    = SCRIPT_DIR.parent
SOURCE_JSON  = VAULT_DIR / "csv" / "convertcsv.csv"   # Busuu JSON export
VOCAB_CSV    = VAULT_DIR / "vocab_input.csv"
AUDIO_DIR    = VAULT_DIR / "audio"

# ── Helpers ────────────────────────────────────────────────────────────────

def safe_filename(word: str) -> str:
    name = word.lower().strip()
    name = re.sub(r"[^\w\s-]", "", name)
    name = re.sub(r"\s+", "_", name)
    return name + ".mp3"


def generate_audio(word: str, filepath: Path) -> bool:
    try:
        from gtts import gTTS
        tts = gTTS(text=word, lang="nl", slow=False)
        tts.save(str(filepath))
        print(f"  ✅ audio: {word}")
        return True
    except ImportError:
        print("  ❌ gTTS not installed. Run: pip install gTTS")
        sys.exit(1)
    except Exception as e:
        print(f"  ⚠️  audio failed for '{word}': {e}")
        return False


def load_existing_dutch_words() -> set:
    """Return lowercase set of Dutch words already in vocab_input.csv."""
    if not VOCAB_CSV.exists():
        return set()
    with open(VOCAB_CSV, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        return {row["dutch"].strip().lower() for row in reader}


def load_source_words() -> list[dict]:
    """Parse convertcsv.csv (which is JSON) into list of word dicts."""
    with open(SOURCE_JSON, encoding="utf-8") as f:
        raw = json.load(f)

    words = []
    for item in raw:
        dutch = item.get("text", "").strip()
        english = item.get("translation", "").strip().rstrip("\n")
        if not dutch or not english:
            continue
        words.append({
            "dutch":           dutch,
            "english":         english,
            "category":        "General",
            "example_dutch":   item.get("example", "").strip(),
            "example_english": item.get("example_translated", "").strip(),
        })
    return words

# ── Main ───────────────────────────────────────────────────────────────────

def main():
    if not SOURCE_JSON.exists():
        print(f"❌ Source file not found: {SOURCE_JSON}")
        return

    AUDIO_DIR.mkdir(exist_ok=True)

    print(f"\n📖 Reading {SOURCE_JSON.name} ...")
    all_words = load_source_words()
    print(f"   {len(all_words)} words in source\n")

    existing = load_existing_dutch_words()
    print(f"📋 {len(existing)} words already in vocab_input.csv\n")

    new_words = [w for w in all_words if w["dutch"].lower() not in existing]

    if not new_words:
        print("✅ Nothing to add — vocab_input.csv is already up to date.")
        return

    print(f"🆕 {len(new_words)} new words found:\n")

    # Generate audio for new words
    print("🔊 Generating audio ...\n")
    rows_to_append = []
    for w in new_words:
        audio_path = AUDIO_DIR / safe_filename(w["dutch"])
        if audio_path.exists():
            print(f"  ⏭️  audio exists: {w['dutch']}")
        else:
            generate_audio(w["dutch"], audio_path)
        rows_to_append.append(w)

    # Append to vocab_input.csv
    write_header = not VOCAB_CSV.exists()
    with open(VOCAB_CSV, "a", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(
            f,
            fieldnames=["dutch", "english", "category", "example_dutch", "example_english"],
        )
        if write_header:
            writer.writeheader()
        writer.writerows(rows_to_append)

    print(f"\n✅ Done!")
    print(f"   Added {len(rows_to_append)} new words to vocab_input.csv")
    print(f"   Audio files → {AUDIO_DIR}")
    print(f"\n   Run generate_vocab.py to rebuild Vocabs.md")


if __name__ == "__main__":
    main()
