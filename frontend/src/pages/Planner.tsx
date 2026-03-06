import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  PlannerProfile,
  PlannerStatus,
  PlannerDailyPlan,
  PlannerTask,
  PlannerHistoryItem,
  PlacementQuestions,
  PlacementSubmitResponse,
  PlannerWeeklyReport,
  PlannerRoadmap,
  getPlannerProfile,
  getPlannerStatus,
  updatePlannerProfile,
  enablePlanner,
  disablePlanner,
  getPlacementQuestions,
  submitPlacement,
  getTodayPlan,
  regenerateTodayPlan,
  completeTask,
  skipTask,
  getPlannerHistory,
  getWeeklyReport,
  getRoadmap,
} from "../api";
import { TASK_TYPE_LABELS, TASK_TYPE_COLORS, TASK_TYPE_ROUTES } from "../constants/taskTypes";

// ── Constants ───────────────────────────────────────────────────────────────

const GOALS = [
  { value: "exam", label: "Pass A2 Exam", desc: "Prepare for the inburgering exam" },
  { value: "everyday", label: "Everyday Dutch", desc: "Communicate in daily life" },
  { value: "work", label: "Work Dutch", desc: "Professional communication" },
];
const TIMELINES = [
  { value: 3, label: "3 months" },
  { value: 6, label: "6 months" },
  { value: 12, label: "12 months" },
];
const DAILY_MINUTES = [
  { value: 30, label: "30 min" },
  { value: 60, label: "1 hour" },
  { value: 90, label: "1.5 hours" },
  { value: 120, label: "2 hours" },
];

// ── Main Component ──────────────────────────────────────────────────────────

