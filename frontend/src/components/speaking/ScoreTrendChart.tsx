import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import type { WeeklyTrend } from "../../api";

interface Props {
  trends: WeeklyTrend[];
}

export default function ScoreTrendChart({ trends }: Props) {
  const data = trends.map((t) => ({
    week: new Date(t.week).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    Overall: t.avg_score,
    Vocab: t.avg_vocab,
    Grammar: t.avg_grammar,
    Completeness: t.avg_completeness,
  }));

  const hasData = trends.some((t) => t.avg_score !== null);

  if (!hasData) {
    return (
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-2">Score Trend</h3>
        <p className="text-sm text-slate-500 py-8 text-center">Not enough data yet. Keep practicing!</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
      <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-3">Score Trend (12 weeks)</h3>
      <ResponsiveContainer width="100%" height={250}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis dataKey="week" tick={{ fontSize: 10, fill: "#94a3b8" }} />
          <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "#94a3b8" }} />
          <Tooltip
            contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: 8 }}
            labelStyle={{ color: "#94a3b8" }}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Line type="monotone" dataKey="Overall" stroke="#3b82f6" strokeWidth={2.5} dot={false} connectNulls />
          <Line type="monotone" dataKey="Vocab" stroke="#22c55e" strokeWidth={1.5} strokeDasharray="4 4" dot={false} connectNulls />
          <Line type="monotone" dataKey="Grammar" stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="4 4" dot={false} connectNulls />
          <Line type="monotone" dataKey="Completeness" stroke="#a78bfa" strokeWidth={1.5} strokeDasharray="4 4" dot={false} connectNulls />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
