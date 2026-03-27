import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  generateWritingPrompt,
  submitWriting,
  submitErrorCorrection,
  getWritingSubtopicScores,
  WritingPrompt,
  WritingFeedback,
  WritingGrammarError,
  ErrorCorrectionFeedback,
  ErrorCorrectionResult,
  SpellPrompt,
  SubtopicScore,
  WritingSubtopic,
} from "../api";
import SpellPractice from "./SpellPractice";
import { WRITING_SUBTOPICS_LOCAL } from "../data/writingSubtopics";

type Phase = "home" | "loading" | "writing" | "submitting" | "review";
type TaskType = "email" | "kort_verhaal" | "formulier" | "briefje" | "error_correction";
type WritingMode = "menu" | "scene" | "error_correction" | "spell";

const TASK_CARDS: { type: TaskType; title: string; icon: string; desc: string; example: string }[] = [
  {
    type: "email",
    title: "Email schrijven",
    icon: "📧",
    desc: "Write a formal or informal email based on a situation and bullet points.",
    example: "e.g. Reschedule an appointment, ask for information",
  },
  {
    type: "kort_verhaal",
    title: "Kort verhaal",
    icon: "📝",
    desc: "Write a short text (≥3 sentences) about a topic with guiding questions.",
    example: "e.g. Your weekend, your hobby, your neighbourhood",
  },
  {
    type: "formulier",
    title: "Formulier invullen",
    icon: "📋",
    desc: "Fill in a structured form with text fields and free-text answers.",
    example: "e.g. Sports club registration, library card application",
  },
  {
    type: "briefje",
    title: "Briefje schrijven",
    icon: "📝",
    desc: "Write a short note to a colleague, neighbour, or family member.",
    example: "e.g. Note about tasks, errands, or packages",
  },
];

const CATEGORY_LABELS: Record<string, string> = {
  de_het: "de/het",
  verb_conjugation: "verb conj.",
  word_order: "word order",
  spelling: "spelling",
  plural: "plural",
  adjective_inflection: "adj. inflection",
  preposition: "preposition",
  article: "article",
  pronoun: "pronoun",
  other: "other",
};

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

// Per-sentence answer for error correction
interface SentenceAnswer {
  markedError: boolean;
  correction: string;
}