export default function Planner() {
  const [status, setStatus] = useState<PlannerStatus | null>(null);
  const [profile, setProfile] = useState<PlannerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function reload() {
    setLoading(true);
    setError("");
    try {
      const [s, p] = await Promise.all([getPlannerStatus(), getPlannerProfile()]);
      setStatus(s);
      setProfile(p);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load planner");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { reload(); }, []);

  if (loading) return <div className="max-w-2xl mx-auto"><p className="text-slate-400 text-sm">Loading planner...</p></div>;
  if (error) return <div className="max-w-2xl mx-auto"><p className="text-red-500 text-sm">{error}</p></div>;
  if (!status || !profile) return null;

  // Not enabled → show intro
  if (!status.planner_enabled) {
    return <PlannerIntro onEnable={reload} />;
  }

  // Onboarding steps
  if (status.step === "goal") {
    return <GoalSetup profile={profile} onDone={reload} />;
  }
  if (status.step === "placement") {
    return <PlacementTest profile={profile} onDone={reload} />;
  }

  // Ready → show daily plan
  return <DailyView profile={profile} onDisable={reload} />;
}

// ── Intro (Not Enabled) ────────────────────────────────────────────────────

function PlannerIntro({ onEnable }: { onEnable: () => void }) {
  const [busy, setBusy] = useState(false);

  async function handleEnable() {
    setBusy(true);
    try {
      await enablePlanner();
      onEnable();
    } catch { setBusy(false); }
  }

  return (
    <div className="max-w-lg mx-auto text-center py-12">
      <div className="text-5xl mb-4">🎯</div>
      <h2 className="text-2xl font-bold mb-3">AI Learning Planner</h2>
      <p className="text-slate-500 mb-6">
        Get a personalized daily study plan adapted to your level, goals, and progress.
        The planner is optional — you can always use the app freestyle.
      </p>
      <button
        onClick={handleEnable}
        disabled={busy}
        className="bg-blue-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-blue-700 transition disabled:opacity-50"
      >
        {busy ? "Setting up..." : "Enable Planner"}
      </button>
    </div>
  );
}

// ── Goal Setup ──────────────────────────────────────────────────────────────

function GoalSetup({ profile, onDone }: { profile: PlannerProfile; onDone: () => void }) {
  const [goal, setGoal] = useState(profile.goal ?? "");
  const [timeline, setTimeline] = useState(profile.timeline_months ?? 6);
  const [minutes, setMinutes] = useState(profile.daily_minutes ?? 60);
  const [lang, setLang] = useState(profile.language ?? "en");
  const [busy, setBusy] = useState(false);

  async function handleSave() {
    if (!goal) return;
    setBusy(true);
    try {
      await updatePlannerProfile({ language: lang, goal, timeline_months: timeline, daily_minutes: minutes });
      onDone();
    } catch { setBusy(false); }
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <h2 className="text-xl font-bold">Set Your Learning Goal</h2>

      {/* Language */}
      <div>
        <label className="text-sm font-medium text-slate-600 block mb-2">Interface Language</label>
        <div className="flex gap-3">
          {[{ v: "en", l: "English" }, { v: "zh", l: "中文" }].map(o => (
            <button key={o.v} onClick={() => setLang(o.v)}
              className={`px-4 py-2 rounded-lg border text-sm font-medium transition ${lang === o.v ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-600 hover:border-slate-300"}`}
            >{o.l}</button>
          ))}
        </div>
      </div>

      {/* Goal */}
      <div>
        <label className="text-sm font-medium text-slate-600 block mb-2">What's your goal?</label>
        <div className="space-y-2">
          {GOALS.map(g => (
            <button key={g.value} onClick={() => setGoal(g.value)}
              className={`w-full text-left px-4 py-3 rounded-xl border transition ${goal === g.value ? "border-blue-500 bg-blue-50" : "border-slate-200 hover:border-slate-300"}`}
            >
              <p className="font-medium">{g.label}</p>
              <p className="text-xs text-slate-500">{g.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Timeline */}
      <div>
        <label className="text-sm font-medium text-slate-600 block mb-2">Timeline</label>
        <div className="flex gap-3">
          {TIMELINES.map(t => (
            <button key={t.value} onClick={() => setTimeline(t.value)}
              className={`flex-1 px-3 py-2 rounded-lg border text-sm font-medium transition ${timeline === t.value ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-600 hover:border-slate-300"}`}
            >{t.label}</button>
          ))}
        </div>
      </div>

      {/* Daily Minutes */}
      <div>
        <label className="text-sm font-medium text-slate-600 block mb-2">Daily study time</label>
        <div className="grid grid-cols-2 gap-3">
          {DAILY_MINUTES.map(d => (
            <button key={d.value} onClick={() => setMinutes(d.value)}
              className={`px-3 py-2 rounded-lg border text-sm font-medium transition ${minutes === d.value ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-600 hover:border-slate-300"}`}
            >{d.label}</button>
          ))}
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={!goal || busy}
        className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition disabled:opacity-50"
      >
        {busy ? "Saving..." : "Continue to Placement Test"}
      </button>
    </div>
  );
}

// ── Placement Test ──────────────────────────────────────────────────────────

function PlacementTest({ profile, onDone }: { profile: PlannerProfile; onDone: () => void }) {
  const [step, setStep] = useState<"intro" | "loading" | "test" | "submitting" | "result">("intro");
  const [questions, setQuestions] = useState<PlacementQuestions | null>(null);
  const [vocabAnswers, setVocabAnswers] = useState<string[]>([]);
  const [listeningAnswers, setListeningAnswers] = useState<string[]>([]);
  const [readingAnswers, setReadingAnswers] = useState<string[]>([]);
  const [writingText, setWritingText] = useState("");
  const [section, setSection] = useState(0); // 0=vocab, 1=listening, 2=reading, 3=writing
  const [result, setResult] = useState<PlacementSubmitResponse | null>(null);
  const [error, setError] = useState("");

  async function startTest() {
    setStep("loading");
    setError("");
    try {
      const q = await getPlacementQuestions();
      setQuestions(q);
      setVocabAnswers(Array(q.vocab.length).fill(""));
      setListeningAnswers(Array(q.listening.length).fill(""));
      setReadingAnswers(Array(q.reading.length).fill(""));
      setSection(0);
      setStep("test");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load questions");
      setStep("intro");
    }
  }

  async function handleSubmit() {
    if (!questions) return;
    setStep("submitting");
    try {
      const r = await submitPlacement({
        vocab_answers: vocabAnswers,
        listening_answers: listeningAnswers,
        reading_answers: readingAnswers,
        writing_text: writingText,
        questions,
      });
      setResult(r);
      setStep("result");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Submission failed");
      setStep("test");
    }
  }

  if (step === "intro" || step === "loading") {
    return (
      <div className="max-w-lg mx-auto text-center py-12">
        <div className="text-5xl mb-4">📝</div>
        <h2 className="text-2xl font-bold mb-3">Placement Test</h2>
        <p className="text-slate-500 mb-2">
          A quick test to assess your Dutch level. It has 4 sections:
        </p>
        <div className="text-left max-w-xs mx-auto text-sm text-slate-600 space-y-1 mb-6">
          <p>1. Vocabulary (5 questions)</p>
          <p>2. Listening comprehension (3 questions)</p>
          <p>3. Reading comprehension (3 questions)</p>
          <p>4. Writing (short text)</p>
        </div>
        {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
        <button
          onClick={startTest}
          disabled={step === "loading"}
          className="bg-blue-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-blue-700 transition disabled:opacity-50"
        >
          {step === "loading" ? "Generating questions..." : "Start Test"}
        </button>
        <button
          onClick={async () => {
            await updatePlannerProfile({ current_level: "A1", placement_completed: true });
            onDone();
          }}
          className="block mx-auto mt-4 text-sm text-slate-400 hover:text-slate-600"
        >
          Skip (start at A1)
        </button>
      </div>
    );
  }

  if (step === "result" && result) {
    return (
      <div className="max-w-lg mx-auto space-y-6 py-6">
        <div className="text-center">
          <div className="text-5xl mb-3">🎉</div>
          <h2 className="text-2xl font-bold mb-1">Your Level: {result.overall_level}</h2>
          <p className="text-slate-500 text-sm">Based on your placement test results</p>
        </div>

        {/* Scores */}
        <div className="grid grid-cols-2 gap-3">
          <ScoreBox label="Vocabulary" score={`${result.vocab_score}/5`} pct={result.vocab_score / 5 * 100} />
          <ScoreBox label="Listening" score={`${result.listening_score}/3`} pct={result.listening_score / 3 * 100} />
          <ScoreBox label="Reading" score={`${result.reading_score}/3`} pct={result.reading_score / 3 * 100} />
          <ScoreBox label="Writing" score={`${result.writing_score}/100`} pct={result.writing_score} />
        </div>

        {/* Writing feedback */}
        {result.writing_feedback && (
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <h3 className="font-semibold text-sm mb-2">Writing Feedback</h3>
            {result.writing_feedback.strengths?.length > 0 && (
              <div className="mb-2">
                <p className="text-xs font-medium text-green-600 mb-1">Strengths</p>
                {result.writing_feedback.strengths.map((s, i) => (
                  <p key={i} className="text-xs text-slate-600 ml-2">+ {s}</p>
                ))}
              </div>
            )}
            {result.writing_feedback.errors?.length > 0 && (
              <div>
                <p className="text-xs font-medium text-red-500 mb-1">Areas to improve</p>
                {result.writing_feedback.errors.map((e, i) => (
                  <p key={i} className="text-xs text-slate-600 ml-2">- {e}</p>
                ))}
              </div>
            )}
          </div>
        )}

        {result.weak_skills.length > 0 && (
          <p className="text-sm text-slate-500">
            Focus areas: <span className="font-medium text-slate-700">{result.weak_skills.join(", ")}</span>
          </p>
        )}

        <button
          onClick={onDone}
          className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition"
        >
          Start My Learning Plan
        </button>
      </div>
    );
  }

  // Test in progress
  if (!questions) return null;

  const sections = ["Vocabulary", "Listening", "Reading", "Writing"];

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Progress */}
      <div className="flex items-center gap-2">
        {sections.map((s, i) => (
          <button key={s} onClick={() => setSection(i)}
            className={`flex-1 text-center py-2 rounded-lg text-xs font-medium transition ${
              i === section ? "bg-blue-600 text-white" : i < section ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-400"
            }`}
          >{s}</button>
        ))}
      </div>
      {error && <p className="text-red-500 text-sm">{error}</p>}

      {/* Vocab */}
      {section === 0 && (
        <MCQSection
          title="Vocabulary"
          items={questions.vocab.map(q => ({ prompt: q.question, options: q.options }))}
          answers={vocabAnswers}
          onAnswer={(i, v) => { const a = [...vocabAnswers]; a[i] = v; setVocabAnswers(a); }}
        />
      )}

      {/* Listening */}
      {section === 1 && (
        <MCQSection
          title="Listening Comprehension"
          items={questions.listening.map(q => ({ prompt: q.text, subPrompt: q.question, options: q.options }))}
          answers={listeningAnswers}
          onAnswer={(i, v) => { const a = [...listeningAnswers]; a[i] = v; setListeningAnswers(a); }}
        />
      )}

      {/* Reading */}
      {section === 2 && (
        <MCQSection
          title="Reading Comprehension"
          items={questions.reading.map(q => ({ prompt: q.passage, subPrompt: q.question, options: q.options }))}
          answers={readingAnswers}
          onAnswer={(i, v) => { const a = [...readingAnswers]; a[i] = v; setReadingAnswers(a); }}
        />
      )}

      {/* Writing */}
      {section === 3 && (
        <div className="space-y-4">
          <h3 className="font-semibold">Writing</h3>
          <div className="bg-blue-50 rounded-xl p-4 text-sm text-blue-800">
            {questions.writing_prompt}
          </div>
          <textarea
            value={writingText}
            onChange={e => setWritingText(e.target.value)}
            placeholder="Write your answer in Dutch..."
            rows={6}
            className="w-full border border-slate-200 rounded-xl p-4 text-sm focus:outline-none focus:border-blue-400"
          />
          {step === "submitting" && (
            <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-xl text-sm text-blue-700">
              <svg className="animate-spin h-5 w-5 text-blue-600" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              AI is grading your writing...
            </div>
          )}
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between">
        <button
          onClick={() => setSection(Math.max(0, section - 1))}
          disabled={section === 0}
          className="px-4 py-2 rounded-lg border border-slate-200 text-sm disabled:opacity-30"
        >
          Previous
        </button>
        {section < 3 ? (
          <button
            onClick={() => setSection(section + 1)}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700 transition"
          >
            Next
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={step === "submitting"}
            className="px-6 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition disabled:opacity-50"
          >
            {step === "submitting" ? "Grading..." : "Submit"}
          </button>
        )}
      </div>
    </div>
  );
}

function MCQSection({ title, items, answers, onAnswer }: {
  title: string;
  items: { prompt: string; subPrompt?: string; options: Record<string, string> }[];
  answers: string[];
  onAnswer: (index: number, value: string) => void;
}) {
  return (
    <div className="space-y-4">
      <h3 className="font-semibold">{title}</h3>
      {items.map((item, i) => (
        <div key={i} className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-sm font-medium mb-1">{item.prompt}</p>
          {item.subPrompt && <p className="text-sm text-slate-600 mb-3">{item.subPrompt}</p>}
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(item.options).map(([key, text]) => (
              <button
                key={key}
                onClick={() => onAnswer(i, key)}
                className={`text-left px-3 py-2 rounded-lg border text-sm transition ${
                  answers[i] === key
                    ? "border-blue-500 bg-blue-50 text-blue-700"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <span className="font-medium">{key}.</span> {text}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ScoreBox({ label, score, pct }: { label: string; score: string; pct: number }) {
  const color = pct >= 70 ? "text-green-600" : pct >= 40 ? "text-blue-600" : "text-red-500";
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-3 text-center">
      <p className={`text-lg font-bold ${color}`}>{score}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}

// ── Daily View (Main Planner Screen) ────────────────────────────────────────

function DailyView({ profile, onDisable }: { profile: PlannerProfile; onDisable: () => void }) {
  const [tab, setTab] = useState<"today" | "history" | "roadmap" | "report">("today");
  const [plan, setPlan] = useState<PlannerDailyPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadPlan() {
    setLoading(true);
    setError("");
    try {
      const p = await getTodayPlan();
      setPlan(p);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load plan");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadPlan(); }, []);

  async function handleRegenerate() {
    setLoading(true);
    try {
      const p = await regenerateTodayPlan();
      setPlan(p);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Regeneration failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleComplete(taskId: number, score: number) {
    try {
      await completeTask(taskId, { score });
      loadPlan();
    } catch {}
  }

  async function handleSkip(taskId: number) {
    try {
      await skipTask(taskId);
      loadPlan();
    } catch {}
  }

  async function handleDisable() {
    await disablePlanner();
    onDisable();
  }

  const tabs = [
    { key: "today", label: "Today" },
    { key: "history", label: "History" },
    { key: "roadmap", label: "Roadmap" },
    { key: "report", label: "Weekly Report" },
  ] as const;

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold">Learning Planner</h2>
          <p className="text-xs text-slate-400">
            Level: <span className="font-medium text-slate-600">{profile.current_level}</span>
            {" · "}Goal: <span className="font-medium text-slate-600">{profile.goal}</span>
            {" · "}{profile.daily_minutes}min/day
          </p>
        </div>
        <button onClick={handleDisable} className="text-xs text-slate-400 hover:text-red-500 transition">
          Disable Planner
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-lg p-1 mb-6">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 py-1.5 rounded-md text-xs font-medium transition ${
              tab === t.key ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}
          >{t.label}</button>
        ))}
      </div>

      {tab === "today" && (
        <>
          {loading && <p className="text-slate-400 text-sm">Loading today's plan...</p>}
          {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
          {plan && !loading && (
            <TodayPlan
              plan={plan}
              onComplete={handleComplete}
              onSkip={handleSkip}
              onRegenerate={handleRegenerate}
            />
          )}
        </>
      )}
      {tab === "history" && <HistoryTab />}
      {tab === "roadmap" && <RoadmapTab />}
      {tab === "report" && <WeeklyReportTab />}
    </div>
  );
}

// ── Today Plan ──────────────────────────────────────────────────────────────

function TodayPlan({ plan, onComplete, onSkip, onRegenerate }: {
  plan: PlannerDailyPlan;
  onComplete: (id: number, score: number) => void;
  onSkip: (id: number) => void;
  onRegenerate: () => void;
}) {
  const total = plan.tasks.length;
  const done = plan.tasks.filter(t => t.status === "completed").length;
  const pct = total > 0 ? Math.round(done / total * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Focus headline */}
      <div className="bg-gradient-to-r from-blue-500 to-indigo-500 rounded-2xl p-5 text-white">
        <p className="text-lg font-bold">{plan.focus_headline}</p>
        {plan.progress_note && <p className="text-sm opacity-80 mt-1">{plan.progress_note}</p>}
        {/* Progress bar */}
        <div className="mt-3 bg-white/20 rounded-full h-2">
          <div className="bg-white rounded-full h-2 transition-all" style={{ width: `${pct}%` }} />
        </div>
        <p className="text-xs opacity-70 mt-1">{done}/{total} tasks completed ({pct}%)</p>
      </div>

      {/* Coach message */}
      {plan.coach_message && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          💡 {plan.coach_message}
        </div>
      )}

      {plan.retry && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-600">
          AI generation failed. Showing fallback plan. Try regenerating.
        </div>
      )}

      {/* Tasks */}
      <div className="space-y-3">
        {plan.tasks.map(task => (
          <TaskCard key={task.id} task={task} onComplete={onComplete} onSkip={onSkip} />
        ))}
      </div>

      {/* Regenerate */}
      <button
        onClick={onRegenerate}
        className="w-full text-center text-xs text-slate-400 hover:text-blue-500 py-2 transition"
      >
        Regenerate today's plan
      </button>
    </div>
  );
}

const SCORE_OPTIONS = [
  { label: "Poor", value: 25, color: "bg-red-100 text-red-700 hover:bg-red-200" },
  { label: "OK", value: 50, color: "bg-amber-100 text-amber-700 hover:bg-amber-200" },
  { label: "Good", value: 75, color: "bg-blue-100 text-blue-700 hover:bg-blue-200" },
  { label: "Great", value: 100, color: "bg-green-100 text-green-700 hover:bg-green-200" },
];

function TaskCard({ task, onComplete, onSkip }: {
  task: PlannerTask;
  onComplete: (id: number, score: number) => void;
  onSkip: (id: number) => void;
}) {
  const nav = useNavigate();
  const [showScore, setShowScore] = useState(false);
  const typeLabel = TASK_TYPE_LABELS[task.task_type] ?? task.task_type;
  const typeColor = TASK_TYPE_COLORS[task.task_type] ?? "bg-slate-100 text-slate-600";
  const isDone = task.status === "completed";
  const isSkipped = task.status === "skipped";
  const route = TASK_TYPE_ROUTES[task.task_type];

  return (
    <div className={`bg-white rounded-xl border p-4 transition ${
      isDone ? "border-green-200 bg-green-50/50" : isSkipped ? "border-slate-200 opacity-50" : "border-slate-200"
    }`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${typeColor}`}>
              {typeLabel}
            </span>
            <span className="text-[10px] text-slate-400">{task.duration_minutes}min · {task.difficulty}</span>
            {isDone && <span className="text-[10px] text-green-600 font-medium">Done</span>}
            {isSkipped && <span className="text-[10px] text-slate-400 font-medium">Skipped</span>}
          </div>
          <p className="text-sm text-slate-700">{task.description}</p>
          {task.score !== null && (
            <p className="text-xs text-slate-500 mt-1">Score: {task.score}%</p>
          )}
        </div>

        {task.status === "pending" && (
          <div className="flex gap-1.5 flex-shrink-0">
            {route && (
              <button
                onClick={() => nav(route)}
                className="text-xs bg-blue-100 text-blue-700 px-3 py-1.5 rounded-lg hover:bg-blue-200 transition font-medium"
              >
                Start
              </button>
            )}
            <button
              onClick={() => setShowScore(true)}
              className="text-xs bg-green-100 text-green-700 px-3 py-1.5 rounded-lg hover:bg-green-200 transition font-medium"
            >
              Done
            </button>
            <button
              onClick={() => onSkip(task.id)}
              className="text-xs bg-slate-100 text-slate-500 px-3 py-1.5 rounded-lg hover:bg-slate-200 transition"
            >
              Skip
            </button>
          </div>
        )}
      </div>

      {/* Score prompt */}
      {showScore && (
        <div className="mt-3 pt-3 border-t border-slate-100">
          <p className="text-xs text-slate-500 mb-2">How did it go?</p>
          <div className="flex gap-2">
            {SCORE_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => { setShowScore(false); onComplete(task.id, opt.value); }}
                className={`flex-1 text-xs px-2 py-1.5 rounded-lg font-medium transition ${opt.color}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowScore(false)}
            className="text-[10px] text-slate-400 hover:text-slate-600 mt-2"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}

// ── History Tab ─────────────────────────────────────────────────────────────

function HistoryTab() {
  const [items, setItems] = useState<PlannerHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getPlannerHistory(30).then(setItems).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-slate-400 text-sm">Loading history...</p>;
  if (items.length === 0) return <p className="text-slate-400 text-sm">No history yet. Complete your first day!</p>;

  return (
    <div className="space-y-2">
      {items.map(item => (
        <div key={item.plan_date} className="bg-white rounded-xl border border-slate-200 px-4 py-3 flex justify-between items-center">
          <div>
            <p className="text-sm font-medium">{item.focus_headline || item.plan_date}</p>
            <p className="text-xs text-slate-400">{item.plan_date} · {item.completed_tasks}/{item.total_tasks} tasks</p>
          </div>
          <div className={`text-sm font-bold ${item.completion_pct >= 80 ? "text-green-600" : item.completion_pct >= 50 ? "text-blue-600" : "text-slate-400"}`}>
            {item.completion_pct}%
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Roadmap Tab ─────────────────────────────────────────────────────────────

function RoadmapTab() {
  const [roadmap, setRoadmap] = useState<PlannerRoadmap | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    getRoadmap().then(setRoadmap).catch((e: unknown) => setError(e instanceof Error ? e.message : "Failed")).finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-slate-400 text-sm">Loading roadmap...</p>;
  if (error) return <p className="text-red-500 text-sm">{error}</p>;
  if (!roadmap) return null;

  const SKILL_COLORS: Record<string, string> = {
    vocabulary: "bg-green-400",
    listening: "bg-blue-400",
    reading: "bg-purple-400",
    writing: "bg-rose-400",
  };

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Your Learning Roadmap</h3>
      {roadmap.phases.map((phase, i) => (
        <div key={i} className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">Month {phase.month}</span>
          </div>
          <p className="text-sm text-slate-700 mb-3">{phase.milestone}</p>
          {/* Skill weights bar */}
          <div className="flex rounded-full overflow-hidden h-2">
            {Object.entries(phase.skill_weights).map(([skill, weight]) => (
              <div
                key={skill}
                className={SKILL_COLORS[skill] ?? "bg-slate-300"}
                style={{ width: `${weight}%` }}
                title={`${skill}: ${weight}%`}
              />
            ))}
          </div>
          <div className="flex gap-3 mt-2 flex-wrap">
            {Object.entries(phase.skill_weights).map(([skill, weight]) => (
              <span key={skill} className="text-[10px] text-slate-500 flex items-center gap-1">
                <span className={`w-2 h-2 rounded-full ${SKILL_COLORS[skill] ?? "bg-slate-300"}`} />
                {skill} {weight}%
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Weekly Report Tab ───────────────────────────────────────────────────────

function WeeklyReportTab() {
  const [report, setReport] = useState<PlannerWeeklyReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    getWeeklyReport().then(setReport).catch((e: unknown) => setError(e instanceof Error ? e.message : "Failed")).finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-slate-400 text-sm">Generating weekly report...</p>;
  if (error) return <p className="text-red-500 text-sm">{error}</p>;
  if (!report) return null;

  const r = report.report;

  return (
    <div className="space-y-4">
      <div className="text-xs text-slate-400">{report.week_start} — {report.week_end}</div>

      {/* Completion rate */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
        <p className={`text-3xl font-bold ${r.completion_rate >= 80 ? "text-green-600" : r.completion_rate >= 50 ? "text-blue-600" : "text-red-500"}`}>
          {r.completion_rate}%
        </p>
        <p className="text-xs text-slate-500">Task completion rate</p>
      </div>

      {/* Score changes */}
      <div className="grid grid-cols-2 gap-3">
        {Object.entries(r.score_changes).map(([skill, change]) => (
          <div key={skill} className="bg-white rounded-xl border border-slate-200 p-3 text-center">
            <p className={`text-sm font-bold ${change.startsWith("+") ? "text-green-600" : change.startsWith("-") ? "text-red-500" : "text-slate-500"}`}>
              {change}
            </p>
            <p className="text-xs text-slate-500 capitalize">{skill}</p>
          </div>
        ))}
      </div>

      {/* Summary */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex gap-3 mb-3 text-xs">
          {r.biggest_improvement && (
            <span className="bg-green-50 text-green-700 px-2 py-1 rounded-full">
              Best: {r.biggest_improvement}
            </span>
          )}
          {r.focus_next_week && (
            <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded-full">
              Focus next: {r.focus_next_week}
            </span>
          )}
        </div>
        <p className="text-sm text-slate-700 leading-relaxed">{r.summary_text}</p>
      </div>
    </div>
  );
}
