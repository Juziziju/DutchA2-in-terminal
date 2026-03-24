import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  generateWritingPrompt,
  submitWriting,
  getSchrijvenExams,
  getSchrijvenExamDetail,
  WritingPrompt,
  WritingFeedback,
  WritingGrammarError,
  ContentChecklistItem,
  SchrijvenExamSummary,
  SchrijvenExamDetail,
  SchrijvenExamTask,
  getSprekenExams,
  getSprekenExamDetail,
  generateSprekenPrompt,
  submitSpeakingRecording,
  submitMockexamSpeaking,
  SprekenExamSummary,
  SprekenExamDetail,
  SprekenVraag,
  SprekenOnderdeel,
  SpeakingSubmitResponse,
  MockexamSpeakingFeedback,
} from "../api";
import { useAudioRecorder } from "../hooks/useAudioRecorder";
import { useMockExamState } from "../contexts/MockExamContext";

type Phase =
  | "menu"
  | "schrijven"
  | "schrijven_real_list"
  | "schrijven_real_exam"
  | "schrijven_real_review"
  | "schrijven_ai_pick"
  | "schrijven_ai_loading"
  | "schrijven_ai_writing"
  | "schrijven_ai_submitting"
  | "schrijven_ai_review"
  | "spreken"
  | "spreken_real_list"
  | "spreken_real_exam"
  | "spreken_real_onderdeel_intro"
  | "spreken_real_review"
  | "spreken_ai_pick"
  | "spreken_ai_loading"
  | "spreken_ai_prep"
  | "spreken_ai_recording"
  | "spreken_ai_submitting"
  | "spreken_ai_review";

type SchrijvenMode = "real" | "ai";
type AITaskType = "email" | "kort_verhaal" | "formulier" | "briefje";

const SECTION_CARDS = [
  { code: "LZ", label: "Lezen", icon: "📖", desc: "Leesexamen — reading comprehension" },
  { code: "LU", label: "Luisteren", icon: "🎧", desc: "Luisterexamen — listening comprehension" },
  { code: "SC", label: "Schrijven", icon: "✏️", desc: "Schrijfexamen — writing tasks" },
  { code: "SP", label: "Spreken", icon: "🎤", desc: "Spreekexamen — speaking tasks" },
  { code: "KNM", label: "KNM", icon: "🏛️", desc: "Kennis Nederlandse Maatschappij" },
];

const AI_TASK_CARDS: { type: AITaskType; title: string; icon: string; desc: string; pct: string }[] = [
  { type: "email", title: "Email", icon: "✉️", desc: "Reschedule, request info, complain", pct: "50%" },
  { type: "kort_verhaal", title: "Wijkkrant", icon: "📰", desc: "Write for community newspaper", pct: "25%" },
  { type: "formulier", title: "Formulier", icon: "📋", desc: "Fill in a structured form", pct: "15%" },
  { type: "briefje", title: "Briefje", icon: "📝", desc: "Short note to colleague/family", pct: "10%" },
];

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

function taskTypeLabel(t: string) {
  if (t === "email") return "Email";
  if (t === "kort_verhaal") return "Kort verhaal";
  if (t === "formulier") return "Formulier";
  if (t === "briefje") return "Briefje";
  return t;
}

