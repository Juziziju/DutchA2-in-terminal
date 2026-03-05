import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ExamHistoryItem,
  FlashcardStats,
  ListeningHistoryItem,
  getExamResults,
  getFlashcardResults,
  getListeningResults,
} from "../api";

type Tab = "flashcards" | "listening" | "exam";

export default function Results() {
  const nav = useNavigate();
  const [tab, setTab] = useState<Tab>("flashcards");
  const [fcStats, setFcStats] = useState<FlashcardStats | null>(null);
  const [listening, setListening] = useState<ListeningHistoryItem[]>([]);
  const [exams, setExams] = useState<ExamHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    Promise.all([getFlashcardResults(), getListeningResults(), getExamResults()])
      .then(([fc, l, e]) => {
        setFcStats(fc);
        setListening(l);
        setExams(e);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const TABS: { key: Tab; label: string }[] = [
    { key: "flashcards", label: "Flashcards" },
    { key: "listening", label: "Listening" },
    { key: "exam", label: "Mock Exam" },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-4 py-3">
        <button onClick={() => nav("/")} className="text-slate-500 hover:text-slate-800">
          ← Back
        </button>
      </header>

      <main className="max-w-2xl mx-auto p-6">
        <h2 className="text-xl font-bold mb-4">Results & History</h2>

        {/* Tab bar */}
        <div className="flex rounded-lg overflow-hidden border border-slate-200 mb-6">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 py-2 text-sm font-medium ${
                tab === t.key
                  ? "bg-blue-600 text-white"
                  : "bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {loading && <p className="text-slate-400 text-sm">Loading...</p>}

        {/* Flashcards tab */}
        {tab === "flashcards" && fcStats && (
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: "Total cards tracked", value: fcStats.total_cards },
              { label: "Mastered", value: fcStats.mastered },
              { label: "Due today", value: fcStats.due_today },
              { label: "Total reviewed", value: fcStats.total_reviewed },
            ].map((s) => (
              <div
                key={s.label}
                className="bg-white rounded-xl border border-slate-200 p-4 text-center"
              >
                <p className="text-3xl font-bold">{s.value}</p>
                <p className="text-xs text-slate-500 mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Listening tab */}
        {tab === "listening" && (
          <div className="space-y-2">
            {listening.length === 0 && (
              <p className="text-slate-400 text-sm">No listening sessions yet.</p>
            )}
            {listening.map((l) => (
              <div
                key={l.id}
                className="bg-white rounded-xl border border-slate-200 px-4 py-3 flex justify-between items-center"
              >
                <div>
                  <p className="font-medium text-sm">{l.topic}</p>
                  <p className="text-xs text-slate-400">{l.date.split("T")[0]}</p>
                </div>
                <span
                  className={`text-sm font-semibold ${
                    l.score_pct >= 60 ? "text-green-600" : "text-red-500"
                  }`}
                >
                  {l.score_pct}%
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Exam tab */}
        {tab === "exam" && (
          <div className="space-y-2">
            {exams.length === 0 && (
              <p className="text-slate-400 text-sm">No mock exams completed yet.</p>
            )}
            {exams.map((e) => (
              <div
                key={e.id}
                className="bg-white rounded-xl border border-slate-200 px-4 py-3 flex justify-between items-center"
              >
                <div>
                  <p className="font-medium text-sm capitalize">{e.source} material</p>
                  <p className="text-xs text-slate-400">{e.date.split("T")[0]}</p>
                </div>
                <div className="text-right">
                  <p
                    className={`text-sm font-semibold ${
                      e.passed ? "text-green-600" : "text-red-500"
                    }`}
                  >
                    {e.avg_score !== null ? `${e.avg_score}%` : "—"} —{" "}
                    {e.passed ? "PASS" : "FAIL"}
                  </p>
                  <p className="text-xs text-slate-400">
                    Sections: {Object.keys(e.scores).join(", ")}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
