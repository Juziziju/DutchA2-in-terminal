import type { WritingStats } from "../../api";

const TASK_LABELS: Record<string, string> = {
  email: "Email",
  kort_verhaal: "Kort verhaal",
  formulier: "Formulier",
  briefje: "Briefje",
  error_correction: "Error Correction",
  spell_practice: "Translation",
};

function barColor(score: number) {
  if (score >= 80) return "bg-green-500";
  if (score >= 60) return "bg-yellow-500";
  return "bg-red-500";
}

export default function WritingScoresCard({ stats }: { stats: WritingStats }) {
  const entries = Object.entries(stats.per_task_type).sort((a, b) => b[1] - a[1]);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">
        Writing (30 days)
      </h3>

      {/* Big average */}
      <div className="text-center mb-4">
        <p className={`text-4xl font-bold ${
          (stats.avg_score ?? 0) >= 80 ? "text-green-600" :
          (stats.avg_score ?? 0) >= 60 ? "text-yellow-600" : "text-red-600"
        }`}>
          {stats.avg_score != null ? `${stats.avg_score}%` : "--"}
        </p>
        <p className="text-xs text-slate-400 mt-1">{stats.total_sessions} sessions</p>
      </div>

      {/* Per task type bars */}
      <div className="space-y-2">
        {entries.map(([tt, score]) => (
          <div key={tt} className="flex items-center gap-2">
            <span className="text-xs text-slate-500 w-28 text-right truncate">
              {TASK_LABELS[tt] || tt}
            </span>
            <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${barColor(score)}`}
                style={{ width: `${Math.min(score, 100)}%` }}
              />
            </div>
            <span className="text-xs font-semibold text-slate-700 w-10 text-right">
              {Math.round(score)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
