import { useEffect, useRef, useState } from "react";
import {
  getSpellScenes,
  generateSpellExercise,
  reviewTranslation,
  SpellScene,
  SpellPrompt,
  SpellResult,
  TranslationReviewResponse,
} from "../api";

type Phase = "select" | "loading" | "practice" | "feedback" | "summary";

const SCENE_ICONS: Record<string, string> = {
  supermarkt: "🛒",
  dokter: "🏥",
  station: "🚉",
  restaurant: "🍽️",
  gemeente: "🏛️",
  werk: "💼",
  winkel: "🛍️",
  email: "📧",
  apotheek: "💊",
  buren: "🏠",
  familie: "👨‍👩‍👧",
  routine: "☀️",
};

function getSceneIcon(scene: string | undefined): string {
  if (!scene) return "📝";
  const lower = scene.toLowerCase();
  for (const [key, icon] of Object.entries(SCENE_ICONS)) {
    if (lower.includes(key)) return icon;
  }
  return "📝";
}

function scoreColor(score: number) {
  if (score >= 80) return "text-green-600";
  if (score >= 60) return "text-yellow-600";
  return "text-red-600";
}

function scoreBg(score: number) {
  if (score >= 80) return "bg-green-50 border-green-200";
  if (score >= 60) return "bg-yellow-50 border-yellow-200";
  return "bg-red-50 border-red-200";
}

