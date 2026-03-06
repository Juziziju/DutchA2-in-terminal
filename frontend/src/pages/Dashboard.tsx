import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Line, ComposedChart,
} from "recharts";
import OnboardingTour, { TourStep, isTourDone, setTourDone } from "../components/OnboardingTour";
import { useSidebar } from "../hooks/useSidebar";
import {
  DashboardInsights,
  ExamHistoryItem,
  FlashcardStats,
  ListeningHistoryItem,
  SpeakingHistoryItem,
  TrainingSummary,
  PlannerStatus,
  PlannerDailyPlan,
  getExamResults,
  getFlashcardResults,
  getListeningResults,
  getSpeakingHistory,
  getStreak,
  getDashboardTraining,
  getDashboardInsights,
  getPlannerStatus,
  getTodayPlan,
} from "../api";
import ExamCountdownRing from "../components/dashboard/ExamCountdownRing";
import SkillRadarCard from "../components/dashboard/SkillRadarCard";
import WeakCategoriesCard from "../components/dashboard/WeakCategoriesCard";
import ConsistencyHeatmap from "../components/dashboard/ConsistencyHeatmap";
import SpeakingSubScoresCard from "../components/dashboard/SpeakingSubScoresCard";
import PracticeBalanceCard from "../components/dashboard/PracticeBalanceCard";
import SmartQuickActions from "../components/dashboard/SmartQuickActions";
import RecentActivityTabs from "../components/dashboard/RecentActivityTabs";

