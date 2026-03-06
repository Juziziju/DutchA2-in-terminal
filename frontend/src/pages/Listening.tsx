import { useCallback, useEffect, useRef, useState } from "react";
import {
  explainListening,
  generateListening,
  generateIntensive,
  submitListening,
  submitIntensive,
} from "../api";
import AudioPlayer from "../components/AudioPlayer";
import ScoreCard from "../components/ScoreCard";
import {
  ListeningLevel,
  ListeningMode,
  ContentType,
  useListeningState,
} from "../contexts/ListeningContext";
import { listeningAudioUrl } from "../api";

const LEVEL_CARDS: { level: ListeningLevel; label: string; accent: string; bg: string }[] = [
  { level: "A1", label: "A1", accent: "from-green-500 to-emerald-500", bg: "border-green-200 bg-green-50" },
  { level: "A2", label: "A2", accent: "from-blue-500 to-cyan-500", bg: "border-blue-200 bg-blue-50" },
  { level: "B1", label: "B1", accent: "from-purple-500 to-violet-500", bg: "border-purple-200 bg-purple-50" },
];

const CONTENT_TYPES: { type: ContentType; label: string; desc: string }[] = [
  { type: "dialogue", label: "Dialogue", desc: "2-speaker conversation" },
  { type: "news", label: "Short News", desc: "News report" },
  { type: "article", label: "Article", desc: "Informative narration" },
];

