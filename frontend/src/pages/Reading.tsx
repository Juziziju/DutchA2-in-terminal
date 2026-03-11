import { useRef, useState } from "react";
import {
  ReadingGenerateResponse,
  ReadingSubmitResponse,
  generateReading,
  submitReading,
  explainReading,
} from "../api";
import TextSelectionPopup from "../components/TextSelectionPopup";

type Phase = "idle" | "generating" | "reading" | "results";

const CONTENT_TYPES = [
  { key: "short_text", label: "Short Text", icon: "📋", desc: "Notices, signs, labels" },
  { key: "email", label: "Email / Letter", icon: "✉️", desc: "Formal or informal" },
  { key: "advertisement", label: "Advertisement", icon: "📰", desc: "Jobs, housing, products" },
  { key: "notice", label: "Official Notice", icon: "🏛️", desc: "Gemeente, school, employer" },
  { key: "article", label: "Article", icon: "📄", desc: "News or magazine" },
];

const LEVELS = ["A1", "A2", "B1"];

const READING_TOPICS: Record<string, string[]> = {
  short_text: [
    "Train departure notice",
    "Supermarket opening hours sign",
    "Parking rules sign",
    "Library return policy",
    "Recycling instructions",
  ],
  email: [
    "Appointment confirmation from the huisarts",
    "School newsletter about a field trip",
    "Landlord letter about rent increase",
    "Gemeente letter about new DigiD",
    "Colleague email about a team meeting",
    "Invitation to a neighborhood event",
  ],
  advertisement: [
    "Room for rent in a shared house",
    "Supermarket weekly deals",
    "Part-time job at a restaurant",
    "Second-hand furniture on Marktplaats",
    "Dutch language course enrollment",
  ],
  notice: [
    "Gemeente notice about road construction",
    "School closure due to weather",
    "Employer notice about holiday schedule",
    "Building fire safety rules",
    "New waste collection schedule",
  ],
  article: [
    "Dutch cycling culture",
    "How the Dutch healthcare system works",
    "King's Day celebrations across the Netherlands",
    "Climate change and rising sea levels",
    "Working part-time in the Netherlands",
    "The tradition of Sinterklaas",
  ],
};

