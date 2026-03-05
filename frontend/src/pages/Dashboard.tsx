import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  ExamHistoryItem,
  FlashcardStats,
  ListeningHistoryItem,
  TrainingSummary,
  getExamResults,
  getFlashcardResults,
  getListeningResults,
  getDashboardTraining,
} from "../api";

function calcStreak(listening: ListeningHistoryItem[]): number {
  if (listening.length === 0) return 0;
  const days = new Set(listening.map((l) => l.date.split("T")[0]));
  const sorted = [...days].sort().reverse();
  let streak = 0;
  const d = new Date();
  for (let i = 0; i < 365; i++) {
    const dateStr = d.toISOString().split("T")[0];
    if (sorted.includes(dateStr)) {
      streak++;
    } else if (i > 0) {
      break;
    }
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

function fmtMinutes(mins: number): string {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export default function Dashboard() {
  const nav = useNavigate();
  const username = localStorage.getItem("username") ?? "learner";
  const [fcStats, setFcStats] = useState<FlashcardStats | null>(null);
  const [listening, setListening] = useState<ListeningHistoryItem[]>([]);
  const [exams, setExams] = useState<ExamHistoryItem[]>([]);
  const [training, setTraining] = useState<TrainingSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const core = Promise.all([getFlashcardResults(), getListeningResults(), getExamResults()])
      .then(([fc, l, e]) => { setFcStats(fc); setListening(l); setExams(e); })
      .catch(() => {});
    const tr = getDashboardTraining(30).then(setTraining).catch(() => {});
    Promise.all([core, tr]).finally(() => setLoading(false));
  }, []);

  const streak = calcStreak(listening);
  const latestExam = exams[0];

  // Aggregate daily chart data: merge quiz + intensive per day
  const dailyChart = (() => {
    if (!training) return [];
    const byDay: Record<string, { date: string; quiz_min: number; intensive_min: number; quiz_score: number; intensive_score: number; quiz_n: number; intensive_n: number }> = {};
    for (const d of training.daily) {
      if (!byDay[d.date]) byDay[d.date] = { date: d.date, quiz_min: 0, intensive_min: 0, quiz_score: 0, intensive_score: 0, quiz_n: 0, intensive_n: 0 };
      const entry = byDay[d.date];
      const mins = Math.round(d.total_seconds / 60);
      if (d.mode === "quiz") {
        entry.quiz_min += mins;
        entry.quiz_score += d.avg_score * d.count;
        entry.quiz_n += d.count;
      } else {
        entry.intensive_min += mins;
        entry.intensive_score += d.avg_score * d.count;
        entry.intensive_n += d.count;
      }
    }
    return Object.values(byDay)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(d => ({
        date: d.date,
        quiz: d.quiz_min,
        intensive: d.intensive_min,
        total: d.quiz_min + d.intensive_min,
        avg_score: d.quiz_n + d.intensive_n > 0
          ? Math.round((d.quiz_score + d.intensive_score) / (d.quiz_n + d.intensive_n))
          : 0,
      }));
  })();

  return (
    <div className="max-w-3xl mx-auto">
      <h2 className="text-2xl font-bold mb-6">
        Welcome back, {username}
      </h2>

      {loading && <p className="text-slate-400 text-sm">Loading stats...</p>}

      {/* Stat cards */}
      {!loading && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard label="Study streak" value={`${streak} day${streak !== 1 ? "s" : ""}`} accent="text-orange-500" gradient="from-orange-400 to-amber-400" />
          <StatCard label="Vocab mastered" value={String(fcStats?.mastered ?? 0)} accent="text-green-600" gradient="from-green-400 to-emerald-400" />
          <StatCard label="Due today" value={String(fcStats?.due_today ?? 0)} accent="text-blue-600" gradient="from-blue-400 to-indigo-400" />
          <StatCard
            label="Latest exam"
            value={latestExam ? `${latestExam.avg_score ?? 0}%` : "--"}
            accent={latestExam?.passed ? "text-green-600" : "text-red-500"}
            badge={latestExam ? (latestExam.passed ? "PASS" : "FAIL") : undefined}
            gradient="from-purple-400 to-violet-400"
          />
        </div>
      )}

      {/* Training Overview Card */}
      {!loading && training && training.total_sessions > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 mb-8 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">Training Overview (30 days)</h3>

          {/* Summary row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
            <div className="bg-slate-50 rounded-xl p-3 text-center">
              <p className="text-xl font-bold text-slate-800">{training.total_sessions}</p>
              <p className="text-xs text-slate-500">Sessions</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-3 text-center">
              <p className="text-xl font-bold text-slate-800">{fmtMinutes(training.total_minutes)}</p>
              <p className="text-xs text-slate-500">Total time</p>
            </div>
            <div className="bg-blue-50 rounded-xl p-3 text-center">
              <p className="text-xl font-bold text-blue-600">{training.avg_score_quiz != null ? `${training.avg_score_quiz}%` : "--"}</p>
              <p className="text-xs text-slate-500">Quiz avg</p>
            </div>
            <div className="bg-amber-50 rounded-xl p-3 text-center">
              <p className="text-xl font-bold text-amber-600">{training.avg_score_intensive != null ? `${training.avg_score_intensive}%` : "--"}</p>
              <p className="text-xs text-slate-500">Intensive avg</p>
            </div>
          </div>

          {/* Session type breakdown */}
          <div className="flex items-center gap-4 mb-4 text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-blue-400 inline-block" /> Quiz ({training.quiz_sessions})
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-amber-400 inline-block" /> Intensive ({training.intensive_sessions})
            </span>
          </div>

          {/* Daily duration chart */}
          {dailyChart.length > 0 && (
            <div>
              <p className="text-xs text-slate-400 mb-2">Daily training time (minutes)</p>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={dailyChart}>
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v: string) => v.slice(5)} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip
                    formatter={(value) => [`${value}m`]}
                    labelFormatter={(label) => String(label)}
                  />
                  <Bar dataKey="quiz" stackId="a" fill="#60a5fa" radius={[0, 0, 0, 0]} name="Quiz" />
                  <Bar dataKey="intensive" stackId="a" fill="#fbbf24" radius={[2, 2, 0, 0]} name="Intensive" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Daily score dots */}
          {dailyChart.length > 0 && (
            <div className="mt-3">
              <p className="text-xs text-slate-400 mb-2">Daily average score</p>
              <div className="flex gap-1.5 flex-wrap">
                {dailyChart.slice(-14).map((d) => (
                  <div
                    key={d.date}
                    className="flex flex-col items-center"
                    title={`${d.date}: ${d.avg_score}%`}
                  >
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white ${
                        d.avg_score >= 80 ? "bg-green-500" : d.avg_score >= 60 ? "bg-blue-500" : "bg-red-400"
                      }`}
                    >
                      {d.avg_score}
                    </div>
                    <span className="text-[9px] text-slate-400 mt-0.5">{d.date.slice(8)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Quick actions */}
      <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Quick actions</h3>
      <div className="grid grid-cols-2 gap-4 mb-8">
        <button
          onClick={() => nav("/vocab-refresh")}
          className="bg-white rounded-2xl border border-slate-200 p-4 text-left hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer"
        >
          <p className="font-semibold">Start Vocab Refresh</p>
          <p className="text-sm text-slate-500">{fcStats ? `${fcStats.due_today} cards due` : "Review flashcards"}</p>
        </button>
        <button
          onClick={() => nav("/study/listening")}
          className="bg-white rounded-2xl border border-slate-200 p-4 text-left hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer"
        >
          <p className="font-semibold">New Listening</p>
          <p className="text-sm text-slate-500">Quiz or intensive dictation</p>
        </button>
      </div>

      {/* Recent activity */}
      {listening.length > 0 && (
        <>
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Recent listening</h3>
          <div className="space-y-2">
            {listening.slice(0, 5).map((l) => (
              <div
                key={l.id}
                className="bg-white rounded-2xl border border-slate-200 px-4 py-3 flex justify-between items-center"
              >
                <div className="flex items-center gap-2">
                  <div>
                    <p className="font-medium text-sm flex items-center gap-1.5">
                      {l.topic}
                      {l.level && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                          l.level === "A1" ? "bg-green-100 text-green-700" :
                          l.level === "B1" ? "bg-purple-100 text-purple-700" :
                          "bg-blue-100 text-blue-700"
                        }`}>{l.level}</span>
                      )}
                      {l.mode === "intensive" && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">intensive</span>
                      )}
                    </p>
                    <p className="text-xs text-slate-400">
                      {l.date.split("T")[0]}
                      {l.duration_seconds != null && l.duration_seconds > 0 && (
                        <span className="ml-2">{fmtMinutes(Math.round(l.duration_seconds / 60))}</span>
                      )}
                    </p>
                  </div>
                </div>
                <span
                  className={`text-sm font-semibold ${l.score_pct >= 60 ? "text-green-600" : "text-red-500"}`}
                >
                  {l.score_pct}%
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
  badge,
  gradient,
}: {
  label: string;
  value: string;
  accent: string;
  badge?: string;
  gradient?: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-all duration-200">
      {gradient && <div className={`h-1 bg-gradient-to-r ${gradient}`} />}
      <div className="p-4">
        <p className={`text-2xl font-bold ${accent}`}>{value}</p>
        <p className="text-xs text-slate-500 mt-1">{label}</p>
        {badge && (
          <span
            className={`mt-1 inline-block text-xs px-2 py-0.5 rounded-full font-medium ${
              badge === "PASS" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
            }`}
          >
            {badge}
          </span>
        )}
      </div>
    </div>
  );
}