export default function Writing() {
  const location = useLocation();
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>("home");
  const [writingMode, setWritingMode] = useState<WritingMode>("menu");
  const [topics, setTopics] = useState<Record<TaskType, string>>({ email: "", kort_verhaal: "", formulier: "", briefje: "", error_correction: "" });
  const [prompt, setPrompt] = useState<WritingPrompt | null>(null);
  const [showEn, setShowEn] = useState(false);
  const [userText, setUserText] = useState("");
  const [formAnswers, setFormAnswers] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<WritingFeedback | null>(null);
  const [ecFeedback, setEcFeedback] = useState<ErrorCorrectionFeedback | null>(null);
  const [scorePct, setScorePct] = useState(0);
  const [error, setError] = useState("");
  const [currentTask, setCurrentTask] = useState<TaskType>("email");
  const startTimeRef = useRef(0);

  // Error correction: one answer per sentence
  const [sentenceAnswers, setSentenceAnswers] = useState<SentenceAnswer[]>([]);

  // Subtopics
  const [subtopicScores, setSubtopicScores] = useState<Record<string, SubtopicScore>>({});
  const [expandedTask, setExpandedTask] = useState<TaskType | null>(null);
  const [activeSubtopic, setActiveSubtopic] = useState<string | null>(null);

  // Replay: prompt injected from StudyMaterial "Practice Again"
  const [spellReplay, setSpellReplay] = useState<SpellPrompt | null>(null);
  const replayConsumed = useRef(false);

  // Fetch subtopic scores on mount
  useEffect(() => {
    getWritingSubtopicScores()
      .then((scores) => {
        const map: Record<string, SubtopicScore> = {};
        for (const s of scores) {
          map[`${s.task_type}:${s.subtopic}`] = s;
        }
        setSubtopicScores(map);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const st = location.state as { replay?: WritingPrompt; replaySpell?: SpellPrompt } | null;
    if (!st || replayConsumed.current) return;
    replayConsumed.current = true;
    // Clear navigation state so refresh doesn't re-trigger
    navigate(location.pathname, { replace: true });

    if (st.replaySpell) {
      // Spell practice replay
      setSpellReplay(st.replaySpell);
      setWritingMode("spell");
    } else if (st.replay) {
      const p = st.replay;
      if (p.task_type === "error_correction") {
        setCurrentTask("error_correction");
        setPrompt(p);
        setSentenceAnswers((p.sentences ?? []).map(() => ({ markedError: false, correction: "" })));
        setUserText("");
        setFeedback(null);
        setEcFeedback(null);
        startTimeRef.current = Date.now();
        setPhase("writing");
      } else {
        setCurrentTask(p.task_type as TaskType);
        setPrompt(p);
        setUserText("");
        setFormAnswers({});
        setFeedback(null);
        setEcFeedback(null);
        setShowEn(false);
        startTimeRef.current = Date.now();
        setPhase("writing");
      }
    }
  }, [location.state, location.pathname, navigate]);

  const wordCount = userText.trim() ? userText.trim().split(/\s+/).length : 0;
  const sentenceCount = userText.trim() ? userText.trim().split(/[.!?]+/).filter(s => s.trim()).length : 0;

  const formFieldCount = prompt?.fields?.length ?? 0;
  const formFilledCount = prompt?.fields?.filter(f => (formAnswers[f.label_nl] || "").trim()).length ?? 0;

  async function handleStart(taskType: TaskType, subtopicKey?: string) {
    setCurrentTask(taskType);
    setActiveSubtopic(subtopicKey ?? null);
    setPhase("loading");
    setError("");
    setShowEn(false);
    setUserText("");
    setFormAnswers({});
    setFeedback(null);
    setEcFeedback(null);
    setSentenceAnswers([]);
    try {
      const data = await generateWritingPrompt(taskType, topics[taskType] || undefined, subtopicKey);
      setPrompt(data);
      // Init sentence answers for error correction
      if (taskType === "error_correction" && data.sentences) {
        setSentenceAnswers(data.sentences.map(() => ({ markedError: false, correction: "" })));
      }
      startTimeRef.current = Date.now();
      setPhase("writing");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to generate prompt");
      setPhase("home");
    }
  }

  async function handleSubmit() {
    if (!prompt) return;
    setPhase("submitting");
    setError("");

    const duration = Math.round((Date.now() - startTimeRef.current) / 1000);

    try {
      if (currentTask === "error_correction") {
        const answers = sentenceAnswers.map((a, i) => ({
          sentence_index: i,
          marked_error: a.markedError,
          user_correction: a.markedError ? a.correction || null : null,
        }));
        const res = await submitErrorCorrection({ prompt, answers, duration_seconds: duration });
        setEcFeedback(res.feedback);
        setScorePct(res.score_pct);
        setPhase("review");
      } else {
        const responseText = currentTask === "formulier"
          ? JSON.stringify(formAnswers, null, 2)
          : userText;
        const res = await submitWriting({
          task_type: currentTask,
          prompt,
          response_text: responseText,
          duration_seconds: duration,
          subtopic: activeSubtopic ?? prompt.subtopic ?? undefined,
        });
        setFeedback(res.feedback);
        setScorePct(res.score_pct);
        setPhase("review");
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to submit");
      setPhase("writing");
    }
  }

  function handleNewPrompt() {
    setPhase("home");
    setPrompt(null);
    setFeedback(null);
    setEcFeedback(null);
    setUserText("");
    setFormAnswers({});
    setSentenceAnswers([]);
  }

  function handleTryAgain() {
    setUserText("");
    setFormAnswers({});
    setFeedback(null);
    setEcFeedback(null);
    if (prompt?.sentences) {
      setSentenceAnswers(prompt.sentences.map(() => ({ markedError: false, correction: "" })));
    }
    startTimeRef.current = Date.now();
    setPhase("writing");
  }

  function updateSentenceAnswer(index: number, update: Partial<SentenceAnswer>) {
    setSentenceAnswers(prev => prev.map((a, i) => i === index ? { ...a, ...update } : a));
  }

  // ── HOME ──────────────────────────────────────────────────────────────────

  if (phase === "home") {
    return (
      <>
        {/* SpellPractice stays mounted (CSS hide) so loading survives mode switches */}
        <div style={{ display: writingMode === "spell" ? undefined : "none" }}>
          <SpellPractice onBack={() => { setWritingMode("menu"); setSpellReplay(null); }} replayPrompt={spellReplay} />
        </div>

        {/* Scene Practice mode — task cards with subtopic lists */}
        {writingMode === "scene" && (
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="flex items-center gap-3">
              <button onClick={() => setWritingMode("menu")} className="text-sm text-slate-500 hover:text-slate-700">
                &larr; Back
              </button>
              <h1 className="text-2xl font-bold">Scene Practice</h1>
            </div>

            {error && <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm">{error}</div>}

            <div className="space-y-4">
              {TASK_CARDS.map((card) => {
                const isExpanded = expandedTask === card.type;
                const subtopics = WRITING_SUBTOPICS_LOCAL[card.type] || [];
                return (
                  <div key={card.type} className="bg-white rounded-xl border overflow-hidden">
                    {/* Task header — clickable to expand */}
                    <button
                      onClick={() => setExpandedTask(isExpanded ? null : card.type)}
                      className="w-full p-5 text-left hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-3xl">{card.icon}</span>
                          <div>
                            <h3 className="font-semibold text-lg">{card.title}</h3>
                            <p className="text-slate-500 text-sm">{card.desc}</p>
                          </div>
                        </div>
                        <svg className={`w-5 h-5 text-slate-400 transition-transform ${isExpanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </button>

                    {/* Expanded subtopic list */}
                    {isExpanded && (
                      <div className="border-t">
                        {subtopics.map((st) => {
                          const scoreData = subtopicScores[`${card.type}:${st.key}`];
                          const avg = scoreData?.avg_score;
                          const badgeColor = avg == null ? "bg-slate-100 text-slate-400"
                            : avg >= 80 ? "bg-green-100 text-green-700"
                            : avg >= 60 ? "bg-yellow-100 text-yellow-700"
                            : "bg-red-100 text-red-700";
                          return (
                            <button
                              key={st.key}
                              onClick={() => handleStart(card.type, st.key)}
                              className="w-full flex items-center justify-between px-5 py-3 hover:bg-blue-50 transition-colors border-b last:border-b-0 text-left"
                            >
                              <div>
                                <span className="text-sm font-medium">{st.label_nl}</span>
                                <span className="text-xs text-slate-400 ml-2">({st.label_en})</span>
                              </div>
                              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${badgeColor}`}>
                                {avg != null ? `${avg}%` : "--"}
                              </span>
                            </button>
                          );
                        })}

                        {/* Custom topic row */}
                        <div className="flex items-center gap-2 px-5 py-3 border-b-0">
                          <span className="text-sm text-slate-500">Custom:</span>
                          <input
                            type="text"
                            placeholder="Your own topic..."
                            className="flex-1 border rounded-lg px-3 py-1.5 text-sm"
                            value={topics[card.type]}
                            onChange={(e) => setTopics(prev => ({ ...prev, [card.type]: e.target.value }))}
                            onKeyDown={(e) => e.key === "Enter" && handleStart(card.type)}
                          />
                          <button
                            onClick={() => handleStart(card.type)}
                            className="bg-blue-600 text-white px-4 py-1.5 rounded-lg font-medium hover:bg-blue-700 text-sm"
                          >
                            Start
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Error Correction mode */}
        {writingMode === "error_correction" && (
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="flex items-center gap-3">
              <button onClick={() => setWritingMode("menu")} className="text-sm text-slate-500 hover:text-slate-700">
                &larr; Back
              </button>
              <h1 className="text-2xl font-bold">Error Correction</h1>
            </div>

            {error && <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm">{error}</div>}

            <div className="bg-white rounded-xl border p-5 space-y-3">
              <div className="flex items-center gap-3">
                <span className="text-3xl">🔍</span>
                <div>
                  <h3 className="font-semibold text-lg">Fouten verbeteren</h3>
                  <p className="text-slate-500 text-sm">Read Dutch sentences and find the grammar errors. Rewrite the wrong ones.</p>
                </div>
              </div>
              <p className="text-xs text-slate-400">e.g. de/het, verb conjugation, word order, spelling</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Optional topic..."
                  className="flex-1 border rounded-lg px-3 py-2 text-sm"
                  value={topics.error_correction}
                  onChange={(e) => setTopics(prev => ({ ...prev, error_correction: e.target.value }))}
                  onKeyDown={(e) => e.key === "Enter" && handleStart("error_correction")}
                />
                <button
                  onClick={() => handleStart("error_correction")}
                  className="bg-blue-600 text-white px-5 py-2 rounded-lg font-medium hover:bg-blue-700 text-sm"
                >
                  Start
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Menu mode — 3 top-level cards */}
        {writingMode === "menu" && (
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="text-center">
              <h1 className="text-2xl font-bold">Schrijven (Writing)</h1>
              <p className="text-slate-500 mt-1">Practice writing for the DUO A2 exam</p>
            </div>

            {error && <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm">{error}</div>}

            <div className="space-y-4">
              {/* Scene Practice */}
              <button
                onClick={() => setWritingMode("scene")}
                className="w-full bg-white rounded-xl border border-slate-200 p-5 text-left hover:shadow-md hover:border-blue-300 transition-all"
              >
                <div className="flex items-center gap-4">
                  <span className="text-3xl">📝</span>
                  <div>
                    <h3 className="font-semibold text-lg">Scene Practice</h3>
                    <p className="text-slate-500 text-sm">Practice writing emails, short texts, and forms</p>
                  </div>
                </div>
              </button>

              {/* Error Correction */}
              <button
                onClick={() => setWritingMode("error_correction")}
                className="w-full bg-white rounded-xl border border-slate-200 p-5 text-left hover:shadow-md hover:border-orange-300 transition-all"
              >
                <div className="flex items-center gap-4">
                  <span className="text-3xl">🔍</span>
                  <div>
                    <h3 className="font-semibold text-lg">Error Correction</h3>
                    <p className="text-slate-500 text-sm">Find and fix grammar errors in Dutch sentences</p>
                  </div>
                </div>
              </button>

              {/* Translation Practice */}
              <button
                onClick={() => setWritingMode("spell")}
                className="w-full bg-white rounded-xl border border-slate-200 p-5 text-left hover:shadow-md hover:border-purple-300 transition-all"
              >
                <div className="flex items-center gap-4">
                  <span className="text-3xl">✏️</span>
                  <div>
                    <h3 className="font-semibold text-lg">Translation Practice</h3>
                    <p className="text-slate-500 text-sm">Translate English → Dutch, one sentence at a time</p>
                  </div>
                </div>
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  // ── LOADING / SUBMITTING ──────────────────────────────────────────────────

  if (phase === "loading" || phase === "submitting") {
    return (
      <div className="max-w-lg mx-auto text-center py-16">
        <div className="animate-spin text-4xl mb-4">
          {phase === "loading" ? "📝" : "📤"}
        </div>
        <p className="text-slate-500">
          {phase === "loading" ? "Generating exercise..." : "Checking your answers..."}
        </p>
      </div>
    );
  }

  // ── WRITING: Error Correction (sentence by sentence) ──────────────────────

  if (phase === "writing" && prompt && currentTask === "error_correction" && prompt.sentences) {
    const answeredCount = sentenceAnswers.filter(a => a.markedError).length;

    return (
      <div className="max-w-2xl mx-auto space-y-5">
        <div className="flex items-center justify-between">
          <button onClick={handleNewPrompt} className="text-sm text-slate-500 hover:text-slate-700">
            &larr; Back
          </button>
          <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded">
            Fouten verbeteren
          </span>
        </div>

        {/* Instructions */}
        <div className="bg-blue-50 rounded-xl border border-blue-200 p-4 text-sm text-blue-800">
          <strong>Instructions:</strong> Read each sentence. If it has a grammar error, toggle it to
          "Has error" and type the corrected sentence. Some sentences are correct — leave those as "Correct".
        </div>

        {/* Topic */}
        <p className="text-sm text-slate-500 text-center">{prompt.topic_nl || prompt.topic}</p>

        {/* Sentences */}
        <div className="space-y-3">
          {prompt.sentences.map((s, i) => {
            const answer = sentenceAnswers[i];
            if (!answer) return null;
            return (
              <div key={i} className={`bg-white rounded-xl border p-4 space-y-2 ${answer.markedError ? "border-orange-300" : "border-slate-200"}`}>
                {/* Sentence text */}
                <p className="text-sm font-medium">
                  <span className="text-slate-400 mr-2">{i + 1}.</span>
                  {s.text}
                </p>
                {s.text_en && (
                  <p className="text-xs text-slate-400 italic ml-6">{s.text_en}</p>
                )}

                {/* Toggle buttons */}
                <div className="flex gap-2">
                  <button
                    onClick={() => updateSentenceAnswer(i, { markedError: false, correction: "" })}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      !answer.markedError
                        ? "bg-green-100 text-green-700 ring-1 ring-green-300"
                        : "bg-slate-50 text-slate-500 hover:bg-slate-100"
                    }`}
                  >
                    Correct
                  </button>
                  <button
                    onClick={() => updateSentenceAnswer(i, { markedError: true })}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      answer.markedError
                        ? "bg-orange-100 text-orange-700 ring-1 ring-orange-300"
                        : "bg-slate-50 text-slate-500 hover:bg-slate-100"
                    }`}
                  >
                    Has error
                  </button>
                </div>

                {/* Correction input (only if marked as error) */}
                {answer.markedError && (
                  <input
                    type="text"
                    className="w-full border border-orange-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-200 focus:border-orange-400 outline-none"
                    placeholder="Type the corrected sentence..."
                    value={answer.correction}
                    onChange={(e) => updateSentenceAnswer(i, { correction: e.target.value })}
                  />
                )}
              </div>
            );
          })}
        </div>

        {error && <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm">{error}</div>}

        <button
          onClick={handleSubmit}
          className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700"
        >
          Submit ({answeredCount} marked as errors)
        </button>
      </div>
    );
  }

  // ── WRITING: email / kort_verhaal / formulier ─────────────────────────────

  if (phase === "writing" && prompt) {
    const canSubmit = currentTask === "formulier"
      ? formFilledCount >= Math.max(1, Math.ceil(formFieldCount * 0.5))
      : wordCount >= 3;

    return (
      <div className="max-w-2xl mx-auto space-y-5">
        <div className="flex items-center justify-between">
          <button onClick={handleNewPrompt} className="text-sm text-slate-500 hover:text-slate-700">
            &larr; Back
          </button>
          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
            {TASK_CARDS.find(c => c.type === currentTask)?.title}
          </span>
        </div>

        {/* Prompt */}
        <div className="bg-white rounded-xl border p-5 space-y-3">
          {currentTask === "email" && (
            <>
              <h3 className="font-semibold">
                {showEn ? prompt.situation_en : prompt.situation_nl}
              </h3>
              {prompt.recipient && (
                <p className="text-sm text-slate-500">Aan: {prompt.recipient}</p>
              )}
              <ul className="list-disc ml-5 space-y-1 text-sm">
                {prompt.bullet_points?.map((bp, i) => (
                  <li key={i}>{showEn ? bp.en : bp.nl}</li>
                ))}
              </ul>
            </>
          )}

          {currentTask === "kort_verhaal" && (
            <>
              <h3 className="font-semibold">
                {showEn ? prompt.topic_en : prompt.topic_nl}
              </h3>
              <ul className="list-disc ml-5 space-y-1 text-sm">
                {prompt.guiding_questions?.map((q, i) => (
                  <li key={i}>{showEn ? q.en : q.nl}</li>
                ))}
              </ul>
            </>
          )}

          {currentTask === "formulier" && (
            <>
              <h3 className="font-semibold">
                {showEn ? prompt.form_title_en : prompt.form_title_nl}
              </h3>
              <p className="text-sm text-slate-600">
                {showEn ? prompt.situation_en : prompt.situation_nl}
              </p>
            </>
          )}

          <button
            onClick={() => setShowEn(!showEn)}
            className="text-xs text-blue-600 hover:underline"
          >
            {showEn ? "Show Dutch" : "Show English"}
          </button>
        </div>

        {/* Input area */}
        {currentTask === "formulier" ? (
          <div className="bg-white rounded-xl border p-5 space-y-4">
            {prompt.fields?.map((field, i) => (
              <div key={i}>
                <label className="block text-sm font-medium mb-1">
                  {field.label_nl}
                  <span className="text-slate-400 font-normal ml-1">({field.label_en})</span>
                </label>
                {field.field_type === "select" && field.options ? (
                  <select
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                    value={formAnswers[field.label_nl] || ""}
                    onChange={(e) => setFormAnswers(prev => ({ ...prev, [field.label_nl]: e.target.value }))}
                  >
                    <option value="">-- Kies --</option>
                    {field.options.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                ) : field.field_type === "textarea" ? (
                  <textarea
                    className="w-full border rounded-lg px-3 py-2 text-sm min-h-[80px]"
                    placeholder={field.placeholder || ""}
                    value={formAnswers[field.label_nl] || ""}
                    onChange={(e) => setFormAnswers(prev => ({ ...prev, [field.label_nl]: e.target.value }))}
                  />
                ) : (
                  <input
                    type="text"
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                    placeholder={field.placeholder || ""}
                    value={formAnswers[field.label_nl] || ""}
                    onChange={(e) => setFormAnswers(prev => ({ ...prev, [field.label_nl]: e.target.value }))}
                  />
                )}
              </div>
            ))}
            <p className="text-xs text-slate-400">
              {formFilledCount}/{formFieldCount} fields filled
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border p-5 space-y-2">
            <textarea
              className="w-full border rounded-lg px-4 py-3 text-sm min-h-[200px] focus:ring-2 focus:ring-blue-300 focus:border-blue-400 outline-none"
              placeholder={currentTask === "email"
                ? "Beste ...,\n\n\n\nMet vriendelijke groet,\n..."
                : "Schrijf hier je tekst..."}
              value={userText}
              onChange={(e) => setUserText(e.target.value)}
              autoFocus
            />
            <div className="flex gap-4 text-xs text-slate-400">
              <span>{wordCount} words</span>
              <span>{sentenceCount} sentences</span>
            </div>
          </div>
        )}

        {error && <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm">{error}</div>}

        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Submit for Review
        </button>
      </div>
    );
  }

  // ── REVIEW: Error Correction ──────────────────────────────────────────────

  if (phase === "review" && ecFeedback && prompt && currentTask === "error_correction") {
    return (
      <div className="max-w-2xl mx-auto space-y-5">
        {/* Score header */}
        <div className={`rounded-xl border p-6 text-center ${scoreBg(scorePct)}`}>
          <p className={`text-5xl font-bold ${scoreColor(scorePct)}`}>{scorePct}%</p>
          <p className="text-sm text-slate-500 mt-1">
            Found {ecFeedback.found_count}/{ecFeedback.total_errors} errors
            {" | "}{ecFeedback.correct_fixes} correctly fixed
          </p>
        </div>

        {/* Feedback text */}
        <div className="bg-white rounded-xl border p-5">
          <p className="text-sm">{ecFeedback.feedback_en}</p>
        </div>

        {/* Sentence-by-sentence results */}
        <div className="space-y-3">
          {ecFeedback.results.map((r: ErrorCorrectionResult, i: number) => {
            // Determine card state
            let cardBg = "bg-white";
            let statusLabel = "";
            let statusColor = "";

            if (r.has_error) {
              if (r.fix_correct) {
                cardBg = "bg-green-50";
                statusLabel = "Correct fix!";
                statusColor = "bg-green-100 text-green-700";
              } else if (r.found) {
                cardBg = "bg-yellow-50";
                statusLabel = "Found but wrong fix";
                statusColor = "bg-yellow-100 text-yellow-700";
              } else {
                cardBg = "bg-red-50";
                statusLabel = "Missed error";
                statusColor = "bg-red-100 text-red-700";
              }
            } else {
              if (r.user_marked_error) {
                cardBg = "bg-orange-50";
                statusLabel = "False alarm — was correct";
                statusColor = "bg-orange-100 text-orange-700";
              } else {
                cardBg = "bg-green-50";
                statusLabel = "Correctly identified as correct";
                statusColor = "bg-green-100 text-green-700";
              }
            }

            return (
              <div key={i} className={`${cardBg} rounded-xl border p-4 space-y-2`}>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-slate-400 text-xs font-mono">{i + 1}.</span>
                  <span className={`text-xs px-2 py-0.5 rounded font-medium ${statusColor}`}>{statusLabel}</span>
                  {r.has_error && r.category && (
                    <span className="bg-slate-100 text-slate-600 text-xs px-2 py-0.5 rounded">
                      {CATEGORY_LABELS[r.category] || r.category}
                    </span>
                  )}
                </div>

                {/* Original sentence */}
                <p className="text-sm">{r.sentence}</p>
                {/* English translation from prompt */}
                {prompt.sentences?.[i]?.text_en && (
                  <p className="text-xs text-slate-400 italic">{prompt.sentences[i].text_en}</p>
                )}

                {/* Show correction details for errors */}
                {r.has_error && (
                  <div className="text-sm space-y-1">
                    <p>
                      <span className="text-green-700 font-medium">Correct: </span>
                      {r.correct_text}
                    </p>
                    {r.user_correction && !r.fix_correct && (
                      <p className="text-xs text-slate-500">
                        You wrote: <span className="italic">{r.user_correction}</span>
                      </p>
                    )}
                    {r.explanation_en && (
                      <p className="text-xs text-slate-600">{r.explanation_en}</p>
                    )}
                  </div>
                )}

                {/* False alarm explanation */}
                {!r.has_error && r.user_marked_error && r.user_correction && (
                  <p className="text-xs text-slate-500">
                    You changed it to: <span className="italic">{r.user_correction}</span> — but the original was already correct.
                  </p>
                )}
              </div>
            );
          })}
        </div>

        {/* Action buttons */}
        <div className="flex gap-3">
          <button
            onClick={handleTryAgain}
            className="flex-1 border border-blue-600 text-blue-600 py-3 rounded-lg font-medium hover:bg-blue-50"
          >
            Try Again
          </button>
          <button
            onClick={() => handleStart(currentTask)}
            className="flex-1 border border-slate-300 text-slate-700 py-3 rounded-lg font-medium hover:bg-slate-50"
          >
            New Exercise
          </button>
          <button
            onClick={handleNewPrompt}
            className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700"
          >
            Home
          </button>
        </div>
      </div>
    );
  }

  // ── REVIEW: Writing tasks ─────────────────────────────────────────────────

  if (phase === "review" && feedback && prompt) {
    return (
      <div className="max-w-2xl mx-auto space-y-5">
        <div className={`rounded-xl border p-6 text-center ${scoreBg(scorePct)}`}>
          <p className={`text-5xl font-bold ${scoreColor(scorePct)}`}>{scorePct}%</p>
          <p className="text-sm text-slate-500 mt-1">Overall Score</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "Content", score: feedback.content_score ?? 0, max: 5 },
            { label: "Language", score: feedback.language_score ?? 0, max: 5 },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-lg border p-3 text-center">
              <p className={`text-2xl font-bold ${scoreColor(Math.round(s.score / s.max * 100))}`}>{s.score}/{s.max}</p>
              <p className="text-xs text-slate-500">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Content checklist */}
        {feedback.content_checklist && feedback.content_checklist.length > 0 && (
          <div className="bg-white rounded-xl border p-4 space-y-2">
            <p className="text-xs font-medium text-slate-500">Content Checklist</p>
            {feedback.content_checklist.map((item, i) => (
              <div key={i} className="flex items-start gap-2 text-sm">
                <span className={item.addressed ? "text-green-600" : "text-red-500"}>
                  {item.addressed ? "✅" : "❌"}
                </span>
                <div>
                  <span>{item.point_nl}</span>
                  {item.point_en && <span className="text-slate-400 ml-1">({item.point_en})</span>}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="bg-white rounded-xl border p-5 space-y-2">
          <h3 className="font-semibold">Feedback</h3>
          <p className="text-sm">{feedback.feedback_nl}</p>
        </div>

        {feedback.grammar_errors.length > 0 && (
          <div className="bg-white rounded-xl border p-5 space-y-3">
            <h3 className="font-semibold">Grammar Errors ({feedback.grammar_errors.length})</h3>
            <div className="space-y-3">
              {feedback.grammar_errors.map((err: WritingGrammarError, i: number) => (
                <div key={i} className="bg-red-50 rounded-lg p-3 space-y-1">
                  <p className="text-sm">
                    <span className="line-through text-red-600">{err.text}</span>
                  </p>
                  <p className="text-sm">
                    <span className="text-green-700 font-medium">{err.correction}</span>
                  </p>
                  {err.rule_nl && <p className="text-xs text-slate-600">📏 {err.rule_nl}</p>}
                  {err.explanation_zh && <p className="text-xs text-slate-500">💡 {err.explanation_zh}</p>}
                  {!err.rule_nl && err.explanation_en && <p className="text-xs text-slate-600">{err.explanation_en}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl border p-5 space-y-3">
          <h3 className="font-semibold">Your Text vs Improved Version</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-slate-400 mb-1 font-medium">Your text</p>
              <div className="bg-slate-50 rounded-lg p-3 text-sm whitespace-pre-wrap">
                {currentTask === "formulier"
                  ? Object.entries(formAnswers).map(([k, v]) => `${k}: ${v}`).join("\n")
                  : userText}
              </div>
            </div>
            <div>
              <p className="text-xs text-slate-400 mb-1 font-medium">Improved version</p>
              <div className="bg-green-50 rounded-lg p-3 text-sm whitespace-pre-wrap">
                {feedback.improved_answer}
              </div>
            </div>
          </div>
        </div>

        {(prompt.model_answer || prompt.model_answers) && (
          <details className="bg-white rounded-xl border p-5">
            <summary className="font-semibold cursor-pointer">Model Answer</summary>
            <div className="mt-3 bg-blue-50 rounded-lg p-3 text-sm whitespace-pre-wrap">
              {prompt.model_answer || (prompt.model_answers && Object.entries(prompt.model_answers).map(([k, v]) => `${k}: ${v}`).join("\n"))}
            </div>
          </details>
        )}

        <div className="flex gap-3">
          <button
            onClick={handleTryAgain}
            className="flex-1 border border-blue-600 text-blue-600 py-3 rounded-lg font-medium hover:bg-blue-50"
          >
            Try Again
          </button>
          <button
            onClick={() => handleStart(currentTask)}
            className="flex-1 border border-slate-300 text-slate-700 py-3 rounded-lg font-medium hover:bg-slate-50"
          >
            New Prompt
          </button>
          <button
            onClick={handleNewPrompt}
            className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700"
          >
            Home
          </button>
        </div>
      </div>
    );
  }

  return null;
}