export default function Reading() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [level, setLevel] = useState("A2");
  const [topic, setTopic] = useState("");
  const [data, setData] = useState<ReadingGenerateResponse | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<ReadingSubmitResponse | null>(null);
  const [showEnglish, setShowEnglish] = useState(false);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [explainLoading, setExplainLoading] = useState(false);
  const [error, setError] = useState("");
  const passageRef = useRef<HTMLDivElement>(null);
  const startTime = useRef(0);

  function handleGenerate(contentType: string) {
    setPhase("generating");
    setError("");
    startTime.current = Date.now();
    generateReading(contentType, level, topic)
      .then((res) => {
        setData(res);
        setAnswers({});
        setResult(null);
        setExplanation(null);
        setShowEnglish(false);
        setPhase("reading");
      })
      .catch((e) => {
        setError(e.message);
        setPhase("idle");
      });
  }

  function handleSubmit() {
    if (!data) return;
    const userAnswers = data.questions.map((q) => answers[q.id] || "");
    if (userAnswers.some((a) => !a)) return;

    const duration = Math.round((Date.now() - startTime.current) / 1000);

    submitReading({
      content_type: data.content_type,
      topic: data.topic,
      title_nl: data.title_nl,
      passage_nl: data.passage_nl,
      passage_en: data.passage_en,
      questions: data.questions,
      user_answers: userAnswers,
      level: data.level,
      duration_seconds: duration,
    })
      .then((res) => {
        setResult(res);
        setPhase("results");
      })
      .catch((e) => setError(e.message));
  }

  function handleExplain() {
    if (!data || explainLoading) return;
    setExplainLoading(true);
    const userAnswers = data.questions.map((q) => answers[q.id] || "");
    explainReading({
      passage_nl: data.passage_nl,
      passage_en: data.passage_en,
      questions: data.questions,
      user_answers: userAnswers,
      level: data.level,
    })
      .then((res) => setExplanation(res.explanation))
      .catch(() => setExplanation("Could not generate explanation."))
      .finally(() => setExplainLoading(false));
  }

  function getContext(selectedText: string): string {
    if (!data) return "";
    const sentences = data.passage_nl.split(/[.!?]+/).map((s) => s.trim()).filter(Boolean);
    return sentences.find((s) => s.includes(selectedText)) || "";
  }

  // ── Idle Phase ──
  if (phase === "idle") {
    return (
      <div className="max-w-2xl mx-auto">
        <h2 className="text-xl font-bold mb-1">Reading Practice</h2>
        <p className="text-sm text-slate-500 mb-6">Choose a text type to practice Inburgering reading comprehension.</p>

        <div className="flex gap-2 mb-6">
          {LEVELS.map((l) => (
            <button
              key={l}
              onClick={() => setLevel(l)}
              className={`px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${
                level === l
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-slate-600 border-slate-200 hover:border-blue-400"
              }`}
            >
              {l}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
          {CONTENT_TYPES.map((ct) => (
            <button
              key={ct.key}
              onClick={() => { setTopic(""); handleGenerate(ct.key); }}
              className="bg-white rounded-2xl border border-slate-200 p-5 text-left hover:shadow-md hover:border-blue-300 transition-all"
            >
              <p className="text-2xl mb-2">{ct.icon}</p>
              <p className="font-semibold text-slate-800">{ct.label}</p>
              <p className="text-xs text-slate-500 mt-1">{ct.desc}</p>
            </button>
          ))}
        </div>

        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Or pick a specific topic</p>
        {CONTENT_TYPES.map((ct) => {
          const topics = READING_TOPICS[ct.key] || [];
          if (!topics.length) return null;
          return (
            <div key={ct.key} className="mb-4">
              <p className="text-sm font-medium text-slate-600 mb-2">{ct.icon} {ct.label}</p>
              <div className="flex flex-wrap gap-2">
                {topics.map((t) => (
                  <button
                    key={t}
                    onClick={() => { setTopic(t); handleGenerate(ct.key); }}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700 transition-all"
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          );
        })}

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
        <p className="text-slate-600 font-medium">Generating reading passage...</p>
        <p className="text-xs text-slate-400 mt-1">This may take a few seconds</p>
      </div>
    );
  }

  // ── Reading Phase ──
  if (phase === "reading" && data) {
    const allAnswered = data.questions.every((q) => answers[q.id]);
    return (
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold">{data.title_nl}</h2>
            <div className="flex gap-2 mt-1">
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">{data.level}</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 capitalize">{data.content_type.replace(/_/g, " ")}</span>
            </div>
          </div>
          <button onClick={() => { setPhase("idle"); setData(null); }} className="text-sm text-slate-500 hover:text-slate-700">
            Back
          </button>
        </div>

        {/* Passage with text selection */}
        <div ref={passageRef} className="relative bg-white rounded-2xl border border-slate-200 p-6 mb-6">
          <p className="text-slate-800 leading-relaxed whitespace-pre-line select-text">{data.passage_nl}</p>
          <TextSelectionPopup containerRef={passageRef} source="reading" getContext={getContext} />
        </div>

        {/* Questions */}
        <div className="space-y-4 mb-6">
          {data.questions.map((q, idx) => (
            <div key={q.id} className="bg-white rounded-2xl border border-slate-200 p-4">
              <p className="font-medium text-sm mb-1">{idx + 1}. {q.question_nl}</p>
              <p className="text-xs text-slate-400 mb-3">{q.question_en}</p>
              <div className="space-y-2">
                {Object.entries(q.options).map(([key, val]) => (
                  <button
                    key={key}
                    onClick={() => setAnswers((prev) => ({ ...prev, [q.id]: key }))}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm border transition-colors ${
                      answers[q.id] === key
                        ? "bg-blue-50 border-blue-400 text-blue-700 font-medium"
                        : "border-slate-200 text-slate-700 hover:border-slate-300"
                    }`}
                  >
                    <span className="font-medium mr-2">{key}.</span> {val}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={handleSubmit}
          disabled={!allAnswered}
          className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 rounded-xl font-semibold hover:from-blue-700 hover:to-indigo-700 shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Submit Answers
        </button>

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
          <div className="flex gap-2 justify-center mt-3">
            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">{data.level}</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 capitalize">{data.content_type.replace(/_/g, " ")}</span>
          </div>
        </div>

        {/* Passage with toggle */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 mb-6">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Passage</p>
            <button
              onClick={() => setShowEnglish(!showEnglish)}
              className={`text-xs px-3 py-1 rounded-lg font-medium border ${
                showEnglish ? "bg-blue-600 text-white border-blue-600" : "text-slate-600 border-slate-200 hover:border-blue-400"
              }`}
            >
              {showEnglish ? "Hide English" : "Show English"}
            </button>
          </div>
          <p className="text-slate-800 leading-relaxed whitespace-pre-line">{data.passage_nl}</p>
          {showEnglish && (
            <p className="text-slate-500 text-sm mt-3 leading-relaxed whitespace-pre-line border-t border-slate-100 pt-3">
              {data.passage_en}
            </p>
          )}
        </div>

        {/* Question results */}
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
                    return (
                      <div key={key} className={cls}>
                        {key}. {val} {isCorrect && "\u2713"} {isUser && !r.correct && "\u2717"}
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

        {!explanation && (
          <button
            onClick={handleExplain}
            disabled={explainLoading}
            className="w-full bg-white border border-slate-200 text-slate-700 py-2 rounded-xl text-sm font-medium hover:bg-slate-50 mb-3 disabled:opacity-50"
          >
            {explainLoading ? "Generating explanation..." : "Get AI Explanation"}
          </button>
        )}
        {explanation && (
          <div className="bg-white rounded-2xl border border-slate-200 p-4 mb-6">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">AI Explanation</p>
            <p className="text-sm text-slate-700 whitespace-pre-line">{explanation}</p>
          </div>
        )}

        <button
          onClick={() => { setPhase("idle"); setData(null); setResult(null); setExplanation(null); setTopic(""); }}
          className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 rounded-xl font-semibold hover:from-blue-700 hover:to-indigo-700 shadow-md"
        >
          New Exercise
        </button>
      </div>
    );
  }

  return null;
}
