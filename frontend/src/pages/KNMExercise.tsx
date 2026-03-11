import { useEffect, useRef, useState } from "react";
import {
  KNMCategoryStat,
  KNMGenerateResponse,
  KNMSubmitResponse,
  generateKNM,
  getKNMCategories,
  submitKNM,
} from "../api";
import TextSelectionPopup from "../components/TextSelectionPopup";

type Phase = "idle" | "generating" | "quiz" | "results";

const CATEGORY_ICONS: Record<string, string> = {
  werk: "💼",
  gezondheid: "🏥",
  geschiedenis: "🏛️",
  omgangsvormen: "🤝",
  wonen: "🏠",
  onderwijs: "🎓",
  financien: "💰",
};

export default function KNMExercise() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [categories, setCategories] = useState<KNMCategoryStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<KNMGenerateResponse | null>(null);
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [showTranslation, setShowTranslation] = useState(false);
  const [result, setResult] = useState<KNMSubmitResponse | null>(null);
  const [error, setError] = useState("");
  const questionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getKNMCategories()
      .then(setCategories)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function handleGenerate(category: string) {
    setPhase("generating");
    setError("");
    generateKNM(category)
      .then((res) => {
        setData(res);
        setCurrentQ(0);
        setAnswers({});
        setResult(null);
        setShowTranslation(false);
        setPhase("quiz");
      })
      .catch((e) => {
        setError(e.message);
        setPhase("idle");
      });
  }

  function handleSubmit() {
    if (!data) return;
    const userAnswers = data.questions.map((q) => answers[q.id] || "");

    submitKNM({
      category: data.category,
      questions: data.questions,
      user_answers: userAnswers,
    })
      .then((res) => {
        setResult(res);
        setPhase("results");
        getKNMCategories().then(setCategories).catch(() => {});
      })
      .catch((e) => setError(e.message));
  }

  function getContext(selectedText: string): string {
    if (!data || !data.questions[currentQ]) return "";
    const q = data.questions[currentQ];
    return q.context_nl || q.question_nl;
  }

  // ── Idle Phase ──
  if (phase === "idle") {
    return (
      <div className="max-w-2xl mx-auto">
        <h2 className="text-xl font-bold mb-1">KNM Practice</h2>
        <p className="text-sm text-slate-500 mb-6">Kennis van de Nederlandse Maatschappij — practice by category.</p>

        {loading && <p className="text-slate-400 text-sm">Loading categories...</p>}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {categories.map((cat) => (
            <button
              key={cat.category}
              onClick={() => handleGenerate(cat.category)}
              className="bg-white rounded-2xl border border-slate-200 p-5 text-left hover:shadow-md hover:border-blue-300 transition-all"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-2xl mb-2">{CATEGORY_ICONS[cat.category] || "📝"}</p>
                  <p className="font-semibold text-slate-800">{cat.label_nl}</p>
                  <p className="text-xs text-slate-500">{cat.label_en}</p>
                </div>
                {cat.attempts > 0 && (
                  <div className="text-right">
                    <span className={`text-sm font-bold ${(cat.avg_score ?? 0) >= 60 ? "text-green-600" : "text-red-500"}`}>
                      {cat.avg_score?.toFixed(0)}%
                    </span>
                    <p className="text-xs text-slate-400">{cat.attempts} tries</p>
                  </div>
                )}
              </div>
            </button>
          ))}

          {/* Mixed option */}
          <button
            onClick={() => {
              const keys = categories.map((c) => c.category);
              if (keys.length > 0) handleGenerate(keys[Math.floor(Math.random() * keys.length)]);
            }}
            className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border border-blue-200 p-5 text-left hover:shadow-md hover:border-blue-400 transition-all"
          >
            <p className="text-2xl mb-2">🎲</p>
            <p className="font-semibold text-blue-800">Mixed / Random</p>
            <p className="text-xs text-blue-500">Random category</p>
          </button>
        </div>

        {error && <p className="text-red-500 text-sm mt-4">{error}</p>}
      </div>
    );
  }

  // ── Generating Phase ──
  if (phase === "generating") {
    return (
      <div className="max-w-lg mx-auto text-center py-16">
        <svg className="w-10 h-10 animate-spin text-blue-500 mx-auto mb-4" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <p className="text-slate-600 font-medium">Generating KNM questions...</p>
        <p className="text-xs text-slate-400 mt-1">This may take a few seconds</p>
      </div>
    );
  }

  // ── Quiz Phase ──
  if (phase === "quiz" && data) {
    const q = data.questions[currentQ];
    const totalQ = data.questions.length;
    const allAnswered = data.questions.every((qq) => answers[qq.id]);

    return (
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold capitalize">
              {CATEGORY_ICONS[data.category]} {categories.find((c) => c.category === data.category)?.label_nl || data.category}
            </h2>
            <p className="text-xs text-slate-500">Question {currentQ + 1} of {totalQ}</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowTranslation(!showTranslation)}
              className={`text-xs px-3 py-1 rounded-lg font-medium border ${
                showTranslation ? "bg-blue-600 text-white border-blue-600" : "text-slate-600 border-slate-200"
              }`}
            >
              {showTranslation ? "Hide EN" : "Show EN"}
            </button>
            <button onClick={() => { setPhase("idle"); setData(null); }} className="text-sm text-slate-500 hover:text-slate-700">
              Back
            </button>
          </div>
        </div>

        {/* Progress dots */}
        <div className="flex gap-1.5 mb-4">
          {data.questions.map((qq, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full ${
                answers[qq.id] ? "bg-blue-500" : i === currentQ ? "bg-blue-200" : "bg-slate-200"
              }`}
            />
          ))}
        </div>

        {/* Question */}
        <div ref={questionRef} className="relative bg-white rounded-2xl border border-slate-200 p-6 mb-4">
          {q.context_nl && (
            <div className="bg-slate-50 rounded-lg p-3 mb-4 text-sm text-slate-700 select-text">
              {q.context_nl}
              {showTranslation && q.context_en && (
                <p className="text-xs text-slate-400 mt-1">{q.context_en}</p>
              )}
            </div>
          )}

          <p className="text-lg font-medium text-slate-800 mb-1 select-text">{q.question_nl}</p>
          {showTranslation && (
            <p className="text-sm text-slate-400 mb-4">{q.question_en}</p>
          )}

          <div className="space-y-2 mt-4">
            {Object.entries(q.options).map(([key, val]) => (
              <button
                key={key}
                onClick={() => setAnswers((prev) => ({ ...prev, [q.id]: key }))}
                className={`w-full text-left px-4 py-3 rounded-xl text-sm border transition-colors ${
                  answers[q.id] === key
                    ? "bg-blue-50 border-blue-400 text-blue-700 font-medium"
                    : "border-slate-200 text-slate-700 hover:border-slate-300"
                }`}
              >
                <span className="font-semibold mr-2">{key}.</span> {val}
                {showTranslation && q.options_en?.[key] && (
                  <span className="text-xs text-slate-400 ml-2">({q.options_en[key]})</span>
                )}
              </button>
            ))}
          </div>

          <TextSelectionPopup containerRef={questionRef} source="knm" getContext={getContext} />
        </div>

        {/* Navigation */}
        <div className="flex gap-3">
          <button
            onClick={() => setCurrentQ(Math.max(0, currentQ - 1))}
            disabled={currentQ === 0}
            className="px-4 py-2 rounded-xl text-sm font-medium border border-slate-200 text-slate-600 disabled:opacity-40"
          >
            Previous
          </button>
          {currentQ < totalQ - 1 ? (
            <button
              onClick={() => setCurrentQ(currentQ + 1)}
              className="flex-1 bg-blue-600 text-white py-2 rounded-xl text-sm font-semibold hover:bg-blue-700"
            >
              Next
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={!allAnswered}
              className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-2 rounded-xl text-sm font-semibold hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50"
            >
              Submit Answers
            </button>
          )}
        </div>

        {error && <p className="text-red-500 text-sm mt-3">{error}</p>}
      </div>
    );
  }

  // ── Results Phase ──
  if (phase === "results" && data && result) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl border border-slate-200 p-6 text-center mb-6">
          <p className={`text-5xl font-bold ${result.score_pct >= 60 ? "text-green-600" : "text-red-500"}`}>
            {result.score_pct}%
          </p>
          <p className="text-slate-500 mt-1">{result.score} / {result.total} correct</p>
          <p className="text-xs text-slate-400 mt-1 capitalize">
            {CATEGORY_ICONS[data.category]} {categories.find((c) => c.category === data.category)?.label_nl || data.category}
          </p>
        </div>

        <div className="space-y-3 mb-6">
          {result.results.map((r, idx) => {
            const q = data.questions[idx];
            return (
              <div key={r.id} className={`rounded-2xl border p-4 ${r.correct ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
                <div className="flex items-start gap-2 mb-2">
                  <span className={`text-sm font-bold ${r.correct ? "text-green-600" : "text-red-500"}`}>
                    {r.correct ? "\u2713" : "\u2717"}
                  </span>
                  <div>
                    <p className="font-medium text-sm">{idx + 1}. {q?.question_nl}</p>
                    <p className="text-xs text-slate-400">{q?.question_en}</p>
                  </div>
                </div>
                <div className="ml-5 space-y-1">
                  {q && Object.entries(q.options).map(([key, val]) => {
                    const isCorrect = key === r.correct_answer;
                    const isUser = key === r.user_answer;
                    let cls = "text-xs px-2 py-1 rounded";
                    if (isCorrect) cls += " bg-green-100 text-green-700 font-medium";
                    else if (isUser && !r.correct) cls += " bg-red-100 text-red-600 line-through";
                    else cls += " text-slate-600";
                    const enText = q.options_en?.[key];
                    return (
                      <div key={key} className={cls}>
                        {key}. {val}
                        {enText && <span className="text-slate-400 ml-1">({enText})</span>}
                        {isCorrect && " \u2713"} {isUser && !r.correct && " \u2717"}
                      </div>
                    );
                  })}
                  {r.explanation_en && (
                    <p className="text-xs text-slate-600 mt-2 italic">{r.explanation_en}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <button
          onClick={() => { setPhase("idle"); setData(null); setResult(null); }}
          className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 rounded-xl font-semibold hover:from-blue-700 hover:to-indigo-700 shadow-md"
        >
          New Exercise
        </button>
      </div>
    );
  }

  return null;
}