export default function SpellPractice({ onBack, replayPrompt }: { onBack: () => void; replayPrompt?: SpellPrompt | null }) {
  const [phase, setPhase] = useState<Phase>("select");
  const [scenes, setScenes] = useState<SpellScene[]>([]);
  const [level, setLevel] = useState("A2");
  const [selectedScene, setSelectedScene] = useState("");
  const [prompt, setPrompt] = useState<SpellPrompt | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const [results, setResults] = useState<SpellResult[]>([]);
  const [error, setError] = useState("");
  const [showVocab, setShowVocab] = useState(false);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [currentFeedback, setCurrentFeedback] = useState<TranslationReviewResponse | null>(null);
  const startTimeRef = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const replayConsumed = useRef(false);

  useEffect(() => {
    getSpellScenes().then(setScenes).catch(() => setError("Failed to load scenes"));
  }, []);

  useEffect(() => {
    if (replayPrompt && !replayConsumed.current) {
      replayConsumed.current = true;
      initExercise(replayPrompt);
    }
  }, [replayPrompt]);

  function initExercise(data: SpellPrompt) {
    setPrompt(data);
    setSelectedScene(data.scene_id);
    setLevel(data.level || "A2");
    setCurrentIndex(0);
    setAnswers(data.sentences.map(() => ""));
    setResults([]);
    setCurrentFeedback(null);
    setShowVocab(false);
    setReviewLoading(false);
    setError("");
    startTimeRef.current = Date.now();
    setPhase("practice");
  }

  async function startExercise(sceneId: string) {
    setSelectedScene(sceneId);
    setPhase("loading");
    setError("");
    try {
      const data = await generateSpellExercise(sceneId, level);
      initExercise(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to generate exercise");
      setPhase("select");
    }
  }

  async function handleSubmitSentence() {
    if (!prompt) return;
    const userText = answers[currentIndex].trim();
    if (!userText) return;

    setReviewLoading(true);
    setError("");
    const sentence = prompt.sentences[currentIndex];

    try {
      const review = await reviewTranslation(sentence.text_en, sentence.text_nl, userText, 0);
      setCurrentFeedback(review);
      setResults((prev) => [...prev, {
        sentence_index: currentIndex,
        text_en: sentence.text_en,
        text_nl: sentence.text_nl,
        user_text: userText,
        correct: review.correct,
        score: review.score,
        errors: review.errors,
        alternative_accepted: review.alternative_accepted,
        feedback_nl: review.feedback_nl,
        hints_penalty: 0,
      }]);
      setPhase("feedback");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to review");
    } finally {
      setReviewLoading(false);
    }
  }

  function handleNext() {
    if (!prompt) return;
    setCurrentFeedback(null);
    if (currentIndex < prompt.sentences.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setPhase("practice");
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setPhase("summary");
    }
  }

  // ── SELECT ────────────────────────────────────────────────────────────────

  if (phase === "select") {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="text-sm text-slate-500 hover:text-slate-700">&larr; Back</button>
          <h1 className="text-2xl font-bold">Translation Practice</h1>
        </div>
        <p className="text-slate-500 text-sm">Translate English → Dutch, one sentence at a time with instant AI feedback.</p>

        {error && <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm">{error}</div>}

        <div className="flex gap-2 items-center">
          <span className="text-sm font-medium text-slate-600">Level:</span>
          {["A1", "A2", "B1"].map((l) => (
            <button
              key={l}
              onClick={() => setLevel(l)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                level === l ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >{l}</button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {scenes.map((scene) => (
            <button
              key={scene.id}
              onClick={() => startExercise(scene.id)}
              className="bg-white rounded-xl border border-slate-200 p-4 text-left hover:shadow-md hover:border-blue-300 transition-all"
            >
              <h3 className="font-semibold">{scene.title_nl}</h3>
              <p className="text-sm text-slate-500">{scene.title_en}</p>
              <p className="text-xs text-slate-400 mt-1">{scene.description}</p>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ── LOADING ───────────────────────────────────────────────────────────────

  if (phase === "loading") {
    return (
      <div className="max-w-lg mx-auto text-center py-16">
        <div className="animate-spin text-4xl mb-4">✏️</div>
        <p className="text-slate-500">Generating exercise...</p>
      </div>
    );
  }

  // ── PRACTICE ──────────────────────────────────────────────────────────────

  if (phase === "practice" && prompt) {
    const sentence = prompt.sentences[currentIndex];
    const vocab = prompt.vocabulary || [];

    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <button onClick={onBack} className="text-sm text-slate-500 hover:text-slate-700">&larr; Quit</button>
          <span className="text-sm text-slate-500">{prompt.scene_title_nl} &middot; {prompt.level}</span>
        </div>

        {error && <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm">{error}</div>}

        {/* Progress */}
        <div className="w-full bg-slate-200 rounded-full h-2">
          <div className="bg-blue-600 h-2 rounded-full transition-all" style={{ width: `${((currentIndex + 1) / prompt.sentences.length) * 100}%` }} />
        </div>
        <p className="text-xs text-slate-400 text-center">Sentence {currentIndex + 1} of {prompt.sentences.length}</p>

        {/* English sentence */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 text-center">
          <div className="text-2xl mb-2">{getSceneIcon(sentence.scene || prompt.scene_id)}</div>
          <p className="text-lg font-medium text-blue-900">{sentence.text_en}</p>
          {sentence.grammar_focus && (
            <p className="text-xs text-slate-400 mt-2">Grammar: {sentence.grammar_focus}</p>
          )}
        </div>

        {/* Vocab panel */}
        {vocab.length > 0 && showVocab && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <p className="text-xs font-medium text-amber-700 mb-2">Vocabulary reference</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              {vocab.map((v, vi) => (
                <div key={vi} className="text-sm">
                  <span className="font-medium text-amber-900">{v.nl}</span>
                  <span className="text-amber-600"> — {v.en}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Input */}
        <input
          ref={inputRef}
          type="text"
          value={answers[currentIndex]}
          onChange={(e) => setAnswers((prev) => prev.map((a, i) => (i === currentIndex ? e.target.value : a)))}
          onKeyDown={(e) => e.key === "Enter" && !reviewLoading && answers[currentIndex].trim() && handleSubmitSentence()}
          placeholder="Type your Dutch translation..."
          className="w-full border border-slate-300 rounded-xl px-4 py-3 text-lg focus:outline-none focus:border-blue-400"
          autoFocus
        />

        {/* Buttons */}
        <div className="flex justify-between items-center">
          {vocab.length > 0 ? (
            <button
              onClick={() => setShowVocab(!showVocab)}
              className={`text-sm px-3 py-1.5 rounded-lg transition-colors ${
                showVocab ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600 hover:bg-amber-50"
              }`}
            >📖 {showVocab ? "Hide vocab" : "Vocab"}</button>
          ) : <div />}
          <button
            onClick={handleSubmitSentence}
            disabled={reviewLoading || !answers[currentIndex].trim()}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >{reviewLoading ? "Checking..." : "Submit"}</button>
        </div>
      </div>
    );
  }

  // ── FEEDBACK (per sentence) ───────────────────────────────────────────────

  if (phase === "feedback" && prompt && currentFeedback) {
    const sentence = prompt.sentences[currentIndex];
    const userText = answers[currentIndex];
    const fb = currentFeedback;
    const isLast = currentIndex === prompt.sentences.length - 1;

    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-500">Sentence {currentIndex + 1} of {prompt.sentences.length}</span>
          <span className={`text-sm font-bold ${scoreColor(fb.score)}`}>{fb.score} pts</span>
        </div>

        {/* Result banner */}
        <div className={`rounded-xl border p-4 ${fb.correct ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xl">{fb.correct ? "✓" : "✗"}</span>
            <span className={`font-semibold ${fb.correct ? "text-green-700" : "text-red-700"}`}>
              {fb.correct ? (fb.alternative_accepted ? "Correct (alternative accepted)" : "Correct!") : "Incorrect"}
            </span>
          </div>
          <p className="text-sm text-slate-500 mb-1">{sentence.text_en}</p>
          <p className="text-sm">
            <span className="text-slate-400">You: </span>
            <span className={fb.correct ? "text-green-700 font-medium" : "text-red-600"}>{userText || "(no answer)"}</span>
          </p>
          {!fb.correct && (
            <p className="text-sm mt-1">
              <span className="text-slate-400">Correct: </span>
              <span className="text-green-700 font-medium">{sentence.text_nl}</span>
            </p>
          )}
        </div>

        {/* Errors */}
        {fb.errors && fb.errors.length > 0 && (
          <div className="space-y-2">
            {fb.errors.map((err, ei) => (
              <div key={ei} className="bg-white rounded-lg border border-red-100 p-3 space-y-1">
                <p className="text-sm">
                  <span className="line-through text-red-500">{err.wrong}</span>
                  {" → "}
                  <span className="text-green-700 font-medium">{err.correct}</span>
                </p>
                {err.rule_nl && <p className="text-xs text-slate-600">📏 {err.rule_nl}</p>}
                {err.explanation_zh && <p className="text-xs text-slate-500">💡 {err.explanation_zh}</p>}
              </div>
            ))}
          </div>
        )}

        {fb.feedback_nl && <p className="text-sm text-slate-600 italic">{fb.feedback_nl}</p>}

        <button
          onClick={handleNext}
          className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700"
        >{isLast ? "View Summary" : "Next Sentence →"}</button>
      </div>
    );
  }

  // ── SUMMARY ───────────────────────────────────────────────────────────────

  if (phase === "summary" && prompt && results.length > 0) {
    const correctCount = results.filter((r) => r.correct).length;
    const totalScore = Math.round((correctCount / results.length) * 100);

    const ruleCounts: Record<string, number> = {};
    for (const r of results) {
      for (const e of (r.errors || [])) {
        if (e.rule_nl) ruleCounts[e.rule_nl] = (ruleCounts[e.rule_nl] || 0) + 1;
      }
    }
    const weakPoints = Object.entries(ruleCounts).sort((a, b) => b[1] - a[1]).map(([rule]) => rule);

    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="text-sm text-slate-500 hover:text-slate-700">&larr; Back</button>
          <h1 className="text-2xl font-bold">Summary</h1>
        </div>

        {/* Score */}
        <div className={`rounded-xl border p-5 text-center ${scoreBg(totalScore)}`}>
          <p className={`text-4xl font-bold ${scoreColor(totalScore)}`}>{totalScore}%</p>
          <p className="text-sm text-slate-600 mt-1">{correctCount} / {results.length} correct</p>
        </div>

        {/* Per-sentence */}
        <div className="space-y-2">
          {results.map((r) => (
            <div key={r.sentence_index} className={`bg-white rounded-lg border p-3 flex items-center gap-3 ${r.correct ? "border-green-200" : "border-red-200"}`}>
              <span className="text-lg">{r.correct ? "✓" : "✗"}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-600 truncate">{r.text_en}</p>
                <p className="text-xs text-slate-400 truncate">You: {r.user_text || "(empty)"}</p>
              </div>
              <span className={`text-sm font-bold flex-shrink-0 ${scoreColor(r.score)}`}>{r.score}</span>
            </div>
          ))}
        </div>

        {/* Weak points */}
        {weakPoints.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <h3 className="font-semibold text-sm text-amber-800 mb-2">Zwakke punten vandaag</h3>
            <div className="flex flex-wrap gap-2">
              {weakPoints.map((rule) => (
                <span key={rule} className="bg-amber-100 text-amber-700 text-xs px-2 py-1 rounded-lg">
                  {rule} ({ruleCounts[rule]}x)
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={() => prompt && initExercise(prompt)}
            className="flex-1 border border-blue-600 text-blue-600 py-2.5 rounded-lg font-medium hover:bg-blue-50"
          >Try Again</button>
          <button
            onClick={() => startExercise(selectedScene)}
            className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700"
          >New Questions</button>
        </div>
      </div>
    );
  }

  return null;
}
