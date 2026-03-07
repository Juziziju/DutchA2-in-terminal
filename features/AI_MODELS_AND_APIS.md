# AI Models & APIs Reference

> Quick reference for all AI/API calls in the app. Update this when swapping models.

## Configuration

| Env Var | Default | Where |
|---------|---------|-------|
| `AI_API_KEY` / `DASHSCOPE_API_KEY` | (required) | `backend/.env` |
| `AI_BASE_URL` | `https://dashscope.aliyuncs.com/compatible-mode/v1` | `backend/config.py:30` |
| `AI_MODEL` | `qwen-plus` | `backend/config.py:29` |

All AI calls use the **OpenAI-compatible API** via the `openai` Python SDK pointed at DashScope.

---

## Model Map

| Model ID | Purpose | Upgrade Candidates |
|----------|---------|-------------------|
| `qwen-omni-turbo` | Speech-to-text (STT) | `qwen3-omni-flash` (faster), future Paraformer if endpoint returns |
| `qwen-plus` (via `AI_MODEL`) | Listening generation, speaking review, shadow review, speaking progress AI insight, planner, freestyle chat, custom scene generation | `qwen-max` (better quality), `qwen-turbo` (cheaper/faster) |
| `qwen3.5-plus-2026-02-15` | AI Advisor (hardcoded) | Any newer `qwen3.5-plus-*` or `qwen-max` |
| Edge TTS | Text-to-speech (all Dutch audio) | Azure Cognitive Services, Google Cloud TTS |

---

## Feature → Model → File Map

### 1. Speech-to-Text (STT)

All recording features share one transcription function.

| Detail | Value |
|--------|-------|
| **Model** | `qwen-omni-turbo` |
| **Method** | `chat.completions.create()` with `input_audio` (base64) |
| **File** | `backend/core/speaking_ai.py:15` → `transcribe_audio()` |
| **Called by** | Speaking router, Shadow router, Freestyle router |

**Why not `/audio/transcriptions`?** DashScope deprecated `paraformer-v2` and removed the OpenAI-compatible audio transcription endpoint. We use the omni model via chat completions with base64 audio input instead.

```python
# speaking_ai.py — transcribe_audio()
model="qwen-omni-turbo"
messages=[{
    "role": "user",
    "content": [
        {"type": "input_audio", "input_audio": {"data": data_uri, "format": ext}},
        {"type": "text", "text": "Transcribe this Dutch audio exactly..."},
    ],
}]
```

---

### 2. Speaking — Record Practice (AI Review)

| Detail | Value |
|--------|-------|
| **Model** | `AI_MODEL` (default `qwen-plus`) |
| **File** | `backend/core/speaking_ai.py:43` → `review_speaking()` |
| **Router** | `backend/routers/speaking.py:159` → `POST /speaking/submit-recording` |
| **Input** | Transcript + question prompt + expected phrases + model answer |
| **Output** | JSON: `score`, `vocabulary_score`, `grammar_score`, `completeness_score`, `feedback_en`, `improved_answer` |

---

### 3. Speaking — Shadow Reading (AI Review)

| Detail | Value |
|--------|-------|
| **Model** | `AI_MODEL` (default `qwen-plus`) |
| **File** | `backend/core/speaking_ai.py:124` → `review_shadow()` |
| **Router** | `backend/routers/speaking.py:275` → `POST /speaking/submit-shadow` |
| **Input** | Transcript + original sentence |
| **Output** | JSON: `similarity_score`, `word_matches`, `word_misses`, `feedback` |

---

### 3b. Speaking — Progress AI Insight

| Detail | Value |
|--------|-------|
| **Model** | `AI_MODEL` (default `qwen-plus`) |
| **File** | `backend/core/speaking_ai.py:171` → `analyze_speaking_patterns()` |
| **Router** | `backend/routers/speaking.py` → `GET /speaking/progress/ai-insight` |
| **Input** | Aggregated missed words, grammar errors, weak areas, comparison, mode stats (from `speaking_analysis.py`) |
| **Output** | JSON: `patterns`, `focus_areas`, `summary`, `suggested_scene_topic` |

---

### 4. Speaking — Freestyle Talk (Streaming LLM + TTS)

| Detail | Value |
|--------|-------|
| **STT Model** | `qwen-omni-turbo` (via `transcribe_audio`) |
| **LLM Model** | `AI_MODEL` (default `qwen-plus`) — streaming |
| **TTS** | Edge TTS (`nl-NL-ColetteNeural`) |
| **File** | `backend/core/freestyle_ai.py` → `stream_freestyle_response()` |
| **Router** | `backend/routers/freestyle.py:22` → `POST /speaking/freestyle/chat` |
| **Flow** | Audio → STT → LLM stream → sentence detection → TTS per sentence → SSE events |

---

### 5. Speaking — Sentence TTS (Model Sentences)

| Detail | Value |
|--------|-------|
| **Engine** | Edge TTS |
| **Voice** | `nl-NL-ColetteNeural` (`VOICE_FEMALE_1`) |
| **File** | `backend/core/audio.py:40` → `_generate_edge_tts()` |
| **Router** | `backend/routers/speaking.py:415` → `GET /speaking/tts/{scene_id}/{sentence_index}` |

---

### 6. Speaking — Custom Scene Generation