function LevelBadge({ level }: { level: string }) {
  const colors: Record<string, string> = {
    A1: "bg-green-100 text-green-700",
    A2: "bg-blue-100 text-blue-700",
    B1: "bg-purple-100 text-purple-700",
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${colors[level] ?? "bg-slate-100 text-slate-600"}`}>
      {level}
    </span>
  );
}

// ── Word-level diff highlighting ─────────────────────────────────────────────

function tokenize(text: string): string[] {
  return text.split(/\s+/).filter(Boolean);
}

function normalize(word: string): string {
  return word.toLowerCase().replace(/[^\w]/g, "");
}

function DiffLine({ original, userText }: { original: string; userText: string }) {
  const origWords = tokenize(original);
  const userWords = tokenize(userText);

  // Simple word-level comparison: align by position
  const maxLen = Math.max(origWords.length, userWords.length);
  const origHighlighted: { word: string; ok: boolean }[] = [];
  const userHighlighted: { word: string; ok: boolean }[] = [];

  for (let i = 0; i < maxLen; i++) {
    const ow = origWords[i] ?? "";
    const uw = userWords[i] ?? "";
    const match = normalize(ow) === normalize(uw) && ow !== "";
    if (ow) origHighlighted.push({ word: ow, ok: match });
    if (uw) userHighlighted.push({ word: uw, ok: match });
  }

  return (
    <div className="space-y-1">
      <p className="text-sm">
        <span className="text-xs text-slate-400 mr-1">Original:</span>
        {origHighlighted.map((w, i) => (
          <span key={i} className={w.ok ? "text-green-700" : "text-red-600 font-medium"}>
            {w.word}{" "}
          </span>
        ))}
      </p>
      <p className="text-sm">
        <span className="text-xs text-slate-400 mr-1">You typed:</span>
        {userHighlighted.length === 0 ? (
          <span className="text-slate-300 italic">empty</span>
        ) : (
          userHighlighted.map((w, i) => (
            <span key={i} className={w.ok ? "text-green-700" : "text-red-600 font-medium line-through"}>
              {w.word}{" "}
            </span>
          ))
        )}
      </p>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export default function Listening() {
  const { state: s, set, reset, intensive: iv, setIntensive, resetIntensive } = useListeningState();

  // ── Quiz handlers (unchanged logic) ──────────────────────────────────────

  async function handleGenerate(mode: ListeningMode, level: ListeningLevel) {
    set((p) => ({ ...p, phase: "generating", mode, level, error: "" }));
    try {
      const resp = await generateListening(mode, level);
      set((p) => ({ ...p, data: resp, answers: [], currentAudio: 0, playing: false, phase: "pre_play", startedAt: Date.now() }));
    } catch (e: unknown) {
      set((p) => ({ ...p, error: e instanceof Error ? e.message : "Generation failed.", phase: "idle" }));
    }
  }

  function startPlayback() {
    set((p) => ({ ...p, currentAudio: 0, playing: true }));
  }

  function onLineEnded() {
    set((p) => {
      const next = p.currentAudio + 1;
      if (p.data && next < p.data.dialogue.length) {
        return { ...p, currentAudio: next };
      }
      return { ...p, playing: false };
    });
  }

  function selectAnswer(qIdx: number, letter: string) {
    set((p) => {
      const a = [...p.answers];
      a[qIdx] = letter;
      return { ...p, answers: a };
    });
  }

  async function handleSubmit() {
    if (!s.data) return;
    const duration = s.startedAt ? Math.round((Date.now() - s.startedAt) / 1000) : undefined;
    const resp = await submitListening({
      session_id: s.data.session_id,
      topic: s.data.topic,
      dialogue: s.data.dialogue,
      questions: s.data.questions,
      user_answers: s.answers,
      vocab_used: s.data.vocab_used,
      mode: s.mode,
      level: s.level,
      duration_seconds: duration,
    });
    set((p) => ({ ...p, result: resp, phase: "results" }));
  }

  async function handleExplain() {
    if (!s.data || !s.result) return;
    set((p) => ({ ...p, explaining: true }));
    try {
      const r = await explainListening(s.data.topic, s.data.dialogue, s.data.questions, s.answers, s.level);
      set((p) => ({ ...p, explanation: r.explanation, phase: "explain", explaining: false }));
    } catch (e: unknown) {
      set((p) => ({
        ...p,
        explanation: e instanceof Error ? e.message : "Failed.",
        phase: "explain",
        explaining: false,
      }));
    }
  }

  // ── Intensive handlers ───────────────────────────────────────────────────

  async function handleIntensiveGenerate() {
    setIntensive((p) => ({ ...p, phase: "generating", error: "" }));
    try {
      const resp = await generateIntensive(iv.level, iv.contentType);
      setIntensive((p) => ({
        ...p,
        data: resp,
        currentLine: 0,
        userTexts: resp.lines.map(() => ""),
        phase: "dictation",
        startedAt: Date.now(),
      }));
    } catch (e: unknown) {
      setIntensive((p) => ({
        ...p,
        error: e instanceof Error ? e.message : "Generation failed.",
        phase: "select",
      }));
    }
  }

  async function handleIntensiveSubmit() {
    if (!iv.data) return;
    setIntensive((p) => ({ ...p, submitting: true, error: "" }));
    try {
      const duration = iv.startedAt ? Math.round((Date.now() - iv.startedAt) / 1000) : undefined;
      const resp = await submitIntensive({
        session_id: iv.data.session_id,
        topic: iv.data.topic,
        lines: iv.data.lines,
        user_texts: iv.userTexts,
        vocab_used: iv.data.vocab_used,
        level: iv.level,
        content_type: iv.contentType,
        duration_seconds: duration,
      });
      setIntensive((p) => ({ ...p, result: resp, phase: "results", submitting: false }));
    } catch (e: unknown) {
      setIntensive((p) => ({ ...p, error: e instanceof Error ? e.message : "Submit failed.", submitting: false }));
    }
  }

  // ── Decide which view to render ──────────────────────────────────────────

  const showingIntensive = iv.phase !== "idle";
  const showingQuiz = s.phase !== "idle";

  // If both are idle, show the combined idle screen
  if (!showingIntensive && !showingQuiz) {
    return <IdleScreen
      quizPhase={s.phase}
      quizError={s.error}
      onStartQuiz={() => set((p) => ({ ...p, phase: "select" }))}
      onStartIntensive={() => setIntensive((p) => ({ ...p, phase: "select" }))}
    />;
  }

  // Intensive flow
  if (showingIntensive) {
    return <IntensiveFlow
      iv={iv}
      setIntensive={setIntensive}
      resetIntensive={resetIntensive}
      onGenerate={handleIntensiveGenerate}
      onSubmit={handleIntensiveSubmit}
    />;
  }

  // Quiz flow (unchanged rendering)
  return <QuizFlow
    s={s}
    set={set}
    reset={reset}
    onGenerate={handleGenerate}
    startPlayback={startPlayback}
    onLineEnded={onLineEnded}
    selectAnswer={selectAnswer}
    handleSubmit={handleSubmit}
    handleExplain={handleExplain}
  />;
}

// ── Idle screen ──────────────────────────────────────────────────────────────

function IdleScreen({ quizPhase, quizError, onStartQuiz, onStartIntensive }: {
  quizPhase: string;
  quizError: string;
  onStartQuiz: () => void;
  onStartIntensive: () => void;
}) {
  return (
    <div className="max-w-lg mx-auto py-8 space-y-6">
      {/* Quiz card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-3xl">🎧</span>
          <h2 className="text-lg font-bold">Listening Quiz</h2>
        </div>
        <p className="text-slate-500 text-sm mb-4">
          AI generates a Dutch dialogue using your vocab, then you answer comprehension questions.
        </p>
        {quizError && <p className="text-red-500 text-sm mb-3">{quizError}</p>}
        <button
          onClick={onStartQuiz}
          className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-3 rounded-xl font-semibold hover:from-blue-700 hover:to-indigo-700 shadow-md"
        >
          Start Quiz
        </button>
      </div>

      {/* Intensive listening card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-3xl">🎯</span>
          <h2 className="text-lg font-bold">Intensive Listening</h2>
        </div>
        <p className="text-slate-500 text-sm mb-4">
          Listen sentence by sentence and type what you hear. Get detailed feedback with word-level comparison.
        </p>
        <button
          onClick={onStartIntensive}
          className="w-full bg-gradient-to-r from-amber-500 to-orange-500 text-white px-6 py-3 rounded-xl font-semibold hover:from-amber-600 hover:to-orange-600 shadow-md"
        >
          Start Intensive
        </button>
      </div>
    </div>
  );
}

// ── Intensive flow ───────────────────────────────────────────────────────────

function IntensiveFlow({ iv, setIntensive, resetIntensive, onGenerate, onSubmit }: {
  iv: ReturnType<typeof useListeningState>["intensive"];
  setIntensive: ReturnType<typeof useListeningState>["setIntensive"];
  resetIntensive: () => void;
  onGenerate: () => void;
  onSubmit: () => void;
}) {

  // ── Select phase ─────────────────────────────────────────────────────────

  if (iv.phase === "select" || iv.phase === "generating") {
    return (
      <div className="max-w-lg mx-auto py-8 space-y-6">
        <div className="flex items-center justify-between">
          <button onClick={resetIntensive} className="text-slate-500 hover:text-slate-800 text-sm">&larr; Back</button>
          <span className="text-sm font-semibold text-slate-600">Intensive Listening</span>
        </div>

        {/* Level selection */}
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Difficulty Level</p>
          <div className="grid grid-cols-3 gap-3">
            {LEVEL_CARDS.map((c) => (
              <button
                key={c.level}
                onClick={() => setIntensive((p) => ({ ...p, level: c.level }))}
                className={`rounded-2xl border p-4 flex flex-col items-center text-center transition-all ${
                  iv.level === c.level ? c.bg + " ring-2 ring-offset-1 ring-blue-400" : "border-slate-200 bg-white"
                }`}
              >
                <span className={`text-2xl font-bold bg-gradient-to-r ${c.accent} bg-clip-text text-transparent`}>
                  {c.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Content type selection */}
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Content Type</p>
          <div className="grid grid-cols-3 gap-3">
            {CONTENT_TYPES.map((ct) => (
              <button
                key={ct.type}
                onClick={() => setIntensive((p) => ({ ...p, contentType: ct.type }))}
                className={`rounded-2xl border p-4 text-center transition-all ${
                  iv.contentType === ct.type
                    ? "border-amber-300 bg-amber-50 ring-2 ring-offset-1 ring-amber-400"
                    : "border-slate-200 bg-white"
                }`}
              >
                <p className="font-semibold text-sm">{ct.label}</p>
                <p className="text-xs text-slate-500 mt-1">{ct.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {iv.error && <p className="text-red-500 text-sm">{iv.error}</p>}

        <button
          onClick={onGenerate}
          disabled={iv.phase === "generating"}
          className="w-full bg-gradient-to-r from-amber-500 to-orange-500 text-white py-3 rounded-xl font-semibold hover:from-amber-600 hover:to-orange-600 shadow-md disabled:opacity-50"
        >
          {iv.phase === "generating" ? "Generating..." : "Generate"}
        </button>
        {iv.phase === "generating" && (
          <p className="text-sm text-slate-400 text-center">Generating dialogue + audio, this takes ~10-20 seconds...</p>
        )}
      </div>
    );
  }

  // ── Dictation phase ──────────────────────────────────────────────────────

  if (iv.phase === "dictation" && iv.data) {
    return <DictationView
      iv={iv}
      setIntensive={setIntensive}
      resetIntensive={resetIntensive}
      onSubmit={onSubmit}
    />;
  }

  // ── Results phase ────────────────────────────────────────────────────────

  if (iv.phase === "results" && iv.data && iv.result) {
    return <IntensiveResults
      iv={iv}
      resetIntensive={resetIntensive}
      setIntensive={setIntensive}
    />;
  }

  return null;
}

// ── Dictation View (with keyboard controls) ──────────────────────────────────

function DictationView({ iv, setIntensive, resetIntensive, onSubmit }: {
  iv: ReturnType<typeof useListeningState>["intensive"];
  setIntensive: ReturnType<typeof useListeningState>["setIntensive"];
  resetIntensive: () => void;
  onSubmit: () => void;
}) {
  const data = iv.data!;
  const line = data.lines[iv.currentLine];
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [playing, setPlaying] = useState(false);
  const [showQuit, setShowQuit] = useState(false);

  const totalLines = data.lines.length;
  const isLast = iv.currentLine === totalLines - 1;

  // Play current line audio
  const playAudio = useCallback(() => {
    if (!line.audio_file) return;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    const a = new Audio(listeningAudioUrl(line.audio_file));
    audioRef.current = a;
    setPlaying(true);
    a.onended = () => setPlaying(false);
    a.play().catch(() => setPlaying(false));
  }, [line.audio_file]);

  const pauseAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      setPlaying(false);
    }
  }, []);

  const togglePlay = useCallback(() => {
    if (playing) pauseAudio();
    else playAudio();
  }, [playing, playAudio, pauseAudio]);

  // Auto-play on line change
  useEffect(() => {
    playAudio();
    inputRef.current?.focus();
    return () => { audioRef.current?.pause(); };
  }, [iv.currentLine]); // eslint-disable-line react-hooks/exhaustive-deps

  function goNext() {
    if (isLast) {
      onSubmit();
    } else {
      setIntensive((p) => ({ ...p, currentLine: p.currentLine + 1 }));
    }
  }

  function updateText(text: string) {
    setIntensive((p) => {
      const t = [...p.userTexts];
      t[p.currentLine] = text;
      return { ...p, userTexts: t };
    });
  }

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      const inInput = target.tagName === "TEXTAREA" || target.tagName === "INPUT";

      if (e.key === " " && !inInput) {
        e.preventDefault();
        togglePlay();
      }
      if (e.key === "r" && !inInput) {
        e.preventDefault();
        playAudio();
      }
      if (e.key === "ArrowRight" && !inInput) {
        e.preventDefault();
        goNext();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }); // re-bind every render to capture latest state

  return (
    <div className="max-w-lg mx-auto py-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button onClick={() => setShowQuit(true)} className="text-slate-500 hover:text-slate-800 text-sm">&larr; Exit</button>
        <div className="flex items-center gap-2">
          <LevelBadge level={iv.level} />
          <span className="text-xs text-slate-400 capitalize">{iv.contentType}</span>
        </div>
      </div>

      {/* Quit confirmation */}
      {showQuit && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
          <p className="text-sm font-medium text-amber-800">Exit intensive listening?</p>
          <p className="text-xs text-amber-600">Your progress will be lost unless you save.</p>
          <div className="flex gap-2">
            <button
              onClick={() => {
                // Save partial progress
                onSubmit();
              }}
              className="flex-1 bg-amber-500 text-white py-2 rounded-lg text-sm font-semibold hover:bg-amber-600"
            >
              Save & Exit
            </button>
            <button
              onClick={resetIntensive}
              className="flex-1 bg-red-500 text-white py-2 rounded-lg text-sm font-semibold hover:bg-red-600"
            >
              Discard & Exit
            </button>
            <button
              onClick={() => setShowQuit(false)}
              className="flex-1 border border-slate-300 py-2 rounded-lg text-sm hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Topic */}
      <div className="text-center">
        <p className="text-sm text-slate-500">Topic: <span className="font-medium text-slate-700">{data.topic}</span></p>
      </div>

      {/* Progress */}
      <div className="flex items-center gap-3">
        <div className="flex-1 bg-slate-200 rounded-full h-2">
          <div
            className="bg-amber-500 h-2 rounded-full transition-all"
            style={{ width: `${((iv.currentLine + 1) / totalLines) * 100}%` }}
          />
        </div>
        <span className="text-xs text-slate-500 font-medium">{iv.currentLine + 1}/{totalLines}</span>
      </div>

      {/* Audio controls */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium text-slate-700">
            {line.speaker && <span className="text-blue-600">{line.speaker}: </span>}
            Sentence {iv.currentLine + 1}
          </p>
          <span className={`text-xs px-2 py-0.5 rounded-full ${playing ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>
            {playing ? "Playing..." : "Paused"}
          </span>
        </div>

        <div className="flex gap-2">
          <button
            onClick={togglePlay}
            className="flex-1 bg-gradient-to-r from-amber-500 to-orange-500 text-white py-2.5 rounded-xl font-semibold hover:opacity-90 flex items-center justify-center gap-2"
          >
            {playing ? (
              <><svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><rect x="5" y="4" width="3" height="12" rx="1"/><rect x="12" y="4" width="3" height="12" rx="1"/></svg> Pause</>
            ) : (
              <><svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M6.3 2.84A1.5 1.5 0 004 4.11v11.78a1.5 1.5 0 002.3 1.27l9.344-5.891a1.5 1.5 0 000-2.538L6.3 2.841z"/></svg> Play</>
            )}
          </button>
          <button
            onClick={playAudio}
            className="px-4 border border-slate-300 rounded-xl text-sm hover:bg-slate-50 flex items-center gap-1"
            title="Replay (R)"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
            Replay
          </button>
        </div>

        <p className="text-xs text-slate-400 mt-2 text-center">
          Space: play/pause &middot; R: replay &middot; &rarr;: next sentence
        </p>
      </div>

      {/* Text input */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4">
        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 block">
          Type what you hear
        </label>
        <textarea
          ref={inputRef}
          value={iv.userTexts[iv.currentLine] ?? ""}
          onChange={(e) => updateText(e.target.value)}
          placeholder="Type the Dutch sentence you heard..."
          className="w-full border border-slate-300 rounded-xl p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
          rows={2}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              goNext();
            }
          }}
        />
      </div>

      {/* Error display */}
      {iv.error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3">
          <p className="text-sm text-red-600">{iv.error}</p>
        </div>
      )}

      {/* Navigation */}
      <div className="flex gap-2">
        <button
          onClick={() => setIntensive((p) => ({ ...p, currentLine: Math.max(0, p.currentLine - 1) }))}
          disabled={iv.currentLine === 0 || iv.submitting}
          className="flex-1 border border-slate-300 py-2.5 rounded-xl text-sm hover:bg-slate-50 disabled:opacity-30"
        >
          &larr; Previous
        </button>
        <button
          onClick={goNext}
          disabled={iv.submitting}
          className={`flex-1 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50 ${
            isLast
              ? "bg-gradient-to-r from-green-500 to-emerald-500 hover:opacity-90"
              : "bg-gradient-to-r from-amber-500 to-orange-500 hover:opacity-90"
          }`}
        >
          {iv.submitting ? "Submitting..." : isLast ? "Finish & Compare" : "Next \u2192"}
        </button>
      </div>

      {/* Line dots navigation */}
      <div className="flex justify-center gap-1.5 flex-wrap">
        {data.lines.map((_, i) => (
          <button
            key={i}
            onClick={() => setIntensive((p) => ({ ...p, currentLine: i }))}
            className={`w-6 h-6 rounded-full text-xs font-medium transition-all ${
              i === iv.currentLine
                ? "bg-amber-500 text-white"
                : iv.userTexts[i]
                  ? "bg-amber-100 text-amber-700"
                  : "bg-slate-100 text-slate-400"
            }`}
          >
            {i + 1}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Intensive Results ────────────────────────────────────────────────────────

function IntensiveResults({ iv, resetIntensive, setIntensive }: {
  iv: ReturnType<typeof useListeningState>["intensive"];
  resetIntensive: () => void;
  setIntensive: ReturnType<typeof useListeningState>["setIntensive"];
}) {
  const data = iv.data!;
  const result = iv.result!;
  const audioRef = useRef<HTMLAudioElement | null>(null);

  function playLine(audioFile: string | null) {
    if (!audioFile) return;
    if (audioRef.current) { audioRef.current.pause(); }
    const a = new Audio(listeningAudioUrl(audioFile));
    audioRef.current = a;
    a.play().catch(() => {});
  }

  function playAll() {
    const files = data.lines.map(l => l.audio_file).filter(Boolean) as string[];
    if (!files.length) return;
    if (audioRef.current) { audioRef.current.pause(); }
    let idx = 0;
    function playNext() {
      if (idx >= files.length) return;
      const a = new Audio(listeningAudioUrl(files[idx]));
      audioRef.current = a;
      a.onended = () => { idx++; playNext(); };
      a.play().catch(() => {});
    }
    playNext();
  }

  const correctCount = result.results.filter(r => r.correct).length;

  return (
    <div className="max-w-lg mx-auto py-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button onClick={resetIntensive} className="text-slate-500 hover:text-slate-800 text-sm">&larr; Back</button>
        <div className="flex items-center gap-2">
          <LevelBadge level={iv.level} />
          <span className="text-xs text-slate-400 capitalize">{iv.contentType}</span>
        </div>
      </div>

      {/* Score */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 text-center">
        <p className="text-4xl font-bold">{result.score_pct}%</p>
        <p className="text-sm text-slate-500 mt-1">
          {correctCount}/{result.results.length} sentences correct &middot; Topic: {data.topic}
        </p>
        <button
          onClick={playAll}
          className="mt-3 text-xs text-blue-500 hover:text-blue-700"
        >
          Play all audio
        </button>
      </div>

      {/* Line-by-line comparison */}
      <div className="space-y-3">
        {result.results.map((r, i) => (
          <div key={i} className={`bg-white rounded-2xl border p-4 ${r.correct ? "border-green-200" : "border-red-200"}`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className={`text-sm font-bold ${r.correct ? "text-green-500" : "text-red-500"}`}>
                  {r.correct ? "\u2713" : "\u2717"}
                </span>
                <span className="text-xs text-slate-400">Sentence {i + 1}</span>
                {data.lines[i].speaker && (
                  <span className="text-xs text-blue-500">{data.lines[i].speaker}</span>
                )}
              </div>
              {r.audio_file && (
                <button
                  onClick={() => playLine(r.audio_file)}
                  className="text-blue-400 hover:text-blue-600"
                  title="Replay"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M6.3 2.84A1.5 1.5 0 004 4.11v11.78a1.5 1.5 0 002.3 1.27l9.344-5.891a1.5 1.5 0 000-2.538L6.3 2.841z"/></svg>
                </button>
              )}
            </div>
            <DiffLine original={r.original} userText={r.user_text} />
            {data.lines[i].english && (
              <p className="text-xs text-slate-400 mt-2 italic">{data.lines[i].english}</p>
            )}
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={() => setIntensive((p) => ({ ...p, phase: "select" }))}
          className="flex-1 border border-slate-300 py-2.5 rounded-xl text-sm hover:bg-slate-50"
        >
          New Session
        </button>
        <button
          onClick={resetIntensive}
          className="flex-1 bg-gradient-to-r from-amber-500 to-orange-500 text-white py-2.5 rounded-xl text-sm font-semibold hover:opacity-90"
        >
          Back to Home
        </button>
      </div>
    </div>
  );
}

// ── Quiz flow (extracted, unchanged) ─────────────────────────────────────────

function QuizFlow({ s, set, reset, onGenerate, startPlayback, onLineEnded, selectAnswer, handleSubmit, handleExplain }: {
  s: ReturnType<typeof useListeningState>["state"];
  set: ReturnType<typeof useListeningState>["set"];
  reset: () => void;
  onGenerate: (mode: ListeningMode, level: ListeningLevel) => void;
  startPlayback: () => void;
  onLineEnded: () => void;
  selectAnswer: (qIdx: number, letter: string) => void;
  handleSubmit: () => void;
  handleExplain: () => void;
}) {

  // ── Select level phase ──────────────────────────────────────────────────

  if (s.phase === "select") {
    return (
      <div className="max-w-lg mx-auto py-8 space-y-6">
        <div className="flex items-center justify-between">
          <button onClick={reset} className="text-slate-500 hover:text-slate-800 text-sm">&larr; Back</button>
          <span className="text-sm font-semibold text-slate-600">Listening Quiz</span>
        </div>

        {/* Level selection */}
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Difficulty Level</p>
          <div className="grid grid-cols-3 gap-3">
            {LEVEL_CARDS.map((c) => (
              <button
                key={c.level}
                onClick={() => set((p) => ({ ...p, level: c.level }))}
                className={`rounded-2xl border p-4 flex flex-col items-center text-center transition-all ${
                  s.level === c.level ? c.bg + " ring-2 ring-offset-1 ring-blue-400" : "border-slate-200 bg-white"
                }`}
              >
                <span className={`text-2xl font-bold bg-gradient-to-r ${c.accent} bg-clip-text text-transparent`}>
                  {c.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        {s.error && <p className="text-red-500 text-sm">{s.error}</p>}

        <button
          onClick={() => onGenerate("quiz", s.level)}
          className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 rounded-xl font-semibold hover:from-blue-700 hover:to-indigo-700 shadow-md"
        >
          Generate Quiz
        </button>
      </div>
    );
  }

  // ── Generating phase ────────────────────────────────────────────────────

  if (s.phase === "generating") {
    return (
      <div className="flex flex-col items-center gap-4 py-12">
        <div className="animate-spin w-10 h-10 border-3 border-blue-400 border-t-transparent rounded-full" />
        <p className="text-lg font-semibold">Generating quiz...</p>
        <p className="text-sm text-slate-400">Generating dialogue + audio, this takes ~10-20 seconds...</p>
      </div>
    );
  }

  // ── Combined dialogue + questions phase ─────────────────────────────────
  // pre_play and quiz are merged: user sees dialogue, can play audio, and answer questions all on one page

  if ((s.phase === "pre_play" || s.phase === "quiz") && s.data) {
    const audioSrc =
      s.playing && s.data.dialogue[s.currentAudio]?.audio_file
        ? listeningAudioUrl(s.data.dialogue[s.currentAudio].audio_file!)
        : null;
    const allAnswered = s.answers.length === s.data.questions.length && s.answers.every(Boolean);

    return (
      <div className="max-w-lg mx-auto space-y-4 py-4">
        <div className="flex items-center justify-between">
          <button onClick={reset} className="text-slate-500 hover:text-slate-800 text-sm">&larr; Back</button>
          <div className="flex items-center gap-2">
            <LevelBadge level={s.level} />
            <button onClick={reset} className="text-xs text-slate-400 hover:text-red-500">Reset</button>
          </div>
        </div>

        {/* Topic + speakers */}
        <div>
          <h2 className="text-lg font-bold">Topic: {s.data.topic}</h2>
          <p className="text-sm text-slate-500">Speakers: {s.data.speakers.join(", ")}</p>
        </div>

        {/* Audio playback */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          {s.playing && audioSrc ? (
            <div className="mb-3">
              <p className="text-xs text-slate-500 mb-1">
                Line {s.currentAudio + 1}/{s.data.dialogue.length} — {s.data.dialogue[s.currentAudio].speaker}
              </p>
              <AudioPlayer src={audioSrc} autoPlay onEnded={onLineEnded} />
            </div>
          ) : (
            !s.playing && (
              <p className="text-xs text-slate-400 mb-3">Listen to the dialogue, then answer the questions below.</p>
            )
          )}
          <button
            onClick={startPlayback}
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-2.5 rounded-xl font-semibold hover:from-blue-700 hover:to-indigo-700 flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M6.3 2.84A1.5 1.5 0 004 4.11v11.78a1.5 1.5 0 002.3 1.27l9.344-5.891a1.5 1.5 0 000-2.538L6.3 2.841z"/></svg>
            {s.playing ? "Replay from start" : "Play dialogue"}
          </button>
        </div>

        {/* Questions — always visible */}
        <div className="space-y-4">
          {s.data.questions.map((q, i) => (
            <div key={i} className="bg-white rounded-2xl border border-slate-200 p-4">
              <p className="font-medium mb-3">Q{i + 1}. {q.question}</p>
              <div className="space-y-2">
                {Object.entries(q.options).map(([k, v]) => (
                  <button key={k} onClick={() => selectAnswer(i, k)} className={`w-full text-left px-4 py-2 rounded-lg border text-sm transition-colors ${s.answers[i] === k ? "border-blue-500 bg-blue-50 text-blue-800" : "border-slate-200 hover:bg-slate-50"}`}>
                    <span className="font-semibold mr-2">{k})</span>{v}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={!allAnswered}
          className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 rounded-xl font-semibold hover:from-blue-700 hover:to-indigo-700 disabled:opacity-40"
        >
          Submit answers
        </button>
      </div>
    );
  }

  if (s.phase === "results" && s.data && s.result) {
    return (
      <div className="max-w-lg mx-auto space-y-4">
        <ScoreCard score={s.result.score} total={s.result.total} scorePct={s.result.score_pct} label={`Topic: ${s.data.topic}`} />
        <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-2">
          {s.data.questions.map((q, i) => {
            const correct = s.result!.correct[i];
            return (
              <div key={i} className="flex items-start gap-2 text-sm">
                <span className={correct ? "text-green-500" : "text-red-500"}>{correct ? "\u2713" : "\u2717"}</span>
                <div>
                  <p className="text-slate-700">{q.question}</p>
                  {!correct && (
                    <p className="text-xs text-slate-400">Your: {s.answers[i]}) {q.options[s.answers[i]]} | Correct: {q.answer}) {q.options[q.answer]}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex gap-3">
          <button onClick={handleExplain} disabled={s.explaining} className="flex-1 border border-slate-300 py-2 rounded-xl text-sm hover:bg-slate-50 disabled:opacity-50">
            {s.explaining ? "Explaining..." : "Explain"}
          </button>
          <button onClick={() => set((p) => ({ ...p, phase: "select" }))} className="flex-1 border border-slate-300 py-2 rounded-xl text-sm hover:bg-slate-50">
            New exercise
          </button>
          <button onClick={reset} className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-2 rounded-xl text-sm font-semibold hover:from-blue-700 hover:to-indigo-700">
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  if (s.phase === "explain" && s.data && s.result) {
    return (
      <div className="max-w-lg mx-auto space-y-4">
        <h2 className="text-lg font-bold">Explanation — {s.data.topic}</h2>
        <div className="bg-white rounded-2xl border border-slate-200 p-4 text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
          {s.explanation}
        </div>
        <div className="flex gap-3">
          <button onClick={() => set((p) => ({ ...p, phase: "results" }))} className="flex-1 border border-slate-300 py-2 rounded-xl text-sm hover:bg-slate-50">
            Back to results
          </button>
          <button onClick={reset} className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-2 rounded-xl text-sm font-semibold hover:from-blue-700 hover:to-indigo-700">
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  return null;
}