function fmtMinutes(mins: number): string {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

const TOUR_STEPS: TourStep[] = [
  { targetSelector: '[data-tour="welcome-bar"]', title: "Welcome Bar", description: "This is your personal dashboard. It shows a welcome message and your exam countdown timer.", placement: "bottom" },
  { targetSelector: '[data-tour="stat-cards"]', title: "Stat Cards", description: "These cards show your study streak, vocab mastered, cards due today, review consistency, and planner completion rate.", placement: "bottom" },
  { targetSelector: '[data-tour="skill-insights"]', title: "Skill Radar & Weak Categories", description: "Track your skill levels across all areas and see which vocab categories need more work.", placement: "top" },
  { targetSelector: '[data-tour="quick-actions"]', title: "Quick Actions", description: "Jump straight into the most useful activities \u2014 vocab review, listening practice, your weakest skill, or AI advisor.", placement: "top" },
  { targetSelector: '[data-tour="recent-activity"]', title: "Recent Activity", description: "See your recent listening, speaking, and exam sessions at a glance.", placement: "top" },
  { targetSelector: '[data-tour="study-menu"]', title: "Study", description: "Practice Listening, Speaking, Reading, Writing, and KNM exercises here.", placement: "right", needsSidebar: true },
  { targetSelector: '[data-tour="vocab-refresh"]', title: "Vocab Refresh", description: "Review your flashcards using spaced repetition. The badge shows how many cards are due.", placement: "right", needsSidebar: true },
  { targetSelector: '[data-tour="planner"]', title: "Learning Planner", description: "Set your exam date and get a personalized daily study plan.", placement: "right", needsSidebar: true },
  { targetSelector: '[data-tour="mock-exam"]', title: "Mock Exam", description: "Take practice exams to test your readiness.", placement: "right", needsSidebar: true },
  { targetSelector: '[data-tour="ai-advisor"]', title: "AI Advisor", description: "Ask the AI for study tips, explanations, or help with Dutch grammar.", placement: "right", needsSidebar: true },
];

export default function Dashboard() {
  const nav = useNavigate();
  const sidebar = useSidebar();
  const username = localStorage.getItem("username") ?? "learner";
  const [fcStats, setFcStats] = useState<FlashcardStats | null>(null);
  const [listening, setListening] = useState<ListeningHistoryItem[]>([]);
  const [speaking, setSpeaking] = useState<SpeakingHistoryItem[]>([]);
  const [exams, setExams] = useState<ExamHistoryItem[]>([]);
  const [training, setTraining] = useState<TrainingSummary | null>(null);
  const [insights, setInsights] = useState<DashboardInsights | null>(null);
  const [plannerStatus, setPlannerStatus] = useState<PlannerStatus | null>(null);
  const [todayPlan, setTodayPlan] = useState<PlannerDailyPlan | null>(null);
  const [streak, setStreak] = useState(0);
  const [activeDates, setActiveDates] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTour, setShowTour] = useState(false);

  // Show tour after data loads for first-time users
  useEffect(() => {
    if (!loading && !isTourDone()) {
      // Expand sidebar for tour
      sidebar.setCollapsed(false);
      sidebar.expandSubmenu("study");
      setShowTour(true);
    }
  }, [loading]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleTourComplete = useCallback(() => {
    setShowTour(false);
  }, []);

  useEffect(() => {
    const core = Promise.all([getFlashcardResults(), getListeningResults(), getExamResults(), getSpeakingHistory()])
      .then(([fc, l, e, s]) => { setFcStats(fc); setListening(l); setExams(e); setSpeaking(s); })
      .catch(() => {});
    const tr = getDashboardTraining(30).then(setTraining).catch(() => {});
    const sk = getStreak().then(r => { setStreak(r.streak); setActiveDates(r.active_dates); }).catch(() => {});
    const ins = getDashboardInsights().then(setInsights).catch(() => {});
    const planner = getPlannerStatus()
      .then(s => {
        setPlannerStatus(s);
        if (s.planner_enabled && s.step === "ready") {
          return getTodayPlan().then(setTodayPlan).catch(() => {});
        }
      })
      .catch(() => {});
    Promise.all([core, tr, sk, ins, planner]).finally(() => setLoading(false));
  }, []);

  // Aggregate daily chart data
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

  const streakSubtitle = streak >= 7 ? "You're on fire! Keep it up!" : streak >= 3 ? "Building momentum!" : streak > 0 ? "Great start, keep going!" : "Start studying to build your streak!";

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {loading && <p className="text-slate-400 text-sm">Loading stats...</p>}

      {/* Section 1: Hero Welcome Bar */}
      {!loading && (
        <div data-tour="welcome-bar" className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl p-6 text-white flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Welcome back, {username}</h2>
            <p className="text-blue-200 text-sm mt-1">{streakSubtitle}</p>
          </div>
          <ExamCountdownRing
            daysUntilExam={insights?.days_until_exam ?? null}
            examDate={insights?.exam_date ?? null}
            onDateSaved={() => getDashboardInsights().then(setInsights).catch(() => {})}
          />
        </div>
      )}

      {/* Section 2: Stat Cards (5) */}
      {!loading && (
        <div data-tour="stat-cards" className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          <StatCard
            label="Study streak"
            value={`${streak}`}
            unit={`day${streak !== 1 ? "s" : ""}`}
            accent="text-orange-500"
            gradient="from-orange-400 to-amber-400"
            icon="🔥"
          />
          <StatCard
            label="Vocab mastered"
            value={`${fcStats?.mastered ?? 0}/${fcStats?.total_cards ?? 0}`}
            accent="text-green-600"
            gradient="from-green-400 to-emerald-400"
            progress={fcStats && fcStats.total_cards > 0 ? (fcStats.mastered / fcStats.total_cards) * 100 : 0}
          />
          <StatCard
            label="Due today"
            value={String(fcStats?.due_today ?? 0)}
            accent="text-blue-600"
            gradient="from-blue-400 to-indigo-400"
            onClick={() => nav("/vocab-due")}
          />
          <StatCard
            label="Review consistency"
            value={`${insights?.review_consistency_30d ?? 0}/30`}
            unit="days"
            accent="text-purple-600"
            gradient="from-purple-400 to-violet-400"
            dots={insights?.review_dates_30d}
          />
          <StatCard
            label="Planner rate"
            value={insights?.planner_completion_rate_7d != null ? `${Math.round(insights.planner_completion_rate_7d)}%` : "--"}
            accent="text-teal-600"
            gradient="from-teal-400 to-cyan-400"
          />
        </div>
      )}

      {/* Section 3: Planner Card */}
      {!loading && plannerStatus?.planner_enabled && todayPlan && (() => {
        const total = todayPlan.tasks.length;
        const done = todayPlan.tasks.filter(t => t.status === "completed").length;
        const skipped = todayPlan.tasks.filter(t => t.status === "skipped").length;
        const pending = total - done - skipped;
        const pct = total > 0 ? Math.round(done / total * 100) : 0;
        return (
          <div
            className="bg-gradient-to-r from-blue-500 to-indigo-500 rounded-2xl p-5 text-white cursor-pointer hover:shadow-lg transition"
            onClick={() => nav("/planner")}
          >
            <p className="text-sm font-medium opacity-80 mb-1">Today's Plan</p>
            <p className="text-lg font-bold">{todayPlan.focus_headline}</p>
            <div className="mt-3 bg-white/20 rounded-full h-2">
              <div className="bg-white rounded-full h-2 transition-all" style={{ width: `${pct}%` }} />
            </div>
            <div className="flex items-center gap-3 mt-2">
              <span className="text-xs opacity-70">{done}/{total} tasks ({pct}%)</span>
              <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full">{done} done</span>
              {pending > 0 && <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full">{pending} pending</span>}
              {skipped > 0 && <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full">{skipped} skipped</span>}
            </div>
          </div>
        );
      })()}

      {/* Section 4: Two-Column Insights */}
      {!loading && insights && (
        <div data-tour="skill-insights" className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SkillRadarCard snapshots={insights.skill_snapshots} />
          <WeakCategoriesCard categories={insights.vocab_categories} />
        </div>
      )}

      {/* Section 5: Training Overview */}
      {!loading && training && training.total_sessions > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Training Overview (30 days)</h3>
            {insights?.listening_trend_7d != null && (
              <span className={`text-xs font-semibold px-2 py-1 rounded-full flex items-center gap-1 ${
                insights.listening_trend_7d >= 0
                  ? "bg-green-100 text-green-700"
                  : "bg-red-100 text-red-700"
              }`}>
                {insights.listening_trend_7d >= 0 ? "↑" : "↓"}
                {Math.abs(insights.listening_trend_7d)}% (7d)
              </span>
            )}
          </div>

          {/* Summary row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
            <MiniStat value={String(training.total_sessions)} label="Sessions" />
            <MiniStat value={fmtMinutes(training.total_minutes)} label="Total time" />
            <MiniStat value={training.avg_score_quiz != null ? `${training.avg_score_quiz}%` : "--"} label="Quiz avg" accent="text-blue-600" bg="bg-blue-50" />
            <MiniStat value={training.avg_score_intensive != null ? `${training.avg_score_intensive}%` : "--"} label="Intensive avg" accent="text-amber-600" bg="bg-amber-50" />
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 mb-4 text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-blue-400 inline-block" /> Quiz ({training.quiz_sessions})
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-amber-400 inline-block" /> Intensive ({training.intensive_sessions})
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-0.5 bg-green-500 inline-block" /> Avg Score
            </span>
          </div>

          {/* Chart */}
          {dailyChart.length > 0 && (
            <ResponsiveContainer width="100%" height={180}>
              <ComposedChart data={dailyChart}>
                <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v: string) => v.slice(5)} />
                <YAxis yAxisId="mins" tick={{ fontSize: 10 }} />
                <YAxis yAxisId="score" orientation="right" domain={[0, 100]} tick={{ fontSize: 10 }} hide />
                <Tooltip formatter={(value, name) => [name === "avg_score" ? `${value}%` : `${value}m`, name === "avg_score" ? "Avg Score" : String(name)]} labelFormatter={(label) => String(label)} />
                <Bar yAxisId="mins" dataKey="quiz" stackId="a" fill="#60a5fa" name="Quiz" />
                <Bar yAxisId="mins" dataKey="intensive" stackId="a" fill="#fbbf24" radius={[2, 2, 0, 0]} name="Intensive" />
                <Line yAxisId="score" type="monotone" dataKey="avg_score" stroke="#22c55e" strokeWidth={2} dot={false} name="avg_score" />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>
      )}

      {/* Section 6: Study Consistency Heatmap */}
      {!loading && insights && (
        <ConsistencyHeatmap
          reviewDates={insights.review_dates_30d}
          activeDates={activeDates}
        />
      )}

      {/* Section 7: Two-Column — Practice Balance + Speaking Sub-scores */}
      {!loading && insights && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <PracticeBalanceCard
            skillCounts={insights.skill_practice_counts}
            mostPracticed={insights.most_practiced_skill}
            leastPracticed={insights.least_practiced_skill}
          />
          <SpeakingSubScoresCard subscores={insights.speaking_subscores} />
        </div>
      )}

      {/* Section 8: Smart Quick Actions */}
      {!loading && (
        <div data-tour="quick-actions">
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Quick Actions</h3>
          <SmartQuickActions
            dueToday={fcStats?.due_today ?? 0}
            leastPracticedSkill={insights?.least_practiced_skill ?? null}
          />
        </div>
      )}

      {/* Section 9: Recent Activity Tabs */}
      {!loading && (
        <div data-tour="recent-activity">
          <RecentActivityTabs
            listening={listening}
            speaking={speaking}
            exams={exams}
          />
        </div>
      )}

      {showTour && <OnboardingTour steps={TOUR_STEPS} onComplete={handleTourComplete} />}
    </div>
  );
}