| Detail | Value |
|--------|-------|
| **Model** | `qwen-plus` (hardcoded) |
| **File** | `backend/core/qwen.py:294` → `generate_custom_scene()` |
| **Router** | `backend/routers/speaking.py:467` → `POST /speaking/custom-scenes` |
| **Output** | JSON: vocab list, model sentences, exam questions (short + long) |

---

### 7. Listening — Quiz Mode (Dialogue Generation)

| Detail | Value |
|--------|-------|
| **LLM Model** | `qwen-plus` (hardcoded) |
| **TTS** | Edge TTS (multi-voice: Colette, Maarten, Fenna, Arnaud) |
| **File** | `backend/core/qwen.py:71` → `_call_qwen()` / `generate_dialogue()` |
| **Audio** | `backend/core/audio.py:101` → `generate_dialogue_audio()` |
| **Router** | `backend/routers/listening.py` → `POST /listening/generate` |
| **Flow** | Vocab sample → LLM generates dialogue + questions → Edge TTS per line → return audio files |

---

### 8. Listening — Intensive Mode (Dictation)

| Detail | Value |
|--------|-------|
| **Model** | `qwen-plus` (hardcoded) |
| **File** | `backend/core/qwen.py:187` → `_call_qwen_intensive()` / `generate_intensive()` |
| **Router** | `backend/routers/listening.py` → `POST /listening/generate-intensive` |
| **Output** | Dialogue/monologue with transcript for dictation comparison |

---

### 9. Listening — AI Explanation

| Detail | Value |
|--------|-------|
| **Model** | `qwen-plus` (hardcoded) |
| **File** | `backend/core/qwen.py:244` → `get_explanation()` |
| **Router** | `backend/routers/listening.py` → `POST /listening/explain` |
| **Input** | Dialogue data + questions + user answers |
| **Output** | Markdown explanation of correct/incorrect answers |

---

### 10. AI Advisor

| Detail | Value |
|--------|-------|
| **Model** | `qwen3.5-plus-2026-02-15` (hardcoded in `ADVISOR_MODEL`) |
| **File** | `backend/core/advisor_ai.py:12` |
| **Router** | `backend/routers/advisor.py` → `POST /advisor/ask`, `POST /advisor/stream` |
| **Input** | User message + assembled learner context (flashcards, listening, speaking, exam, planner stats) |
| **Output** | JSON: `{"reply": "<markdown>", "suggested_tasks": [...]}` or streaming text |

---

### 11. Learning Planner

| Detail | Value |
|--------|-------|
| **Model** | `AI_MODEL` (default `qwen-plus`) |
| **File** | `backend/core/planner_ai.py` |
| **Router** | `backend/routers/planner.py` |
| **Functions** | `generate_placement_test`, `generate_daily_plan`, `generate_weekly_report`, `generate_multi_month_roadmap` |
| **Input** | Learner profile + performance data |
| **Output** | JSON task lists, reports, roadmaps |

---

### 12. Vocab — Audio (Single Word TTS)

| Detail | Value |
|--------|-------|
| **Engine** | Edge TTS |
| **Voice** | `nl-NL-ColetteNeural` |
| **File** | `backend/core/audio.py:68` → `ensure_vocab_audio()` |
| **Router** | `backend/routers/vocab.py` |

---

### 13. Flashcard Review (SM-2 Algorithm)

| Detail | Value |
|--------|-------|
| **No AI** | Pure algorithmic (SM-2 spaced repetition) |
| **File** | `backend/core/sm2.py` |
| **Router** | `backend/routers/flashcards.py` |

---

## TTS Voice Pool

| Voice ID | Gender | Region | Used In |
|----------|--------|--------|---------|
| `nl-NL-ColetteNeural` | Female | Netherlands | Default voice, vocab, freestyle, speaking TTS |
| `nl-NL-MaartenNeural` | Male | Netherlands | Listening dialogues (speaker 2) |
| `nl-NL-FennaNeural` | Female | Netherlands | Listening dialogues (speaker 3) |
| `nl-BE-ArnaudNeural` | Male | Belgium | Listening dialogues (speaker 4) |

Defined in `backend/core/audio.py:14-17`. Voice assignment rotates per speaker in dialogues.

---

## Storage

| Service | Bucket | Used For | File |
|---------|--------|----------|------|
| Supabase Storage | `audio` | Vocab MP3s (`vocab/`), Listening MP3s (`listening/`), Speaking MP3s (`speaking/`) | `backend/core/storage.py` |
| Local filesystem | `audio/`, `audio_listening/`, `audio_speaking/` | Local cache before upload | `backend/config.py:43-45` |

---

## Swapping Models — Checklist

1. **Change `AI_MODEL` env var** → affects: speaking review, shadow review, planner, freestyle LLM, listening explanation
2. **Change hardcoded `"qwen-plus"` in `qwen.py`** → affects: listening generation (quiz + intensive), custom scene generation, explanation
3. **Change `ADVISOR_MODEL` in `advisor_ai.py:12`** → affects: AI advisor only
4. **Change STT model in `speaking_ai.py:29`** → affects: all recording features (speaking, shadow, freestyle). Currently `qwen-omni-turbo` via chat completions. If DashScope re-enables `/audio/transcriptions`, revert to the simpler `client.audio.transcriptions.create()` call.
5. **Change TTS** → replace `edge_tts` calls in `audio.py`. All TTS goes through `_generate_edge_tts()`.
