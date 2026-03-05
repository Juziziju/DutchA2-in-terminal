# Dutch A2 Vocab Sync & Flashcard System — Agent Instructions

## Project Layout

```
DutchA2/
├── csv/
│   └── convertcsv.csv        # Busuu export (source of truth for new words)
├── audio/                    # MP3 files, one per Dutch word
├── vocab_input.csv           # Master CSV used by all scripts
├── scripts/
│   ├── sync_vocab.py         # Sync new words from convertcsv.csv
│   ├── generate_vocab.py     # Rebuild Vocabs.md from vocab_input.csv
│   ├── flashcard.py          # SM-2 spaced repetition flashcard app
│   ├── progress.json         # Auto-created; SM-2 state per card (do not edit)
│   └── AGENT_PROMPT.md       # This file
```

---

## Source File Format

### `DutchA2/csv/convertcsv.csv` — Busuu JSON export

Despite the `.csv` extension, this file contains a **JSON array**:

```json
[
  {
    "text": "aardappel",
    "translation": "potato",
    "strength": "Strong",
    "example": "Zijn aardappelen groenten of fruit?",
    "example_translated": "Are potatoes vegetables or fruit?",
    "audio": "https://...",
    "image": "https://..."
  }
]
```

Fields used: `text` → dutch, `translation` → english, `example` → example_dutch, `example_translated` → example_english. All other fields are ignored.

### `DutchA2/vocab_input.csv` — Master CSV

```
dutch,english,category,example_dutch,example_english
aardappel,potato,General,Zijn aardappelen groenten of fruit?,Are potatoes vegetables or fruit?
```

---

## Script Logic

### `sync_vocab.py` — Run when `convertcsv.csv` has new words

1. Parse `convertcsv.csv` as JSON
2. Load existing Dutch words from `vocab_input.csv` (lowercase comparison)
3. For each word in JSON **not already in CSV**:
   - Generate audio via gTTS (`lang="nl"`) → save as `audio/<safe_filename>.mp3`
   - Skip audio generation if `.mp3` already exists
4. Append new rows to `vocab_input.csv` (never modifies existing rows)
5. Audio filename convention: lowercase, strip punctuation, spaces → underscores, `.mp3`
   - `"boodschappen doen"` → `boodschappen_doen.mp3`
   - `"Aangenaam!"` → `aangenaam.mp3`

**Run:** `python3 DutchA2/scripts/sync_vocab.py`
**Requires:** `pip install gTTS`

---

### `generate_vocab.py` — Rebuild Vocabs.md

- Reads `vocab_input.csv`
- Skips words whose audio file already exists (no re-generation)
- Outputs `DutchA2/scripts/Vocabs.md` as an Obsidian markdown table grouped by category
- Audio embeds use path `DutchA2/audio/<filename>`

**Run:** `python3 DutchA2/scripts/generate_vocab.py`

---

### `flashcard.py` — Spaced repetition study session

- Reads `vocab_input.csv` (185 words → 370 cards: both NL→EN and EN→NL directions)
- Loads/creates `progress.json` for SM-2 state
- Session = all due cards + up to 20 new cards (shuffled)
- Auto-plays audio via macOS `afplay` when Dutch side is shown
- Single-keypress input: `SPACE` to flip, `1–4` to rate, `q` to quit and save

**SM-2 ratings:**

| Key | Label | Effect |
|-----|-------|--------|
| 1 | Again | interval=1, repetitions reset |
| 2 | Hard  | EF −0.15, interval unchanged |
| 3 | Good  | EF unchanged, interval × EF |
| 4 | Easy  | EF +0.15, interval × EF × 1.3 |

EF floor: 1.3. First review → interval 1 day. Second → 6 days. Subsequent → prev × EF.

**Run:** `python3 DutchA2/scripts/flashcard.py`

---

## Typical Workflow

```
1. Export new vocab from Busuu → replace DutchA2/csv/convertcsv.csv
2. python3 DutchA2/scripts/sync_vocab.py      # adds new words + audio
3. python3 DutchA2/scripts/generate_vocab.py  # rebuilds Vocabs.md
4. python3 DutchA2/scripts/flashcard.py       # study session
```

---

## Rules for Agents

- **Never modify existing rows** in `vocab_input.csv` — append only
- **Never delete audio files** — they are pre-generated and expensive to recreate
- **Never edit `progress.json` manually** — it is managed exclusively by `flashcard.py`
- Audio filename must match `safe_filename()` convention exactly, or `flashcard.py` will not find the file
- `convertcsv.csv` is always the **full** Busuu export (all words, old + new) — diff logic lives in `sync_vocab.py`
- All scripts are run from the Obsidian Vault root or via absolute path; `Path(__file__).parent` resolves correctly either way
