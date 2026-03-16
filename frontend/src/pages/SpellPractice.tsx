import { useEffect, useRef, useState } from "react";
import {
  getSpellScenes,
  generateSpellExercise,
  submitSpellExercise,
  reviewSpellSentence,
  SpellScene,
  SpellPrompt,
  SpellFeedback,
  SpellResult,
} from "../api";

type Phase = "select" | "loading" | "practice" | "submitting" | "review";

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
  const [selectedScene, setSelectedScene] = useState<string>("");
  const [prompt, setPrompt] = useState<SpellPrompt | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const [hintMode, setHintMode] = useState<boolean[]>([]);
  const [hintInputs, setHintInputs] = useState<Record<number, Record<number, string>>>({});
  const [feedback, setFeedback] = useState<SpellFeedback | null>(null);
  const [error, setError] = useState("");
  const [showVocab, setShowVocab] = useState(false);
  const [vocabUsed, setVocabUsed] = useState(false);
  // Per-sentence AI review state
  const [reviewingIndex, setReviewingIndex] = useState<number | null>(null);
  const startTimeRef = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const replayConsumed = useRef(false);

  useEffect(() => {
    getSpellScenes().then(setScenes).catch(() => setError("Failed to load scenes"));
  }, []);

  // Handle replay prompt from StudyMaterial "Practice Again"
  useEffect(() => {
    if (replayPrompt && !replayConsumed.current) {
      replayConsumed.current = true;
      setPrompt(replayPrompt);
      setSelectedScene(replayPrompt.scene_id);
      setLevel(replayPrompt.level || "A2");
      setCurrentIndex(0);
      setAnswers(replayPrompt.sentences.map(() => ""));
      setHintMode(replayPrompt.sentences.map(() => false));
      setHintInputs({});
      setFeedback(null);
      setShowVocab(false);
      setVocabUsed(false);
      setReviewingIndex(null);
      startTimeRef.current = Date.now();
      setPhase("practice");
    }
  }, [replayPrompt]);

  async function startExercise(sceneId: string) {
    setSelectedScene(sceneId);
    setPhase("loading");
    setError("");
    setShowVocab(false);
    setVocabUsed(false);
    setReviewingIndex(null);
    try {
      const data = await generateSpellExercise(sceneId, level);
      setPrompt(data);
      setCurrentIndex(0);
      setAnswers(data.sentences.map(() => ""));
      setHintMode(data.sentences.map(() => false));
      setHintInputs({});
      startTimeRef.current = Date.now();
      setPhase("practice");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to generate exercise");
      setPhase("select");
    }
  }

  function toggleHint(index: number) {
    setHintMode((prev) => prev.map((h, i) => (i === index ? !h : h)));
  }

  function toggleVocab() {
    const next = !showVocab;
    setShowVocab(next);
    if (next) setVocabUsed(true);
  }

  function buildAnswerFromHints(sentenceIndex: number): string {
    if (!prompt) return "";
    const sentence = prompt.sentences[sentenceIndex];
    const parts = sentence.hint_parts;
    const inputs = hintInputs[sentenceIndex] || {};
    return parts
      .map((part, i) => (part !== null ? part : (inputs[i] || "___")))
      .join(" ");
  }

  function handleNext() {
    if (!prompt) return;

    const updatedAnswers = [...answers];
    if (hintMode[currentIndex]) {
      updatedAnswers[currentIndex] = buildAnswerFromHints(currentIndex);
    }
    setAnswers(updatedAnswers);

    if (currentIndex < prompt.sentences.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      handleSubmit(updatedAnswers);
    }
  }

  async function handleSubmit(finalAnswers: string[]) {
    if (!prompt) return;
    setPhase("submitting");
    setError("");

    const duration = Math.round((Date.now() - startTimeRef.current) / 1000);
    const answerPayload = finalAnswers.map((text, i) => ({
      sentence_index: i,
      user_text: text,
    }));

    try {
      const res = await submitSpellExercise({
        prompt,
        answers: answerPayload,
        duration_seconds: duration,
      });
      setFeedback(res.feedback);
      setPhase("review");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to submit");
      setPhase("practice");
    }
  }

  async function handleAiReview(r: SpellResult) {
    if (!feedback || !r.user_text) return;
    setReviewingIndex(r.sentence_index);
    try {
      const res = await reviewSpellSentence(r.text_en, r.text_nl, r.user_text);
      // Update the result in feedback
      setFeedback((prev) => {
        if (!prev) return prev;
        const newResults = prev.results.map((item) => {
          if (item.sentence_index !== r.sentence_index) return item;
          return {
            ...item,
            correct: res.correct,
            feedback: res.feedback,
            ai_reviewed: true,
          };
        });
        const newCorrect = newResults.filter((x) => x.correct).length;
        const newScore = Math.round((newCorrect / Math.max(prev.total_sentences, 1)) * 100);
        return {
          ...prev,
          results: newResults,
          correct_count: newCorrect,
          score: newScore,
        };
      });
    } catch {
      // silently fail
    } finally {
      setReviewingIndex(null);
    }
  }

  function handleTryAgain() {
    startExercise(selectedScene);
  }

  // ── SELECT PHASE ──────────────────────────────────────────────────────────

  if (phase === "select") {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="text-sm text-slate-500 hover:text-slate-700">
            &larr; Back
          </button>
          <h1 className="text-2xl font-bold">Spell Practice</h1>
        </div>
        <p className="text-slate-500 text-sm">
          Translate English sentences to Dutch. Choose a scene and level to start.
        </p>

        {error && <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm">{error}</div>}

        {/* Level selector */}
        <div className="flex gap-2 items-center">
          <span className="text-sm font-medium text-slate-600">Level:</span>
          {["A1", "A2", "B1"].map((l) => (
            <button
              key={l}
              onClick={() => setLevel(l)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                level === l
                  ? "bg-blue-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {l}
            </button>
          ))}
        </div>

        {/* Scene cards */}
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

  // ── LOADING / SUBMITTING ──────────────────────────────────────────────────

  if (phase === "loading" || phase === "submitting") {
    return (
      <div className="max-w-lg mx-auto text-center py-16">
        <div className="animate-spin text-4xl mb-4">
          {phase === "loading" ? "✏️" : "📤"}
        </div>
        <p className="text-slate-500">
          {phase === "loading" ? "Generating exercise..." : "Checking your answers..."}
        </p>
      </div>
    );
  }

  // ── PRACTICE PHASE ────────────────────────────────────────────────────────

  if (phase === "practice" && prompt) {
    const sentence = prompt.sentences[currentIndex];
    const isLast = currentIndex === prompt.sentences.length - 1;
    const usingHint = hintMode[currentIndex];
    const vocab = prompt.vocabulary || [];

    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <button onClick={onBack} className="text-sm text-slate-500 hover:text-slate-700">
            &larr; Quit
          </button>
          <span className="text-sm text-slate-500">
            {prompt.scene_title_nl} &middot; {prompt.level}
          </span>
        </div>

        {error && <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm">{error}</div>}

        {/* Progress bar */}
        <div className="w-full bg-slate-200 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all"
            style={{ width: `${((currentIndex + 1) / prompt.sentences.length) * 100}%` }}
          />
        </div>
        <p className="text-xs text-slate-400 text-center">
          Sentence {currentIndex + 1} of {prompt.sentences.length}
        </p>

        {/* English sentence */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 text-center">
          <p className="text-lg font-medium text-blue-900">{sentence.text_en}</p>
        </div>

        {/* Vocabulary panel (collapsible) */}
        {vocab.length > 0 && showVocab && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-amber-700">
                Vocabulary reference <span className="text-amber-400">(not counted in score)</span>
              </p>
            </div>
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

        {/* Input area */}
        {!usingHint ? (
          <div>
            <input
              ref={inputRef}
              type="text"
              value={answers[currentIndex]}
              onChange={(e) =>
                setAnswers((prev) => prev.map((a, i) => (i === currentIndex ? e.target.value : a)))
              }
              onKeyDown={(e) => e.key === "Enter" && handleNext()}
              placeholder="Type your Dutch translation..."
              className="w-full border border-slate-300 rounded-xl px-4 py-3 text-lg focus:outline-none focus:border-blue-400"
              autoFocus
            />
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-xs text-slate-400 mb-2">Fill in the missing words:</p>
            <div className="flex flex-wrap gap-2 items-center">
              {sentence.hint_parts.map((part, pi) =>
                part !== null ? (
                  <span key={pi} className="text-lg font-medium text-slate-700">
                    {part}
                  </span>
                ) : (
                  <input
                    key={pi}
                    type="text"
                    value={hintInputs[currentIndex]?.[pi] || ""}
                    onChange={(e) =>
                      setHintInputs((prev) => ({
                        ...prev,
                        [currentIndex]: {
                          ...(prev[currentIndex] || {}),
                          [pi]: e.target.value,
                        },
                      }))
                    }
                    onKeyDown={(e) => e.key === "Enter" && handleNext()}
                    className="border-b-2 border-blue-400 bg-blue-50 px-2 py-1 text-lg w-24 text-center focus:outline-none focus:border-blue-600"
                    autoFocus={pi === sentence.hint_parts.findIndex((p) => p === null)}
                  />
                )
              )}
            </div>
          </div>
        )}

        {/* Buttons */}
        <div className="flex justify-between items-center">
          <div className="flex gap-2">
            <button
              onClick={() => toggleHint(currentIndex)}
              className={`text-sm px-3 py-1.5 rounded-lg transition-colors ${
                usingHint
                  ? "bg-yellow-100 text-yellow-700"
                  : "bg-slate-100 text-slate-600 hover:bg-yellow-50"
              }`}
              title="Toggle hint mode"
            >
              💡 {usingHint ? "Hide hints" : "Show hints"}
            </button>
            {vocab.length > 0 && (
              <button
                onClick={toggleVocab}
                className={`text-sm px-3 py-1.5 rounded-lg transition-colors ${
                  showVocab
                    ? "bg-amber-100 text-amber-700"
                    : "bg-slate-100 text-slate-600 hover:bg-amber-50"
                }`}
                title="Toggle vocabulary reference"
              >
                📖 {showVocab ? "Hide vocab" : "Vocab"}
              </button>
            )}
          </div>
          <button
            onClick={handleNext}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700"
          >
            {isLast ? "Submit" : "Next →"}
          </button>
        </div>
      </div>
    );
  }

  // ── REVIEW PHASE ──────────────────────────────────────────────────────────

  if (phase === "review" && feedback) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="text-sm text-slate-500 hover:text-slate-700">
            &larr; Back
          </button>
          <h1 className="text-2xl font-bold">Results</h1>
        </div>

        {/* Score header */}
        <div className={`rounded-xl border p-5 text-center ${scoreBg(feedback.score)}`}>
          <p className={`text-4xl font-bold ${scoreColor(feedback.score)}`}>{feedback.score}%</p>
          <p className="text-sm text-slate-600 mt-1">
            {feedback.correct_count} / {feedback.total_sentences} correct
          </p>
          {vocabUsed && (
            <p className="text-xs text-amber-600 mt-1">📖 Vocabulary reference was used</p>
          )}
          <p className="text-sm text-slate-500 mt-2">{feedback.feedback_en}</p>
          <p className="text-sm text-slate-400">{feedback.feedback_nl}</p>
        </div>

        {/* Per-sentence results */}
        <div className="space-y-3">
          {feedback.results.map((r) => (
            <div
              key={r.sentence_index}
              className={`bg-white rounded-xl border p-4 ${
                r.correct ? "border-green-200" : "border-red-200"
              }`}
            >
              <div className="flex items-start gap-2">
                <span className="text-xl mt-0.5">{r.correct ? "✓" : "✗"}</span>
                <div className="flex-1 space-y-1">
                  <p className="text-sm text-slate-500">{r.text_en}</p>
                  <p className="text-sm">
                    <span className="text-slate-400">You wrote: </span>
                    <span className={r.correct ? "text-green-700 font-medium" : "text-red-600"}>
                      {r.user_text || "(no answer)"}
                    </span>
                  </p>
                  {!r.correct && (
                    <p className="text-sm">
                      <span className="text-slate-400">Correct: </span>
                      <span className="text-green-700 font-medium">{r.text_nl}</span>
                    </p>
                  )}
                  {r.feedback && (
                    <p className="text-xs text-slate-500 italic">{r.feedback}</p>
                  )}
                  {r.ai_reviewed && r.correct && (
                    <span className="inline-block text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                      AI verified ✓
                    </span>
                  )}
                  {r.ai_reviewed && !r.correct && (
                    <span className="inline-block text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">
                      AI reviewed
                    </span>
                  )}
                  {/* AI Review button — only for wrong, non-empty, not yet reviewed */}
                  {!r.correct && !r.ai_reviewed && r.user_text && (
                    <button
                      onClick={() => handleAiReview(r)}
                      disabled={reviewingIndex !== null}
                      className="text-xs bg-indigo-50 text-indigo-600 px-3 py-1 rounded-lg hover:bg-indigo-100 disabled:opacity-50 transition-colors"
                    >
                      {reviewingIndex === r.sentence_index ? "Reviewing..." : "🤖 AI Review"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Action buttons */}
        <div className="flex gap-3">
          <button
            onClick={handleTryAgain}
            className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700"
          >
            Try Again
          </button>
          <button
            onClick={onBack}
            className="flex-1 bg-slate-100 text-slate-700 py-2.5 rounded-lg font-medium hover:bg-slate-200"
          >
            Back to Scenes
          </button>
        </div>
      </div>
    );
  }

  return null;
}
