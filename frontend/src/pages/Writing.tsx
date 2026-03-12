import { useCallback, useEffect, useRef, useState } from "react";
import {
  generateWritingPrompt,
  submitWriting,
  submitErrorCorrection,
  getSchrijvenExams,
  getSchrijvenExamDetail,
  WritingPrompt,
  WritingFeedback,
  WritingGrammarError,
  ErrorCorrectionFeedback,
  ErrorCorrectionResult,
  SchrijvenExamSummary,
  SchrijvenExamDetail,
  SchrijvenExamTask,
} from "../api";

type Phase = "home" | "loading" | "writing" | "submitting" | "review" | "mock_list" | "mock_exam" | "mock_review";
type TaskType = "email" | "kort_verhaal" | "formulier" | "error_correction";

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
    type: "error_correction",
    title: "Fouten verbeteren",
    icon: "🔍",
    desc: "Read Dutch sentences and find the grammar errors. Rewrite the wrong ones.",
    example: "e.g. de/het, verb conjugation, word order, spelling",
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
  capitalization: "capitals",
  punctuation: "punctuation",
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
  const [phase, setPhase] = useState<Phase>("home");
  const [topics, setTopics] = useState<Record<TaskType, string>>({ email: "", kort_verhaal: "", formulier: "", error_correction: "" });
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

  // Mock exam state
  const [mockExams, setMockExams] = useState<SchrijvenExamSummary[]>([]);
  const [mockExam, setMockExam] = useState<SchrijvenExamDetail | null>(null);
  const [mockTaskIndex, setMockTaskIndex] = useState(0);
  const [mockResults, setMockResults] = useState<{ task: SchrijvenExamTask; feedback: WritingFeedback | null; score: number }[]>([]);
  const [mockUserTexts, setMockUserTexts] = useState<string[]>([]);
  const [mockFormAnswersArr, setMockFormAnswersArr] = useState<Record<string, string>[]>([]);

  const wordCount = userText.trim() ? userText.trim().split(/\s+/).length : 0;
  const sentenceCount = userText.trim() ? userText.trim().split(/[.!?]+/).filter(s => s.trim()).length : 0;

  const formFieldCount = prompt?.fields?.length ?? 0;
  const formFilledCount = prompt?.fields?.filter(f => (formAnswers[f.label_nl] || "").trim()).length ?? 0;

  // ── Mock exam handlers ────────────────────────────────────────────────────

  const loadMockExams = useCallback(async () => {
    setPhase("loading");
    setError("");
    try {
      const exams = await getSchrijvenExams();
      setMockExams(exams);
      setPhase("mock_list");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load mock exams");
      setPhase("home");
    }
  }, []);

  async function startMockExam(examId: string) {
    setPhase("loading");
    setError("");
    try {
      const exam = await getSchrijvenExamDetail(examId);
      setMockExam(exam);
      setMockTaskIndex(0);
      setMockResults([]);
      setMockUserTexts(exam.tasks.map(() => ""));
      setMockFormAnswersArr(exam.tasks.map(() => ({})));
      setUserText("");
      setFormAnswers({});
      startTimeRef.current = Date.now();
      setPhase("mock_exam");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load exam");
      setPhase("mock_list");
    }
  }

  function mockCurrentTask(): SchrijvenExamTask | null {
    return mockExam?.tasks[mockTaskIndex] ?? null;
  }

  async function submitMockTask() {
    const task = mockCurrentTask();
    if (!task || !mockExam) return;

    const duration = Math.round((Date.now() - startTimeRef.current) / 1000);
    setPhase("submitting");
    setError("");

    // Build the prompt object from the mock task to match WritingPrompt shape
    const promptObj: WritingPrompt = {
      task_type: task.task_type,
      topic: task.title,
      situation_nl: task.situation_nl,
      situation_en: task.situation_en,
      recipient: task.recipient,
      bullet_points: task.bullet_points,
      topic_nl: task.situation_nl,
      topic_en: task.situation_en,
      guiding_questions: task.guiding_questions,
      form_title_nl: task.form_title_nl,
      form_title_en: task.form_title_en,
      fields: task.fields,
      model_answer: task.model_answer,
      model_answers: task.model_answers,
    };

    const responseText = task.task_type === "formulier"
      ? JSON.stringify(formAnswers, null, 2)
      : userText;

    try {
      const res = await submitWriting({
        task_type: task.task_type,
        prompt: promptObj,
        response_text: responseText,
        duration_seconds: duration,
      });

      // Save result and user text
      setMockResults(prev => [...prev, { task, feedback: res.feedback, score: res.score_pct }]);
      setMockUserTexts(prev => { const a = [...prev]; a[mockTaskIndex] = responseText; return a; });
      setMockFormAnswersArr(prev => { const a = [...prev]; a[mockTaskIndex] = { ...formAnswers }; return a; });

      // Move to next task or finish
      if (mockTaskIndex < mockExam.tasks.length - 1) {
        setMockTaskIndex(prev => prev + 1);
        setUserText("");
        setFormAnswers({});
        startTimeRef.current = Date.now();
        setPhase("mock_exam");
      } else {
        setPhase("mock_review");
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to submit");
      setPhase("mock_exam");
    }
  }

  async function handleStart(taskType: TaskType) {
    setCurrentTask(taskType);
    setPhase("loading");
    setError("");
    setShowEn(false);
    setUserText("");
    setFormAnswers({});
    setFeedback(null);
    setEcFeedback(null);
    setSentenceAnswers([]);
    try {
      const data = await generateWritingPrompt(taskType, topics[taskType] || undefined);
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
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Schrijven (Writing)</h1>
          <p className="text-slate-500 mt-1">Practice writing for the DUO A2 exam</p>
        </div>

        {error && <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm">{error}</div>}

        {/* Mock Exam Button */}
        <button
          onClick={loadMockExams}
          className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl p-5 text-left hover:from-purple-700 hover:to-indigo-700 transition-colors"
        >
          <div className="flex items-center gap-3">
            <span className="text-3xl">📄</span>
            <div>
              <h3 className="font-semibold text-lg">Oefenexamen (Mock Exam)</h3>
              <p className="text-purple-100 text-sm">Take a full official DUO writing exam — 4 tasks just like the real test</p>
            </div>
          </div>
        </button>

        <div className="space-y-4">
          {TASK_CARDS.map((card) => (
            <div key={card.type} className="bg-white rounded-xl border p-5 space-y-3">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{card.icon}</span>
                <div>
                  <h3 className="font-semibold text-lg">{card.title}</h3>
                  <p className="text-slate-500 text-sm">{card.desc}</p>
                </div>
              </div>
              <p className="text-xs text-slate-400">{card.example}</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Optional topic..."
                  className="flex-1 border rounded-lg px-3 py-2 text-sm"
                  value={topics[card.type]}
                  onChange={(e) => setTopics(prev => ({ ...prev, [card.type]: e.target.value }))}
                  onKeyDown={(e) => e.key === "Enter" && handleStart(card.type)}
                />
                <button
                  onClick={() => handleStart(card.type)}
                  className="bg-blue-600 text-white px-5 py-2 rounded-lg font-medium hover:bg-blue-700 text-sm"
                >
                  Start
                </button>
              </div>
            </div>
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

        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Grammar", score: feedback.grammar_score },
            { label: "Vocabulary", score: feedback.vocabulary_score },
            { label: "Completeness", score: feedback.completeness_score },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-lg border p-3 text-center">
              <p className={`text-2xl font-bold ${scoreColor(s.score)}`}>{s.score}</p>
              <p className="text-xs text-slate-500">{s.label}</p>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-xl border p-5 space-y-2">
          <h3 className="font-semibold">Feedback</h3>
          <p className="text-sm">{feedback.feedback_en}</p>
          {feedback.feedback_nl && (
            <p className="text-sm text-slate-500 italic">{feedback.feedback_nl}</p>
          )}
        </div>

        {feedback.grammar_errors.length > 0 && (
          <div className="bg-white rounded-xl border p-5 space-y-3">
            <h3 className="font-semibold">Grammar Errors ({feedback.grammar_errors.length})</h3>
            <div className="space-y-3">
              {feedback.grammar_errors.map((err: WritingGrammarError, i: number) => (
                <div key={i} className="bg-red-50 rounded-lg p-3 space-y-1">
                  <span className="bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded font-medium">
                    {CATEGORY_LABELS[err.category] || err.category}
                  </span>
                  <p className="text-sm">
                    <span className="line-through text-red-600">{err.text}</span>
                  </p>
                  <p className="text-sm">
                    <span className="text-green-700 font-medium">{err.correction}</span>
                  </p>
                  <p className="text-xs text-slate-600">{err.explanation_en}</p>
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

  // ── MOCK EXAM LIST ──────────────────────────────────────────────────────

  if (phase === "mock_list") {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={handleNewPrompt} className="text-sm text-slate-500 hover:text-slate-700">&larr; Back</button>
          <h1 className="text-2xl font-bold">Oefenexamens Schrijven</h1>
        </div>
        <p className="text-slate-500 text-sm">Choose an official DUO practice exam. Each exam has 4 tasks (2 emails, 1 short text, 1 form).</p>
        {error && <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm">{error}</div>}
        <div className="space-y-3">
          {mockExams.map((exam) => (
            <button
              key={exam.id}
              onClick={() => startMockExam(exam.id)}
              className="w-full bg-white rounded-xl border p-5 text-left hover:border-purple-300 hover:bg-purple-50 transition-colors"
            >
              <h3 className="font-semibold text-lg">{exam.title}</h3>
              <div className="flex gap-3 mt-2 text-xs text-slate-500">
                <span>{exam.task_count} opgaven</span>
                {Object.entries(exam.task_types).map(([t, c]) => (
                  <span key={t} className="bg-slate-100 px-2 py-0.5 rounded">
                    {t === "email" ? "Email" : t === "kort_verhaal" ? "Kort verhaal" : "Formulier"} x{c}
                  </span>
                ))}
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ── MOCK EXAM: Writing a task ─────────────────────────────────────────────

  if (phase === "mock_exam" && mockExam) {
    const task = mockCurrentTask();
    if (!task) return null;

    const isFormulier = task.task_type === "formulier";
    const mockFormFieldCount = task.fields?.length ?? 0;
    const mockFormFilledCount = task.fields?.filter(f => (formAnswers[f.label_nl] || "").trim()).length ?? 0;
    const canSubmitMock = isFormulier
      ? mockFormFilledCount >= Math.max(1, Math.ceil(mockFormFieldCount * 0.5))
      : wordCount >= 3;

    return (
      <div className="max-w-2xl mx-auto space-y-5">
        <div className="flex items-center justify-between">
          <button onClick={handleNewPrompt} className="text-sm text-slate-500 hover:text-slate-700">&larr; Stop exam</button>
          <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded font-medium">
            {mockExam.title} — Opgave {mockTaskIndex + 1}/{mockExam.tasks.length}
          </span>
        </div>

        {/* Task progress */}
        <div className="flex gap-1">
          {mockExam.tasks.map((_, i) => (
            <div key={i} className={`flex-1 h-1.5 rounded-full ${
              i < mockTaskIndex ? "bg-green-400" : i === mockTaskIndex ? "bg-purple-500" : "bg-slate-200"
            }`} />
          ))}
        </div>

        {/* Prompt */}
        <div className="bg-white rounded-xl border p-5 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
              {task.task_type === "email" ? "Email" : task.task_type === "kort_verhaal" ? "Kort verhaal" : "Formulier"}
            </span>
            <h3 className="font-semibold">{task.title}</h3>
          </div>

          <p className="text-sm">{showEn ? task.situation_en : task.situation_nl}</p>

          {task.bullet_points && (
            <ul className="list-disc ml-5 space-y-1 text-sm">
              {task.bullet_points.map((bp, i) => (
                <li key={i}>{showEn ? bp.en : bp.nl}</li>
              ))}
            </ul>
          )}

          {task.guiding_questions && (
            <ul className="list-disc ml-5 space-y-1 text-sm">
              {task.guiding_questions.map((q, i) => (
                <li key={i}>{showEn ? q.en : q.nl}</li>
              ))}
            </ul>
          )}

          {isFormulier && task.form_title_nl && (
            <p className="text-sm font-medium">{showEn ? task.form_title_en : task.form_title_nl}</p>
          )}

          <p className="text-xs text-slate-500 italic">
            {showEn ? task.instructions_en : task.instructions_nl}
          </p>

          <button
            onClick={() => setShowEn(!showEn)}
            className="text-xs text-blue-600 hover:underline"
          >
            {showEn ? "Show Dutch" : "Show English"}
          </button>
        </div>

        {/* Input area */}
        {isFormulier ? (
          <div className="bg-white rounded-xl border p-5 space-y-4">
            {task.fields?.map((field, i) => (
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
            <p className="text-xs text-slate-400">{mockFormFilledCount}/{mockFormFieldCount} fields filled</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border p-5 space-y-2">
            {task.greeting && <p className="text-sm text-slate-500 italic">{task.greeting}</p>}
            {task.starter_text && <p className="text-sm text-slate-500 italic">{task.starter_text}</p>}
            <textarea
              className="w-full border rounded-lg px-4 py-3 text-sm min-h-[200px] focus:ring-2 focus:ring-blue-300 focus:border-blue-400 outline-none"
              placeholder={task.task_type === "email"
                ? "Beste ...,\n\n\n\nMet vriendelijke groet,\n..."
                : "Schrijf hier je tekst..."}
              value={userText}
              onChange={(e) => setUserText(e.target.value)}
              autoFocus
            />
            {task.closing && <p className="text-sm text-slate-500 italic">{task.closing}</p>}
            <div className="flex gap-4 text-xs text-slate-400">
              <span>{wordCount} words</span>
              <span>{sentenceCount} sentences</span>
            </div>
          </div>
        )}

        {error && <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm">{error}</div>}

        <button
          onClick={submitMockTask}
          disabled={!canSubmitMock}
          className="w-full bg-purple-600 text-white py-3 rounded-lg font-medium hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {mockTaskIndex < mockExam.tasks.length - 1
            ? `Submit & Next (${mockTaskIndex + 1}/${mockExam.tasks.length})`
            : "Submit & Finish Exam"}
        </button>
      </div>
    );
  }

  // ── MOCK EXAM: Final Review ───────────────────────────────────────────────

  if (phase === "mock_review" && mockExam && mockResults.length > 0) {
    const avgScore = Math.round(mockResults.reduce((s, r) => s + r.score, 0) / mockResults.length);

    return (
      <div className="max-w-2xl mx-auto space-y-5">
        <div className="text-center">
          <h1 className="text-2xl font-bold">{mockExam.title}</h1>
          <p className="text-slate-500 mt-1">Exam Complete</p>
        </div>

        {/* Overall score */}
        <div className={`rounded-xl border p-6 text-center ${scoreBg(avgScore)}`}>
          <p className={`text-5xl font-bold ${scoreColor(avgScore)}`}>{avgScore}%</p>
          <p className="text-sm text-slate-500 mt-1">Average Score</p>
        </div>

        {/* Per-task scores */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {mockResults.map((r, i) => (
            <div key={i} className="bg-white rounded-lg border p-3 text-center">
              <p className="text-xs text-slate-500 mb-1">
                {r.task.task_type === "email" ? "Email" : r.task.task_type === "kort_verhaal" ? "Kort verhaal" : "Formulier"}
              </p>
              <p className={`text-2xl font-bold ${scoreColor(r.score)}`}>{r.score}%</p>
              <p className="text-xs text-slate-400 truncate">{r.task.title}</p>
            </div>
          ))}
        </div>

        {/* Per-task detail */}
        {mockResults.map((r, i) => (
          <details key={i} className="bg-white rounded-xl border">
            <summary className="p-4 cursor-pointer flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                  Opgave {i + 1}
                </span>
                <span className="font-medium">{r.task.title}</span>
              </div>
              <span className={`font-bold ${scoreColor(r.score)}`}>{r.score}%</span>
            </summary>
            <div className="px-4 pb-4 space-y-3 border-t">
              {/* Sub-scores */}
              {r.feedback && (
                <div className="grid grid-cols-3 gap-2 pt-3">
                  {[
                    { label: "Grammar", score: r.feedback.grammar_score },
                    { label: "Vocabulary", score: r.feedback.vocabulary_score },
                    { label: "Completeness", score: r.feedback.completeness_score },
                  ].map((s) => (
                    <div key={s.label} className="text-center">
                      <p className={`text-lg font-bold ${scoreColor(s.score)}`}>{s.score}</p>
                      <p className="text-xs text-slate-500">{s.label}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Feedback */}
              {r.feedback?.feedback_en && (
                <p className="text-sm">{r.feedback.feedback_en}</p>
              )}

              {/* Grammar errors */}
              {r.feedback && r.feedback.grammar_errors.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-slate-500">Grammar Errors ({r.feedback.grammar_errors.length})</p>
                  {r.feedback.grammar_errors.map((err: WritingGrammarError, j: number) => (
                    <div key={j} className="bg-red-50 rounded-lg p-2 text-sm space-y-1">
                      <span className="bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded">
                        {CATEGORY_LABELS[err.category] || err.category}
                      </span>
                      <p><span className="line-through text-red-600">{err.text}</span></p>
                      <p><span className="text-green-700">{err.correction}</span></p>
                      <p className="text-xs text-slate-500">{err.explanation_en}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* User text vs improved */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-slate-400 mb-1 font-medium">Your text</p>
                  <div className="bg-slate-50 rounded-lg p-2 text-sm whitespace-pre-wrap text-slate-700">
                    {mockUserTexts[i] || "—"}
                  </div>
                </div>
                {r.feedback?.improved_answer && (
                  <div>
                    <p className="text-xs text-slate-400 mb-1 font-medium">Improved version</p>
                    <div className="bg-green-50 rounded-lg p-2 text-sm whitespace-pre-wrap">
                      {r.feedback.improved_answer}
                    </div>
                  </div>
                )}
              </div>

              {/* Model answer */}
              {r.task.model_answer && (
                <details className="text-sm">
                  <summary className="cursor-pointer text-blue-600 hover:underline text-xs">Show model answer</summary>
                  <div className="mt-2 bg-blue-50 rounded-lg p-2 whitespace-pre-wrap">{r.task.model_answer}</div>
                </details>
              )}
            </div>
          </details>
        ))}

        {/* Action buttons */}
        <div className="flex gap-3">
          <button
            onClick={() => startMockExam(mockExam.id)}
            className="flex-1 border border-purple-600 text-purple-600 py-3 rounded-lg font-medium hover:bg-purple-50"
          >
            Retry Exam
          </button>
          <button
            onClick={loadMockExams}
            className="flex-1 border border-slate-300 text-slate-700 py-3 rounded-lg font-medium hover:bg-slate-50"
          >
            Other Exams
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