export default function MockExam() {
  const nav = useNavigate();
  const { setActive } = useMockExamState();

  const [phase, setPhase] = useState<Phase>("menu");
  const [error, setError] = useState("");

  // Schrijven sub-menu
  const [schrijvenMode, setSchrijvenMode] = useState<SchrijvenMode>("ai");

  // Real exam state
  const [realExams, setRealExams] = useState<SchrijvenExamSummary[]>([]);
  const [realExam, setRealExam] = useState<SchrijvenExamDetail | null>(null);
  const [realTaskIndex, setRealTaskIndex] = useState(0);
  const [realResults, setRealResults] = useState<{ task: SchrijvenExamTask; feedback: WritingFeedback | null; score: number }[]>([]);
  const [realUserTexts, setRealUserTexts] = useState<string[]>([]);

  // AI single task state
  const [aiPrompt, setAiPrompt] = useState<WritingPrompt | null>(null);
  const [aiFeedback, setAiFeedback] = useState<WritingFeedback | null>(null);

  // ── Spreken state ──
  const [sprekenMode, setSprekenMode] = useState<"ai" | "real">("ai");
  const [sprekenRealExams, setSprekenRealExams] = useState<SprekenExamSummary[]>([]);
  const [sprekenRealExam, setSprekenRealExam] = useState<SprekenExamDetail | null>(null);
  const [sprekenQuestionIndex, setSprekenQuestionIndex] = useState(0);
  const [sprekenOnderdeelIndex, setSprekenOnderdeelIndex] = useState(0);
  const [sprekenResults, setSprekenResults] = useState<{ vraag: SprekenVraag; transcript: string; feedback: Record<string, unknown>; score: number; model_answer: string }[]>([]);
  const [sprekenAIPrompt, setSprekenAIPrompt] = useState<SprekenVraag | null>(null);
  const [sprekenAIFeedback, setSprekenAIFeedback] = useState<MockexamSpeakingFeedback | null>(null);
  const [sprekenAITranscript, setSprekenAITranscript] = useState("");
  const [prepCountdown, setPrepCountdown] = useState(0);
  const [recordCountdown, setRecordCountdown] = useState(0);
  const [recordingPhase, setRecordingPhase] = useState<"prep" | "ready" | "recording" | "done">("prep");
  const [sprekenShowEn, setSprekenShowEn] = useState(false);
  const prepTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recorder = useAudioRecorder();

  // Shared writing state
  const [userText, setUserText] = useState("");
  const [formAnswers, setFormAnswers] = useState<Record<string, string>>({});
  const [showEn, setShowEn] = useState(false);
  const startTimeRef = useRef(0);

  const wordCount = userText.trim() ? userText.trim().split(/\s+/).length : 0;

  // Guard: mark active when not on menu
  useEffect(() => {
    setActive(phase !== "menu");
  }, [phase, setActive]);

  function goMenu() {
    setPhase("menu");
    setError("");
  }

  // ── Real exam handlers ──

  const loadRealExams = useCallback(async () => {
    setError("");
    try {
      const exams = await getSchrijvenExams();
      setRealExams(exams);
      setPhase("schrijven_real_list");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load exams");
    }
  }, []);

  async function startRealExam(examId: string) {
    setError("");
    try {
      const exam = await getSchrijvenExamDetail(examId);
      setRealExam(exam);
      setRealTaskIndex(0);
      setRealResults([]);
      setRealUserTexts(exam.tasks.map(() => ""));
      setUserText("");
      setFormAnswers({});
      startTimeRef.current = Date.now();
      setPhase("schrijven_real_exam");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load exam");
    }
  }

  function realCurrentTask(): SchrijvenExamTask | null {
    return realExam?.tasks[realTaskIndex] ?? null;
  }

  async function submitRealTask() {
    const task = realCurrentTask();
    if (!task || !realExam) return;

    const duration = Math.round((Date.now() - startTimeRef.current) / 1000);
    setError("");

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

    // Show submitting state by disabling button (reuse phase)
    try {
      const res = await submitWriting({
        task_type: task.task_type,
        prompt: promptObj,
        response_text: responseText,
        duration_seconds: duration,
      });

      setRealResults(prev => [...prev, { task, feedback: res.feedback, score: res.score_pct }]);
      setRealUserTexts(prev => { const a = [...prev]; a[realTaskIndex] = responseText; return a; });

      if (realTaskIndex < realExam.tasks.length - 1) {
        setRealTaskIndex(prev => prev + 1);
        setUserText("");
        setFormAnswers({});
        startTimeRef.current = Date.now();
        setPhase("schrijven_real_exam");
      } else {
        setPhase("schrijven_real_review");
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to submit");
    }
  }

  // ── AI task handlers ──

  async function startAITask(taskType: AITaskType) {
    setPhase("schrijven_ai_loading");
    setError("");
    setUserText("");
    setFormAnswers({});
    setAiFeedback(null);
    setShowEn(false);
    try {
      const data = await generateWritingPrompt(taskType);
      setAiPrompt(data);
      startTimeRef.current = Date.now();
      setPhase("schrijven_ai_writing");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to generate prompt");
      setPhase("schrijven_ai_pick");
    }
  }

  async function submitAITask() {
    if (!aiPrompt) return;
    setPhase("schrijven_ai_submitting");
    setError("");

    const duration = Math.round((Date.now() - startTimeRef.current) / 1000);
    const responseText = aiPrompt.task_type === "formulier"
      ? JSON.stringify(formAnswers, null, 2)
      : userText;

    try {
      const res = await submitWriting({
        task_type: aiPrompt.task_type,
        prompt: aiPrompt,
        response_text: responseText,
        duration_seconds: duration,
      });
      setAiFeedback(res.feedback);
      setPhase("schrijven_ai_review");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to submit");
      setPhase("schrijven_ai_writing");
    }
  }

  // ── Spreken helpers ──

  function clearTimers() {
    if (prepTimerRef.current) { clearInterval(prepTimerRef.current); prepTimerRef.current = null; }
    if (recordTimerRef.current) { clearInterval(recordTimerRef.current); recordTimerRef.current = null; }
  }

  // Cleanup timers on unmount
  useEffect(() => () => clearTimers(), []);

  function startPrepCountdown(seconds: number, onDone: () => void) {
    clearTimers();
    setPrepCountdown(seconds);
    setRecordingPhase("prep");
    prepTimerRef.current = setInterval(() => {
      setPrepCountdown(prev => {
        if (prev <= 1) {
          if (prepTimerRef.current) clearInterval(prepTimerRef.current);
          prepTimerRef.current = null;
          onDone();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  function startRecordCountdown(seconds: number, onDone: () => void) {
    setRecordCountdown(seconds);
    setRecordingPhase("recording");
    recordTimerRef.current = setInterval(() => {
      setRecordCountdown(prev => {
        if (prev <= 1) {
          if (recordTimerRef.current) clearInterval(recordTimerRef.current);
          recordTimerRef.current = null;
          onDone();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  // ── Spreken Real handlers ──

  const loadSprekenRealExams = useCallback(async () => {
    setError("");
    try {
      const exams = await getSprekenExams();
      setSprekenRealExams(exams);
      setPhase("spreken_real_list");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load spreken exams");
    }
  }, []);

  async function startSprekenRealExam(examId: string) {
    setError("");
    try {
      const exam = await getSprekenExamDetail(examId);
      setSprekenRealExam(exam);
      setSprekenOnderdeelIndex(0);
      setSprekenQuestionIndex(0);
      setSprekenResults([]);
      recorder.reset();
      setRecordingPhase("prep");
      setPhase("spreken_real_onderdeel_intro");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load exam");
    }
  }

  function sprekenRealCurrentVraag(): SprekenVraag | null {
    if (!sprekenRealExam) return null;
    const onderdeel = sprekenRealExam.onderdelen[sprekenOnderdeelIndex];
    if (!onderdeel) return null;
    // questionIndex is relative to current onderdeel
    const localIdx = sprekenQuestionIndex - onderdeel.vragen.reduce((_, __, i) => {
      // count questions in previous onderdelen
      return 0;
    }, 0);
    // Actually, sprekenQuestionIndex is the global question index across all onderdelen
    let globalIdx = 0;
    for (const o of sprekenRealExam.onderdelen) {
      for (const v of o.vragen) {
        if (globalIdx === sprekenQuestionIndex) return v;
        globalIdx++;
      }
    }
    return null;
  }

  function sprekenRealCurrentOnderdeel(): SprekenOnderdeel | null {
    if (!sprekenRealExam) return null;
    let globalIdx = 0;
    for (const o of sprekenRealExam.onderdelen) {
      for (const _ of o.vragen) {
        if (globalIdx === sprekenQuestionIndex) return o;
        globalIdx++;
      }
    }
    return null;
  }

  function sprekenRealTotalQuestions(): number {
    if (!sprekenRealExam) return 0;
    return sprekenRealExam.onderdelen.reduce((s, o) => s + o.vragen.length, 0);
  }

  function startSprekenRealQuestion() {
    const vraag = sprekenRealCurrentVraag();
    if (!vraag) return;
    recorder.reset();
    setRecordingPhase("prep");
    setSprekenShowEn(false);
    setPhase("spreken_real_exam");

    // Acquire mic during prep
    recorder.acquireStream();

    startPrepCountdown(vraag.prep_seconds, () => {
      setRecordingPhase("ready");
    });
  }

  async function startSprekenRealRecording() {
    const vraag = sprekenRealCurrentVraag();
    if (!vraag) return;
    await recorder.start();
    startRecordCountdown(vraag.record_seconds, () => {
      recorder.stop();
      setRecordingPhase("done");
    });
  }

  function stopSprekenRealRecordingEarly() {
    clearTimers();
    recorder.stop();
    setRecordingPhase("done");
  }

  async function submitSprekenRealRecording() {
    const vraag = sprekenRealCurrentVraag();
    if (!vraag || !recorder.audioBlob || !sprekenRealExam) return;
    setError("");

    try {
      const res = await submitSpeakingRecording(
        recorder.audioBlob,
        sprekenRealExam.id,
        vraag.id,
        vraag.question_type,
        "mockexam",
      );
      setSprekenResults(prev => [...prev, {
        vraag,
        transcript: res.transcript,
        feedback: res.feedback as unknown as Record<string, unknown>,
        score: res.score_pct,
        model_answer: res.model_answer,
      }]);

      // Move to next question or finish
      const total = sprekenRealTotalQuestions();
      if (sprekenQuestionIndex < total - 1) {
        setSprekenQuestionIndex(prev => prev + 1);
        // Check if we moved to a new onderdeel
        const nextOnderdeel = (() => {
          let gi = 0;
          for (let oi = 0; oi < sprekenRealExam.onderdelen.length; oi++) {
            for (let vi = 0; vi < sprekenRealExam.onderdelen[oi].vragen.length; vi++) {
              if (gi === sprekenQuestionIndex + 1) return oi;
              gi++;
            }
          }
          return sprekenOnderdeelIndex;
        })();
        if (nextOnderdeel !== sprekenOnderdeelIndex) {
          setSprekenOnderdeelIndex(nextOnderdeel);
          setPhase("spreken_real_onderdeel_intro");
        } else {
          startSprekenRealQuestion();
        }
      } else {
        setPhase("spreken_real_review");
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to submit recording");
    }
  }

  // ── Spreken AI handlers ──

  async function startSprekenAI(promptType: "afbeelding" | "persoonlijk") {
    setPhase("spreken_ai_loading");
    setError("");
    setSprekenAIFeedback(null);
    setSprekenAITranscript("");
    recorder.reset();
    try {
      const prompt = await generateSprekenPrompt(promptType);
      setSprekenAIPrompt(prompt);
      setSprekenShowEn(false);
      setRecordingPhase("prep");
      setPhase("spreken_ai_prep");
      recorder.acquireStream();
      startPrepCountdown(prompt.prep_seconds, () => {
        setRecordingPhase("ready");
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to generate prompt");
      setPhase("spreken_ai_pick");
    }
  }

  async function startSprekenAIRecording() {
    if (!sprekenAIPrompt) return;
    await recorder.start();
    setPhase("spreken_ai_recording");
    startRecordCountdown(sprekenAIPrompt.record_seconds, () => {
      recorder.stop();
      setRecordingPhase("done");
    });
  }

  function stopSprekenAIRecordingEarly() {
    clearTimers();
    recorder.stop();
    setRecordingPhase("done");
  }

  async function submitSprekenAIRecording() {
    if (!sprekenAIPrompt || !recorder.audioBlob) return;
    setPhase("spreken_ai_submitting");
    setError("");
    try {
      const res = await submitMockexamSpeaking(
        recorder.audioBlob,
        "mockexam_ai",
        sprekenAIPrompt.id,
        sprekenAIPrompt.question_type,
        "mockexam_ai",
        sprekenAIPrompt.vraag_nl,
        sprekenAIPrompt.vraag_en,
        sprekenAIPrompt.expected_phrases,
        sprekenAIPrompt.model_answer,
      );
      setSprekenAITranscript(res.transcript);
      setSprekenAIFeedback(res.feedback as unknown as MockexamSpeakingFeedback);
      setPhase("spreken_ai_review");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to submit recording");
      setPhase("spreken_ai_prep");
    }
  }

  // ── RENDER: Menu ──

  if (phase === "menu") {
    return (
      <div className="max-w-lg mx-auto space-y-6">
        <h2 className="text-xl font-bold">Mock Exam — Inburgeringsexamen A2</h2>
        <p className="text-sm text-slate-500">Choose a section to practice</p>

        <div className="grid grid-cols-1 gap-3">
          {SECTION_CARDS.map((sec) => {
            const comingSoon = sec.code !== "SC" && sec.code !== "SP";
            return (
              <button
                key={sec.code}
                onClick={() => {
                  if (sec.code === "SC") setPhase("schrijven");
                  if (sec.code === "SP") setPhase("spreken");
                }}
                disabled={comingSoon}
                className={`w-full flex items-center gap-4 bg-white border rounded-2xl px-5 py-4 text-left transition-all ${
                  comingSoon
                    ? "opacity-50 cursor-not-allowed border-slate-200"
                    : "border-slate-200 hover:border-blue-300 hover:shadow-md cursor-pointer"
                }`}
              >
                <span className="text-3xl">{sec.icon}</span>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-lg">{sec.label}</span>
                    {comingSoon && (
                      <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded">Coming soon</span>
                    )}
                  </div>
                  <p className="text-sm text-slate-500">{sec.desc}</p>
                </div>
                {!comingSoon && <span className="text-slate-400">→</span>}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // ── RENDER: Schrijven sub-menu ──

  if (phase === "schrijven") {
    return (
      <div className="max-w-lg mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={goMenu} className="text-sm text-slate-500 hover:text-slate-700">&larr; Back</button>
          <h2 className="text-xl font-bold">✏️ Schrijven</h2>
        </div>

        {/* Toggle */}
        <div className="flex bg-slate-100 rounded-xl p-1">
          <button
            onClick={() => setSchrijvenMode("ai")}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
              schrijvenMode === "ai" ? "bg-white shadow text-blue-700" : "text-slate-500"
            }`}
          >
            AI Generated
          </button>
          <button
            onClick={() => setSchrijvenMode("real")}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
              schrijvenMode === "real" ? "bg-white shadow text-purple-700" : "text-slate-500"
            }`}
          >
            Real Exams
          </button>
        </div>

        {error && <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm">{error}</div>}

        {schrijvenMode === "ai" ? (
          <div className="space-y-3">
            <p className="text-sm text-slate-500">Choose a task type. AI will generate a unique prompt for you.</p>
            {AI_TASK_CARDS.map((card) => (
              <button
                key={card.type}
                onClick={() => startAITask(card.type)}
                className="w-full flex items-center gap-4 bg-white border border-slate-200 rounded-2xl px-5 py-4 text-left hover:border-blue-300 hover:shadow-md transition-all"
              >
                <span className="text-2xl">{card.icon}</span>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{card.title}</span>
                    <span className="text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">{card.pct}</span>
                  </div>
                  <p className="text-sm text-slate-500">{card.desc}</p>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-slate-500">Take a full official DUO writing exam — 4 tasks just like the real test.</p>
            <button
              onClick={loadRealExams}
              className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl p-4 text-left hover:from-purple-700 hover:to-indigo-700 transition-colors font-medium"
            >
              Load Official Exams
            </button>
          </div>
        )}
      </div>
    );
  }

  // ── RENDER: Real exam list ──

  if (phase === "schrijven_real_list") {
    return (
      <div className="max-w-lg mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={() => setPhase("schrijven")} className="text-sm text-slate-500 hover:text-slate-700">&larr; Back</button>
          <h2 className="text-xl font-bold">Oefenexamens Schrijven</h2>
        </div>
        <p className="text-slate-500 text-sm">Each exam has 4 tasks. AI grades each one individually.</p>
        {error && <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm">{error}</div>}
        <div className="space-y-3">
          {realExams.map((exam) => (
            <button
              key={exam.id}
              onClick={() => startRealExam(exam.id)}
              className="w-full bg-white rounded-xl border p-5 text-left hover:border-purple-300 hover:bg-purple-50 transition-colors"
            >
              <h3 className="font-semibold text-lg">{exam.title}</h3>
              <div className="flex gap-3 mt-2 text-xs text-slate-500">
                <span>{exam.task_count} opgaven</span>
                {Object.entries(exam.task_types).map(([t, c]) => (
                  <span key={t} className="bg-slate-100 px-2 py-0.5 rounded">
                    {taskTypeLabel(t)} x{c}
                  </span>
                ))}
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ── RENDER: Real exam — writing a task ──

  if (phase === "schrijven_real_exam" && realExam) {
    const task = realCurrentTask();
    if (!task) return null;
    return (
      <div className="max-w-2xl mx-auto space-y-5">
        <div className="flex items-center justify-between">
          <button onClick={goMenu} className="text-sm text-slate-500 hover:text-slate-700">&larr; Stop exam</button>
          <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded font-medium">
            {realExam.title} — Opgave {realTaskIndex + 1}/{realExam.tasks.length}
          </span>
        </div>

        {/* Progress */}
        <div className="flex gap-1">
          {realExam.tasks.map((_, i) => (
            <div key={i} className={`flex-1 h-1.5 rounded-full ${
              i < realTaskIndex ? "bg-green-400" : i === realTaskIndex ? "bg-purple-500" : "bg-slate-200"
            }`} />
          ))}
        </div>

        <TaskPromptCard task={task} showEn={showEn} onToggleLang={() => setShowEn(!showEn)} />

        <TaskInputArea
          task={task}
          userText={userText}
          onUserText={setUserText}
          formAnswers={formAnswers}
          onFormAnswers={setFormAnswers}
          wordCount={wordCount}
        />

        {error && <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm">{error}</div>}

        <SubmitButton
          label={
            realTaskIndex < realExam.tasks.length - 1
              ? `Submit & Next (${realTaskIndex + 1}/${realExam.tasks.length})`
              : "Submit & Finish Exam"
          }
          disabled={!canSubmit(task, userText, formAnswers)}
          onClick={submitRealTask}
        />
      </div>
    );
  }

  // ── RENDER: Real exam review ──

  if (phase === "schrijven_real_review" && realExam && realResults.length > 0) {
    const avgScore = Math.round(realResults.reduce((s, r) => s + r.score, 0) / realResults.length);
    const totalOf6 = realResults.reduce((s, r) => {
      const cs = r.feedback?.content_score ?? 0;
      const ls = r.feedback?.language_score ?? 0;
      return s + cs + ls;
    }, 0);
    const maxOf6 = realResults.length * 6;

    return (
      <div className="max-w-2xl mx-auto space-y-5">
        <div className="text-center">
          <h1 className="text-2xl font-bold">{realExam.title}</h1>
          <p className="text-slate-500 mt-1">Exam Complete</p>
        </div>

        <div className={`rounded-xl border p-6 text-center ${scoreBg(avgScore)}`}>
          <p className={`text-5xl font-bold ${scoreColor(avgScore)}`}>{totalOf6}/{maxOf6}</p>
          <p className="text-sm text-slate-500 mt-1">Total Score ({avgScore}%)</p>
        </div>

        {/* Per-task scores */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {realResults.map((r, i) => {
            const cs = r.feedback?.content_score ?? 0;
            const ls = r.feedback?.language_score ?? 0;
            return (
              <div key={i} className="bg-white rounded-lg border p-3 text-center">
                <p className="text-xs text-slate-500 mb-1">{taskTypeLabel(r.task.task_type)}</p>
                <p className={`text-2xl font-bold ${scoreColor(r.score)}`}>{cs + ls}/6</p>
                <p className="text-xs text-slate-400 truncate">{r.task.title}</p>
              </div>
            );
          })}
        </div>

        {/* Per-task detail */}
        {realResults.map((r, i) => (
          <TaskReviewDetail key={i} index={i} result={r} userText={realUserTexts[i]} />
        ))}

        <div className="flex gap-3">
          <button
            onClick={() => startRealExam(realExam.id)}
            className="flex-1 border border-purple-600 text-purple-600 py-3 rounded-lg font-medium hover:bg-purple-50"
          >
            Retry
          </button>
          <button
            onClick={() => setPhase("schrijven")}
            className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700"
          >
            Back to Schrijven
          </button>
        </div>
      </div>
    );
  }

  // ── RENDER: AI loading ──

  if (phase === "schrijven_ai_loading") {
    return (
      <div className="max-w-lg mx-auto text-center py-16">
        <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4" />
        <p className="text-slate-500">Generating your writing prompt...</p>
      </div>
    );
  }

  // ── RENDER: AI pick task type ──

  if (phase === "schrijven_ai_pick") {
    // Re-show the task type picker (after error etc.)
    setPhase("schrijven");
    return null;
  }

  // ── RENDER: AI writing ──

  if ((phase === "schrijven_ai_writing" || phase === "schrijven_ai_submitting") && aiPrompt) {
    const isFormulier = aiPrompt.task_type === "formulier";
    const submitting = phase === "schrijven_ai_submitting";

    // Build a pseudo-task from the AI prompt for reuse of TaskPromptCard
    const pseudoTask: SchrijvenExamTask = {
      id: "ai",
      task_type: aiPrompt.task_type as SchrijvenExamTask["task_type"],
      title: aiPrompt.topic || aiPrompt.topic_nl || "",
      situation_nl: aiPrompt.situation_nl,
      situation_en: aiPrompt.situation_en,
      recipient: aiPrompt.recipient,
      bullet_points: aiPrompt.bullet_points,
      guiding_questions: aiPrompt.guiding_questions,
      form_title_nl: aiPrompt.form_title_nl,
      form_title_en: aiPrompt.form_title_en,
      fields: aiPrompt.fields,
      instructions_nl: aiPrompt.task_type === "briefje"
        ? "Schrijf een kort briefje. Gebruik de punten hieronder."
        : aiPrompt.task_type === "email"
          ? "Schrijf een email. Gebruik de punten hieronder."
          : aiPrompt.task_type === "formulier"
            ? "Vul het formulier in."
            : "Schrijf een kort tekst.",
      instructions_en: "",
      model_answer: aiPrompt.model_answer,
      model_answers: aiPrompt.model_answers,
      // briefje fields
      greeting: aiPrompt.greeting,
      closing: aiPrompt.closing,
    };

    return (
      <div className="max-w-2xl mx-auto space-y-5">
        <div className="flex items-center justify-between">
          <button onClick={() => setPhase("schrijven")} className="text-sm text-slate-500 hover:text-slate-700">&larr; Back</button>
          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded font-medium">
            AI — {taskTypeLabel(aiPrompt.task_type)}
          </span>
        </div>

        <TaskPromptCard task={pseudoTask} showEn={showEn} onToggleLang={() => setShowEn(!showEn)} />

        <TaskInputArea
          task={pseudoTask}
          userText={userText}
          onUserText={setUserText}
          formAnswers={formAnswers}
          onFormAnswers={setFormAnswers}
          wordCount={wordCount}
        />

        {error && <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm">{error}</div>}

        <SubmitButton
          label={submitting ? "Grading..." : "Submit"}
          disabled={submitting || !canSubmit(pseudoTask, userText, formAnswers)}
          onClick={submitAITask}
        />
      </div>
    );
  }

  // ── RENDER: Spreken sub-menu ──

  if (phase === "spreken") {
    return (
      <div className="max-w-lg mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={goMenu} className="text-sm text-slate-500 hover:text-slate-700">&larr; Back</button>
          <h2 className="text-xl font-bold">Spreken</h2>
        </div>

        <div className="flex bg-slate-100 rounded-xl p-1">
          <button
            onClick={() => setSprekenMode("ai")}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
              sprekenMode === "ai" ? "bg-white shadow text-blue-700" : "text-slate-500"
            }`}
          >
            AI Generated
          </button>
          <button
            onClick={() => setSprekenMode("real")}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
              sprekenMode === "real" ? "bg-white shadow text-purple-700" : "text-slate-500"
            }`}
          >
            Real Exams
          </button>
        </div>

        {error && <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm">{error}</div>}

        {sprekenMode === "ai" ? (
          <div className="space-y-3">
            <p className="text-sm text-slate-500">Choose a question type. AI will generate a unique prompt.</p>
            <button
              onClick={() => startSprekenAI("afbeelding")}
              className="w-full flex items-center gap-4 bg-white border border-slate-200 rounded-2xl px-5 py-4 text-left hover:border-blue-300 hover:shadow-md transition-all"
            >
              <span className="text-2xl">🖼️</span>
              <div className="flex-1">
                <span className="font-semibold">Afbeelding + Persoonlijke vraag</span>
                <p className="text-sm text-slate-500">Describe a scene + answer a personal question</p>
              </div>
            </button>
            <button
              onClick={() => startSprekenAI("persoonlijk")}
              className="w-full flex items-center gap-4 bg-white border border-slate-200 rounded-2xl px-5 py-4 text-left hover:border-blue-300 hover:shadow-md transition-all"
            >
              <span className="text-2xl">💬</span>
              <div className="flex-1">
                <span className="font-semibold">Persoonlijke vragen</span>
                <p className="text-sm text-slate-500">Daily life questions — hobby, work, routine</p>
              </div>
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-slate-500">Take a full official DUO spreken exam — 4 onderdelen, 16 questions.</p>
            <button
              onClick={loadSprekenRealExams}
              className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl p-4 text-left hover:from-purple-700 hover:to-indigo-700 transition-colors font-medium"
            >
              Load Official Exams
            </button>
          </div>
        )}
      </div>
    );
  }

  // ── RENDER: Spreken real exam list ──

  if (phase === "spreken_real_list") {
    return (
      <div className="max-w-lg mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={() => setPhase("spreken")} className="text-sm text-slate-500 hover:text-slate-700">&larr; Back</button>
          <h2 className="text-xl font-bold">Oefenexamens Spreken</h2>
        </div>
        <p className="text-slate-500 text-sm">Each exam has 4 onderdelen with 16 questions total.</p>
        {error && <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm">{error}</div>}
        <div className="space-y-3">
          {sprekenRealExams.map((exam) => (
            <button
              key={exam.id}
              onClick={() => startSprekenRealExam(exam.id)}
              className="w-full bg-white rounded-xl border p-5 text-left hover:border-purple-300 hover:bg-purple-50 transition-colors"
            >
              <h3 className="font-semibold text-lg">{exam.title}</h3>
              <div className="flex gap-3 mt-2 text-xs text-slate-500">
                <span>{exam.onderdeel_count} onderdelen</span>
                <span>{exam.question_count} vragen</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ── RENDER: Spreken real — onderdeel intro ──

  if (phase === "spreken_real_onderdeel_intro" && sprekenRealExam) {
    const onderdeel = sprekenRealExam.onderdelen[sprekenOnderdeelIndex];
    if (!onderdeel) { setPhase("spreken_real_review"); return null; }
    return (
      <div className="max-w-lg mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <button onClick={goMenu} className="text-sm text-slate-500 hover:text-slate-700">&larr; Stop exam</button>
          <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded font-medium">
            Onderdeel {onderdeel.nummer}/4
          </span>
        </div>

        <div className="bg-white rounded-xl border p-6 text-center space-y-4">
          <h2 className="text-2xl font-bold">{onderdeel.titel}</h2>
          <p className="text-slate-600">{onderdeel.beschrijving}</p>
          <p className="text-slate-400 text-sm">{onderdeel.beschrijving_en}</p>
          <p className="text-sm text-slate-500">{onderdeel.vragen.length} vragen</p>
        </div>

        <button
          onClick={() => startSprekenRealQuestion()}
          className="w-full bg-purple-600 text-white py-3 rounded-lg font-medium hover:bg-purple-700"
        >
          Start Onderdeel {onderdeel.nummer}
        </button>
      </div>
    );
  }

  // ── RENDER: Spreken real — question (prep → record → submit) ──

  if (phase === "spreken_real_exam" && sprekenRealExam) {
    const vraag = sprekenRealCurrentVraag();
    const onderdeel = sprekenRealCurrentOnderdeel();
    const total = sprekenRealTotalQuestions();
    if (!vraag || !onderdeel) return null;

    return (
      <div className="max-w-2xl mx-auto space-y-5">
        <div className="flex items-center justify-between">
          <button onClick={goMenu} className="text-sm text-slate-500 hover:text-slate-700">&larr; Stop exam</button>
          <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded font-medium">
            {onderdeel.titel} — Vraag {sprekenQuestionIndex + 1}/{total}
          </span>
        </div>

        {/* Progress bar */}
        <div className="flex gap-1">
          {Array.from({ length: total }).map((_, i) => (
            <div key={i} className={`flex-1 h-1.5 rounded-full ${
              i < sprekenQuestionIndex ? "bg-green-400" : i === sprekenQuestionIndex ? "bg-purple-500" : "bg-slate-200"
            }`} />
          ))}
        </div>

        {/* Question card */}
        <SprekenQuestionCard vraag={vraag} showEn={sprekenShowEn} onToggleLang={() => setSprekenShowEn(!sprekenShowEn)} />

        {/* Recording area */}
        <SprekenRecordingArea
          recordingPhase={recordingPhase}
          prepCountdown={prepCountdown}
          recordCountdown={recordCountdown}
          isRecording={recorder.isRecording}
          audioBlob={recorder.audioBlob}
          recorderError={recorder.error}
          permissionDenied={recorder.permissionDenied}
          onStartRecording={startSprekenRealRecording}
          onStopRecording={stopSprekenRealRecordingEarly}
          onSubmit={submitSprekenRealRecording}
        />

        {error && <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm">{error}</div>}
      </div>
    );
  }

  // ── RENDER: Spreken real — review ──

  if (phase === "spreken_real_review" && sprekenRealExam && sprekenResults.length > 0) {
    const avgScore = Math.round(sprekenResults.reduce((s, r) => s + r.score, 0) / sprekenResults.length);

    // Group results by onderdeel
    const resultsByOnderdeel: { onderdeel: SprekenOnderdeel; results: typeof sprekenResults }[] = [];
    let gi = 0;
    for (const o of sprekenRealExam.onderdelen) {
      const oResults = sprekenResults.slice(gi, gi + o.vragen.length);
      resultsByOnderdeel.push({ onderdeel: o, results: oResults });
      gi += o.vragen.length;
    }

    return (
      <div className="max-w-2xl mx-auto space-y-5">
        <div className="text-center">
          <h1 className="text-2xl font-bold">{sprekenRealExam.title}</h1>
          <p className="text-slate-500 mt-1">Exam Complete</p>
        </div>

        <div className={`rounded-xl border p-6 text-center ${scoreBg(avgScore)}`}>
          <p className={`text-5xl font-bold ${scoreColor(avgScore)}`}>{avgScore}%</p>
          <p className="text-sm text-slate-500 mt-1">Average Score</p>
        </div>

        {/* Per onderdeel scores */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {resultsByOnderdeel.map(({ onderdeel, results: oRes }) => {
            const oAvg = oRes.length > 0 ? Math.round(oRes.reduce((s, r) => s + r.score, 0) / oRes.length) : 0;
            const contentAvg = oRes.length > 0 ? (oRes.reduce((s, r) => s + ((r.feedback as Record<string, number>).content_score ?? 0), 0) / oRes.length).toFixed(1) : "0";
            const grammarAvg = oRes.length > 0 ? (oRes.reduce((s, r) => s + ((r.feedback as Record<string, number>).grammar_score ?? 0), 0) / oRes.length).toFixed(1) : "0";
            return (
              <div key={onderdeel.nummer} className="bg-white rounded-lg border p-3 text-center">
                <p className="text-xs text-slate-500 mb-1">Onderdeel {onderdeel.nummer}</p>
                <p className={`text-2xl font-bold ${scoreColor(oAvg)}`}>{contentAvg}/{grammarAvg}</p>
                <p className="text-xs text-slate-400 truncate">{onderdeel.titel}</p>
                <p className="text-xs text-slate-400">Content / Grammar</p>
              </div>
            );
          })}
        </div>

        {/* Per-question detail */}
        {sprekenResults.map((r, i) => (
          <SprekenResultDetail key={i} index={i} result={r} />
        ))}

        <div className="flex gap-3">
          <button
            onClick={() => startSprekenRealExam(sprekenRealExam.id)}
            className="flex-1 border border-purple-600 text-purple-600 py-3 rounded-lg font-medium hover:bg-purple-50"
          >
            Retry
          </button>
          <button
            onClick={() => setPhase("spreken")}
            className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700"
          >
            Back to Spreken
          </button>
        </div>
      </div>
    );
  }

  // ── RENDER: Spreken AI loading ──

  if (phase === "spreken_ai_loading") {
    return (
      <div className="max-w-lg mx-auto text-center py-16">
        <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4" />
        <p className="text-slate-500">Generating your speaking prompt...</p>
      </div>
    );
  }

  // ── RENDER: Spreken AI pick (after error) ──

  if (phase === "spreken_ai_pick") {
    setPhase("spreken");
    return null;
  }

  // ── RENDER: Spreken AI prep + recording ──

  if ((phase === "spreken_ai_prep" || phase === "spreken_ai_recording") && sprekenAIPrompt) {
    return (
      <div className="max-w-2xl mx-auto space-y-5">
        <div className="flex items-center justify-between">
          <button onClick={() => { clearTimers(); recorder.reset(); setPhase("spreken"); }} className="text-sm text-slate-500 hover:text-slate-700">&larr; Back</button>
          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded font-medium">AI Spreken</span>
        </div>

        <SprekenQuestionCard vraag={sprekenAIPrompt} showEn={sprekenShowEn} onToggleLang={() => setSprekenShowEn(!sprekenShowEn)} />

        <SprekenRecordingArea
          recordingPhase={recordingPhase}
          prepCountdown={prepCountdown}
          recordCountdown={recordCountdown}
          isRecording={recorder.isRecording}
          audioBlob={recorder.audioBlob}
          recorderError={recorder.error}
          permissionDenied={recorder.permissionDenied}
          onStartRecording={startSprekenAIRecording}
          onStopRecording={stopSprekenAIRecordingEarly}
          onSubmit={submitSprekenAIRecording}
        />

        {error && <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm">{error}</div>}
      </div>
    );
  }

  // ── RENDER: Spreken AI submitting ──

  if (phase === "spreken_ai_submitting") {
    return (
      <div className="max-w-lg mx-auto text-center py-16">
        <div className="animate-spin w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full mx-auto mb-4" />
        <p className="text-slate-500">Transcribing & grading your response...</p>
      </div>
    );
  }

  // ── RENDER: Spreken AI review ──

  if (phase === "spreken_ai_review" && sprekenAIFeedback && sprekenAIPrompt) {
    const cs = sprekenAIFeedback.content_score ?? 0;
    const gs = sprekenAIFeedback.grammar_score ?? 0;
    const total5 = Math.round((cs + gs) / 2 * 10) / 10;
    const pct = sprekenAIFeedback.score ?? Math.round((cs + gs) / 10 * 100);

    return (
      <div className="max-w-2xl mx-auto space-y-5">
        <div className="text-center">
          <p className="text-slate-500 text-sm">AI Spreken</p>
          <h2 className="text-2xl font-bold mt-1">Your Score</h2>
        </div>

        <div className={`rounded-xl border p-6 text-center ${scoreBg(pct)}`}>
          <p className={`text-5xl font-bold ${scoreColor(pct)}`}>{total5}/5</p>
          <div className="flex justify-center gap-6 mt-3">
            <div>
              <p className="text-2xl font-bold">{cs}/5</p>
              <p className="text-xs text-slate-500">Content</p>
            </div>
            <div>
              <p className="text-2xl font-bold">{gs}/5</p>
              <p className="text-xs text-slate-500">Grammar</p>
            </div>
          </div>
        </div>

        {/* Feedback */}
        {sprekenAIFeedback.feedback_nl && (
          <div className="bg-blue-50 rounded-xl p-4 text-sm">{sprekenAIFeedback.feedback_nl}</div>
        )}

        {/* Transcript */}
        <div className="bg-white rounded-xl border p-4 space-y-2">
          <p className="text-xs font-medium text-slate-500">Your transcript (STT)</p>
          <p className="text-sm whitespace-pre-wrap">{sprekenAITranscript || "(no speech detected)"}</p>
          <p className="text-xs text-slate-400 italic">Als de tekst niet klopt, probeer het opnieuw</p>
        </div>

        {/* Grammar errors */}
        <SprekenGrammarErrors errors={sprekenAIFeedback.grammar_errors} />

        {/* Improved vs model */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {sprekenAIFeedback.improved_answer && (
            <div>
              <p className="text-xs text-slate-400 mb-1 font-medium">Improved version</p>
              <div className="bg-green-50 rounded-lg p-3 text-sm whitespace-pre-wrap">{sprekenAIFeedback.improved_answer}</div>
            </div>
          )}
          <div>
            <p className="text-xs text-slate-400 mb-1 font-medium">Model answer</p>
            <div className="bg-blue-50 rounded-lg p-3 text-sm whitespace-pre-wrap">{sprekenAIPrompt.model_answer}</div>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => startSprekenAI(sprekenAIPrompt.id.startsWith("ai_afb") ? "afbeelding" : "persoonlijk")}
            className="flex-1 border border-blue-600 text-blue-600 py-3 rounded-lg font-medium hover:bg-blue-50"
          >
            Try Again
          </button>
          <button
            onClick={() => setPhase("spreken")}
            className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700"
          >
            Back to Spreken
          </button>
        </div>
      </div>
    );
  }

  // ── RENDER: AI review ──

  if (phase === "schrijven_ai_review" && aiFeedback && aiPrompt) {
    const cs = aiFeedback.content_score ?? 0;
    const ls = aiFeedback.language_score ?? 0;
    const total6 = cs + ls;

    return (
      <div className="max-w-2xl mx-auto space-y-5">
        <div className="text-center">
          <p className="text-slate-500 text-sm">AI — {taskTypeLabel(aiPrompt.task_type)}</p>
          <h2 className="text-2xl font-bold mt-1">Your Score</h2>
        </div>

        <div className={`rounded-xl border p-6 text-center ${scoreBg(aiFeedback.score)}`}>
          <p className={`text-5xl font-bold ${scoreColor(aiFeedback.score)}`}>{total6}/6</p>
          <div className="flex justify-center gap-6 mt-3">
            <div>
              <p className="text-2xl font-bold">{cs}/3</p>
              <p className="text-xs text-slate-500">Content</p>
            </div>
            <div>
              <p className="text-2xl font-bold">{ls}/3</p>
              <p className="text-xs text-slate-500">Language</p>
            </div>
          </div>
        </div>

        {/* Content checklist */}
        <ContentChecklist items={aiFeedback.content_checklist} />

        {/* Feedback */}
        {aiFeedback.feedback_nl && (
          <div className="bg-blue-50 rounded-xl p-4 text-sm">{aiFeedback.feedback_nl}</div>
        )}

        {/* Grammar errors */}
        <GrammarErrorList errors={aiFeedback.grammar_errors} />

        {/* Your text vs improved */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-slate-400 mb-1 font-medium">Your text</p>
            <div className="bg-slate-50 rounded-lg p-3 text-sm whitespace-pre-wrap text-slate-700">{userText || "—"}</div>
          </div>
          {aiFeedback.improved_answer && (
            <div>
              <p className="text-xs text-slate-400 mb-1 font-medium">Improved version</p>
              <div className="bg-green-50 rounded-lg p-3 text-sm whitespace-pre-wrap">{aiFeedback.improved_answer}</div>
            </div>
          )}
        </div>

        {/* Model answer */}
        {aiPrompt.model_answer && (
          <details className="text-sm">
            <summary className="cursor-pointer text-blue-600 hover:underline text-xs">Show model answer</summary>
            <div className="mt-2 bg-blue-50 rounded-lg p-3 whitespace-pre-wrap">{aiPrompt.model_answer}</div>
          </details>
        )}

        <div className="flex gap-3">
          <button
            onClick={() => startAITask(aiPrompt.task_type as AITaskType)}
            className="flex-1 border border-blue-600 text-blue-600 py-3 rounded-lg font-medium hover:bg-blue-50"
          >
            Try Again
          </button>
          <button
            onClick={() => setPhase("schrijven")}
            className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700"
          >
            Back to Schrijven
          </button>
        </div>
      </div>
    );
  }

  return null;
}

// ── Shared Components ──

function canSubmit(task: SchrijvenExamTask, userText: string, formAnswers: Record<string, string>): boolean {
  if (task.task_type === "formulier") {
    const total = task.fields?.length ?? 0;
    const filled = task.fields?.filter(f => (formAnswers[f.label_nl] || "").trim()).length ?? 0;
    return filled >= Math.max(1, Math.ceil(total * 0.5));
  }
  return userText.trim().split(/\s+/).length >= 3;
}

function TaskPromptCard({ task, showEn, onToggleLang }: { task: SchrijvenExamTask; showEn: boolean; onToggleLang: () => void }) {
  return (
    <div className="bg-white rounded-xl border p-5 space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">{taskTypeLabel(task.task_type)}</span>
        <h3 className="font-semibold">{task.title}</h3>
      </div>

      {task.situation_nl && <p className="text-sm">{showEn ? task.situation_en : task.situation_nl}</p>}

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

      {task.task_type === "formulier" && task.form_title_nl && (
        <p className="text-sm font-medium">{showEn ? task.form_title_en : task.form_title_nl}</p>
      )}

      {task.instructions_nl && (
        <p className="text-xs text-slate-500 italic">{showEn ? task.instructions_en : task.instructions_nl}</p>
      )}

      <button onClick={onToggleLang} className="text-xs text-blue-600 hover:underline">
        {showEn ? "Show Dutch" : "Show English"}
      </button>
    </div>
  );
}

function TaskInputArea({
  task,
  userText,
  onUserText,
  formAnswers,
  onFormAnswers,
  wordCount,
}: {
  task: SchrijvenExamTask;
  userText: string;
  onUserText: (v: string) => void;
  formAnswers: Record<string, string>;
  onFormAnswers: (v: Record<string, string>) => void;
  wordCount: number;
}) {
  if (task.task_type === "formulier") {
    const total = task.fields?.length ?? 0;
    const filled = task.fields?.filter(f => (formAnswers[f.label_nl] || "").trim()).length ?? 0;
    return (
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
                onChange={(e) => onFormAnswers({ ...formAnswers, [field.label_nl]: e.target.value })}
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
                onChange={(e) => onFormAnswers({ ...formAnswers, [field.label_nl]: e.target.value })}
              />
            ) : (
              <input
                type="text"
                className="w-full border rounded-lg px-3 py-2 text-sm"
                placeholder={field.placeholder || ""}
                value={formAnswers[field.label_nl] || ""}
                onChange={(e) => onFormAnswers({ ...formAnswers, [field.label_nl]: e.target.value })}
              />
            )}
          </div>
        ))}
        <p className="text-xs text-slate-400">{filled}/{total} fields filled</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border p-5 space-y-2">
      {task.greeting && <p className="text-sm text-slate-500 italic">{task.greeting}</p>}
      {task.starter_text && <p className="text-sm text-slate-500 italic">{task.starter_text}</p>}
      <textarea
        className="w-full border rounded-lg px-4 py-3 text-sm min-h-[200px] focus:ring-2 focus:ring-blue-300 focus:border-blue-400 outline-none"
        placeholder={
          task.task_type === "email" || task.task_type === "briefje"
            ? "Beste ...,\n\n\n\nMet vriendelijke groet,\n..."
            : "Schrijf hier je tekst..."
        }
        value={userText}
        onChange={(e) => onUserText(e.target.value)}
        autoFocus
      />
      {task.closing && <p className="text-sm text-slate-500 italic">{task.closing}</p>}
      <p className="text-xs text-slate-400">{wordCount} words</p>
    </div>
  );
}

function SubmitButton({ label, disabled, onClick }: { label: string; disabled: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full bg-purple-600 text-white py-3 rounded-lg font-medium hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed"
    >
      {label}
    </button>
  );
}

function ContentChecklist({ items }: { items?: ContentChecklistItem[] }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="bg-white rounded-xl border p-4 space-y-2">
      <p className="text-xs font-medium text-slate-500">Content Checklist</p>
      {items.map((item, i) => (
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
  );
}

function GrammarErrorList({ errors }: { errors: WritingGrammarError[] }) {
  if (!errors || errors.length === 0) return null;
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-slate-500">Grammar Errors ({errors.length})</p>
      {errors.map((err, i) => (
        <div key={i} className="bg-red-50 rounded-lg p-3 text-sm space-y-1">
          <p><span className="line-through text-red-600">{err.text}</span></p>
          <p><span className="text-green-700">{err.correction}</span></p>
          {err.rule_nl && <p className="text-xs text-slate-600">📏 {err.rule_nl}</p>}
          {err.explanation_zh && <p className="text-xs text-slate-500">💡 {err.explanation_zh}</p>}
          {!err.rule_nl && err.explanation_en && <p className="text-xs text-slate-500">{err.explanation_en}</p>}
        </div>
      ))}
    </div>
  );
}

function TaskReviewDetail({
  index,
  result,
  userText,
}: {
  index: number;
  result: { task: SchrijvenExamTask; feedback: WritingFeedback | null; score: number };
  userText: string;
}) {
  const r = result;
  const cs = r.feedback?.content_score ?? 0;
  const ls = r.feedback?.language_score ?? 0;

  return (
    <details className="bg-white rounded-xl border">
      <summary className="p-4 cursor-pointer flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">Opgave {index + 1}</span>
          <span className="font-medium">{r.task.title}</span>
        </div>
        <span className={`font-bold ${scoreColor(r.score)}`}>{cs + ls}/6</span>
      </summary>
      <div className="px-4 pb-4 space-y-3 border-t">
        {r.feedback && (
          <div className="grid grid-cols-2 gap-2 pt-3">
            <div className="text-center">
              <p className={`text-lg font-bold ${scoreColor(Math.round(cs / 3 * 100))}`}>{cs}/3</p>
              <p className="text-xs text-slate-500">Content</p>
            </div>
            <div className="text-center">
              <p className={`text-lg font-bold ${scoreColor(Math.round(ls / 3 * 100))}`}>{ls}/3</p>
              <p className="text-xs text-slate-500">Language</p>
            </div>
          </div>
        )}

        <ContentChecklist items={r.feedback?.content_checklist} />

        {r.feedback?.feedback_nl && (
          <p className="text-sm">{r.feedback.feedback_nl}</p>
        )}

        <GrammarErrorList errors={r.feedback?.grammar_errors ?? []} />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-slate-400 mb-1 font-medium">Your text</p>
            <div className="bg-slate-50 rounded-lg p-2 text-sm whitespace-pre-wrap text-slate-700">{userText || "—"}</div>
          </div>
          {r.feedback?.improved_answer && (
            <div>
              <p className="text-xs text-slate-400 mb-1 font-medium">Improved version</p>
              <div className="bg-green-50 rounded-lg p-2 text-sm whitespace-pre-wrap">{r.feedback.improved_answer}</div>
            </div>
          )}
        </div>

        {r.task.model_answer && (
          <details className="text-sm">
            <summary className="cursor-pointer text-blue-600 hover:underline text-xs">Show model answer</summary>
            <div className="mt-2 bg-blue-50 rounded-lg p-2 whitespace-pre-wrap">{r.task.model_answer}</div>
          </details>
        )}
      </div>
    </details>
  );
}

// ── Spreken Components ──

function SprekenQuestionCard({ vraag, showEn, onToggleLang }: { vraag: SprekenVraag; showEn: boolean; onToggleLang: () => void }) {
  return (
    <div className="bg-white rounded-xl border p-5 space-y-3">
      {vraag.image_url && (
        <img src={vraag.image_url} alt="exam" className="w-full h-48 object-cover rounded-lg" />
      )}
      <p className="text-sm text-slate-600">{showEn ? vraag.situatie_en : vraag.situatie_nl}</p>
      <p className="font-semibold">{showEn ? vraag.vraag_en : vraag.vraag_nl}</p>
      {vraag.tips && vraag.tips.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {vraag.tips.map((tip, i) => (
            <span key={i} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded">{tip}</span>
          ))}
        </div>
      )}
      <button onClick={onToggleLang} className="text-xs text-blue-600 hover:underline">
        {showEn ? "Show Dutch" : "Show English"}
      </button>
    </div>
  );
}

function SprekenRecordingArea({
  recordingPhase,
  prepCountdown,
  recordCountdown,
  isRecording,
  audioBlob,
  recorderError,
  permissionDenied,
  onStartRecording,
  onStopRecording,
  onSubmit,
}: {
  recordingPhase: "prep" | "ready" | "recording" | "done";
  prepCountdown: number;
  recordCountdown: number;
  isRecording: boolean;
  audioBlob: Blob | null;
  recorderError: string | null;
  permissionDenied: boolean;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onSubmit: () => void;
}) {
  if (permissionDenied) {
    return (
      <div className="bg-red-50 rounded-xl p-4 text-center text-sm text-red-700">
        Microphone access denied. Please allow microphone access in your browser settings.
      </div>
    );
  }

  if (recorderError) {
    return (
      <div className="bg-red-50 rounded-xl p-4 text-center text-sm text-red-700">
        Recording error: {recorderError}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border p-5 text-center space-y-3">
      {recordingPhase === "prep" && (
        <>
          <div className="text-4xl font-bold text-blue-600">{prepCountdown}s</div>
          <p className="text-sm text-slate-500">Preparation time — read the question and think about your answer</p>
        </>
      )}

      {recordingPhase === "ready" && (
        <>
          <p className="text-sm text-slate-600 font-medium">Ready to record!</p>
          <button
            onClick={onStartRecording}
            className="bg-red-500 text-white px-8 py-3 rounded-full font-medium hover:bg-red-600 transition-colors"
          >
            Start Recording
          </button>
        </>
      )}

      {recordingPhase === "recording" && (
        <>
          <div className="flex items-center justify-center gap-2">
            <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
            <span className="text-4xl font-bold text-red-600">{recordCountdown}s</span>
          </div>
          <p className="text-sm text-slate-500">Recording... Speak now!</p>
          <button
            onClick={onStopRecording}
            className="border border-slate-300 text-slate-600 px-6 py-2 rounded-lg text-sm hover:bg-slate-50"
          >
            Stop Early
          </button>
        </>
      )}

      {recordingPhase === "done" && audioBlob && (
        <>
          <p className="text-sm text-green-600 font-medium">Recording complete!</p>
          <button
            onClick={onSubmit}
            className="bg-purple-600 text-white px-8 py-3 rounded-lg font-medium hover:bg-purple-700 transition-colors"
          >
            Submit for Grading
          </button>
        </>
      )}
    </div>
  );
}

function SprekenGrammarErrors({ errors }: { errors?: { wrong: string; correct: string; explanation_nl: string; explanation_zh: string }[] }) {
  if (!errors || errors.length === 0) return null;
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-slate-500">Grammar Errors ({errors.length})</p>
      {errors.map((err, i) => (
        <div key={i} className="bg-red-50 rounded-lg p-3 text-sm space-y-1">
          <p><span className="line-through text-red-600">{err.wrong}</span></p>
          <p><span className="text-green-700">{err.correct}</span></p>
          <p className="text-xs text-slate-600">{err.explanation_nl}</p>
          <p className="text-xs text-slate-500">{err.explanation_zh}</p>
        </div>
      ))}
    </div>
  );
}

function SprekenResultDetail({
  index,
  result,
}: {
  index: number;
  result: { vraag: SprekenVraag; transcript: string; feedback: Record<string, unknown>; score: number; model_answer: string };
}) {
  const fb = result.feedback as Record<string, unknown>;
  const cs = (fb.content_score as number) ?? 0;
  const gs = (fb.grammar_score as number) ?? 0;
  const grammarErrors = (fb.grammar_errors as { wrong: string; correct: string; explanation_nl: string; explanation_zh: string }[]) ?? [];

  return (
    <details className="bg-white rounded-xl border">
      <summary className="p-4 cursor-pointer flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">Vraag {index + 1}</span>
          <span className="font-medium text-sm truncate">{result.vraag.vraag_nl}</span>
        </div>
        <span className={`font-bold ${scoreColor(result.score)}`}>{cs}/{gs}</span>
      </summary>
      <div className="px-4 pb-4 space-y-3 border-t">
        <div className="grid grid-cols-2 gap-2 pt-3">
          <div className="text-center">
            <p className={`text-lg font-bold ${scoreColor(cs * 20)}`}>{cs}/5</p>
            <p className="text-xs text-slate-500">Content</p>
          </div>
          <div className="text-center">
            <p className={`text-lg font-bold ${scoreColor(gs * 20)}`}>{gs}/5</p>
            <p className="text-xs text-slate-500">Grammar</p>
          </div>
        </div>

        {typeof fb.feedback_nl === "string" && fb.feedback_nl && (
          <div className="bg-blue-50 rounded-lg p-3 text-sm">{fb.feedback_nl}</div>
        )}

        <SprekenGrammarErrors errors={grammarErrors} />

        <div className="bg-white rounded-lg border p-3 space-y-2">
          <p className="text-xs font-medium text-slate-500">Your transcript</p>
          <p className="text-sm whitespace-pre-wrap">{result.transcript || "(no speech detected)"}</p>
          <p className="text-xs text-slate-400 italic">Als de tekst niet klopt, probeer het opnieuw</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {typeof fb.improved_answer === "string" && fb.improved_answer && (
            <div>
              <p className="text-xs text-slate-400 mb-1 font-medium">Improved version</p>
              <div className="bg-green-50 rounded-lg p-2 text-sm whitespace-pre-wrap">{fb.improved_answer}</div>
            </div>
          )}
          <div>
            <p className="text-xs text-slate-400 mb-1 font-medium">Model answer</p>
            <div className="bg-blue-50 rounded-lg p-2 text-sm whitespace-pre-wrap">{result.model_answer}</div>
          </div>
        </div>
      </div>
    </details>
  );
}