function StatCard({
  label,
  value,
  unit,
  accent,
  gradient,
  progress,
  icon,
  dots,
  onClick,
}: {
  label: string;
  value: string;
  unit?: string;
  accent: string;
  gradient?: string;
  progress?: number;
  icon?: string;
  dots?: string[];
  onClick?: () => void;
}) {
  const today = new Date();
  // Generate last 30 days for dots
  const dotDays: boolean[] = [];
  if (dots !== undefined) {
    const dotSet = new Set(dots);
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      dotDays.push(dotSet.has(d.toISOString().slice(0, 10)));
    }
  }

  return (
    <div
      className={`bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-all duration-200 ${onClick ? "cursor-pointer" : ""}`}
      onClick={onClick}
    >
      {gradient && <div className={`h-1 bg-gradient-to-r ${gradient}`} />}
      <div className="p-4">
        <div className="flex items-baseline gap-1.5">
          {icon && <span className="text-lg">{icon}</span>}
          <span className={`text-2xl font-bold ${accent}`}>{value}</span>
          {unit && <span className="text-xs text-slate-400">{unit}</span>}
        </div>
        <p className="text-xs text-slate-500 mt-1">{label}</p>
        {progress !== undefined && (
          <div className="mt-2 h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${Math.min(progress, 100)}%` }} />
          </div>
        )}
        {dotDays.length > 0 && (
          <div className="flex gap-px mt-2 flex-wrap">
            {dotDays.map((active, i) => (
              <div key={i} className={`w-1.5 h-1.5 rounded-full ${active ? "bg-green-500" : "bg-slate-200"}`} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MiniStat({ value, label, accent, bg }: { value: string; label: string; accent?: string; bg?: string }) {
  return (
    <div className={`${bg ?? "bg-slate-50"} rounded-xl p-3 text-center`}>
      <p className={`text-xl font-bold ${accent ?? "text-slate-800"}`}>{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}
