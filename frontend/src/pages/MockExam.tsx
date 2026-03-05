import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ExamResultOut, ExamSessionOut, SectionInfo, getExamSession, submitExam } from "../api";
import ScoreCard from "../components/ScoreCard";
import Timer from "../components/Timer";

type Source = "official" | "ai";
type Phase = "menu" | "section" | "results";

const PASS_SCORE = 60;

export default function MockExam() {
  const nav = useNavigate();
  const [examData, setExamData] = useState<ExamSessionOut | null>(null);
  const [source, setSource] = useState<Source>("ai");
  const [scores, setScores] = useState<Record<string, number | null>>({});
  const [phase, setPhase] = useState<Phase>("menu");
  const [activeSection, setActiveSection] = useState<SectionInfo | null>(null);
  const [timerExpired, setTimerExpired] = useState(false);
  const [finalResult, setFinalResult] = useState<ExamResultOut | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [mode, setMode] = useState<"full" | "single">("full");
  const [sectionQueue, setSectionQueue] = useState<SectionInfo[]>([]);

  useEffect(() => {
    getExamSession().then(setExamData).catch(() => {});
  }, []);

  function startFull() {
    if (!examData) return;
    const queue = [...examData.sections];
    setSectionQueue(queue);
    setScores({});
    setMode("full");
    launchSection(queue[0], queue.slice(1));
  }

  function startSingle(section: SectionInfo) {
    setScores({});
    setMode("single");
    launchSection(section, []);
  }

  function launchSection(section: SectionInfo, remaining: SectionInfo[]) {
    setActiveSection(section);
    setTimerExpired(false);
    setSectionQueue(remaining);
    setPhase("section");
  }

  function endSection(sectionScore: number) {
    if (!activeSection) return;
    const newScores = { ...scores, [activeSection.code]: sectionScore };
    setScores(newScores);

    if (mode === "full" && sectionQueue.length > 0) {
      launchSection(sectionQueue[0], sectionQueue.slice(1));
    } else {
      finishExam(newScores);
    }
  }

  async function finishExam(finalScores: Record<string, number | null>) {
    setSubmitting(true);
    try {
      const r = await submitExam(source, finalScores);
      setFinalResult(r);
      setPhase("results");
    } catch {
      setPhase("results");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Menu ───────────────────────────────────────────────────────────────────

  if (phase === "menu") {
    return (
      <div className="min-h-screen bg-slate-50">
        <header className="bg-white border-b border-slate-200 px-4 py-3">
          <button onClick={() => nav("/")} className="text-slate-500 hover:text-slate-800">
            ← Back
          </button>
        </header>
        <main className="max-w-lg mx-auto p-6 space-y-6">
          <h2 className="text-xl font-bold">Mock Exam — Inburgeringsexamen A2</h2>

          {/* Source toggle */}
          <div>
            <p className="text-sm font-medium mb-2">Material source</p>
            <div className="flex rounded-lg overflow-hidden border border-slate-200">
              {(["ai", "official"] as Source[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setSource(s)}
                  className={`flex-1 py-2 text-sm capitalize ${
                    source === s
                      ? "bg-blue-600 text-white"
                      : "bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {s === "ai" ? "AI Generated" : "Official (DUO)"}
                </button>
              ))}
            </div>
          </div>

          {/* Full exam button */}
          <button
            onClick={startFull}
            disabled={!examData}
            className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50"
          >
            Start full exam (all 5 sections)
          </button>

          {/* Individual sections */}
          <div>
            <p className="text-sm font-medium mb-2">Or practice a single section</p>
            <div className="space-y-2">
              {examData?.sections.map((s) => (
                <button
                  key={s.code}
                  onClick={() => startSingle(s)}
                  className="w-full flex justify-between items-center bg-white border border-slate-200 rounded-xl px-4 py-3 hover:border-blue-400 hover:shadow-sm transition-all"
                >
                  <span className="font-medium">{s.label}</span>
                  <span className="text-sm text-slate-400">{s.default_minutes} min</span>
                </button>
              ))}
            </div>
          </div>
        </main>
      </div>
    );
  }

  // ── Active section ─────────────────────────────────────────────────────────

  if (phase === "section" && activeSection) {
    const seconds = activeSection.default_minutes * 60;

    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <header className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between">
          <div>
            <p className="font-semibold">{activeSection.label}</p>
            <p className="text-xs text-slate-400 capitalize">{source} material</p>
          </div>
          <Timer
            initialSeconds={seconds}
            onExpired={() => setTimerExpired(true)}
          />
        </header>

        <main className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <div className="bg-white rounded-2xl border border-slate-200 shadow p-8 max-w-md w-full">
            <p className="text-4xl mb-4">🚧</p>
            <h3 className="text-lg font-bold mb-2">{activeSection.label}</h3>
            <p className="text-slate-500 text-sm mb-6">
              {source === "ai"
                ? "AI-generated questions for this section are coming soon. For now, practice using official material."
                : "Official DUO material integration coming soon. Try AI mode for generated practice questions."}
            </p>
            {timerExpired && (
              <p className="text-red-500 font-semibold mb-4">Time's up!</p>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => endSection(75)}
                className="flex-1 bg-blue-600 text-white py-2 rounded-xl font-semibold hover:bg-blue-700"
              >
                End section
              </button>
              <button
                onClick={() => {
                  setScores((s) => ({ ...s, [activeSection.code]: null }));
                  if (mode === "full" && sectionQueue.length > 0) {
                    launchSection(sectionQueue[0], sectionQueue.slice(1));
                  } else {
                    finishExam({ ...scores, [activeSection.code]: null });
                  }
                }}
                className="flex-1 border border-slate-300 py-2 rounded-xl text-sm hover:bg-slate-50"
              >
                Skip
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // ── Results ────────────────────────────────────────────────────────────────

  if (phase === "results" && finalResult) {
    const done = Object.values(finalResult.scores).filter((v) => v !== null) as number[];
    const avg = finalResult.avg_score ?? 0;

    return (
      <div className="min-h-screen bg-slate-50">
        <header className="bg-white border-b border-slate-200 px-4 py-3">
          <button onClick={() => setPhase("menu")} className="text-slate-500 hover:text-slate-800">
            ← New exam
          </button>
        </header>
        <main className="max-w-lg mx-auto p-6 space-y-4">
          <ScoreCard
            score={done.filter((v) => v >= PASS_SCORE).length}
            total={done.length}
            scorePct={avg}
            label="Overall average"
          />

          <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-2">
            {examData?.sections.map((s) => {
              const sc = finalResult.scores[s.code];
              if (sc === null || sc === undefined) return null;
              const pass = sc >= PASS_SCORE;
              return (
                <div key={s.code} className="flex justify-between text-sm">
                  <span>{s.label}</span>
                  <span className={`font-semibold ${pass ? "text-green-600" : "text-red-500"}`}>
                    {sc}% — {pass ? "PASS" : "FAIL"}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => nav("/results")}
              className="flex-1 border border-slate-300 py-2 rounded-xl text-sm hover:bg-slate-50"
            >
              See history
            </button>
            <button
              onClick={() => { setPhase("menu"); setFinalResult(null); }}
              className="flex-1 bg-blue-600 text-white py-2 rounded-xl text-sm font-semibold hover:bg-blue-700"
            >
              New exam
            </button>
          </div>
        </main>
      </div>
    );
  }

  return null;
}
