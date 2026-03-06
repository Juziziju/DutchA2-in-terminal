import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer,
} from "recharts";
import type { WeakAreas } from "../../api";

interface Props {
  weakAreas: WeakAreas;
}

export default function SubScoreRadar({ weakAreas }: Props) {
  const data = [
    { axis: "Vocabulary", score: weakAreas.vocab_avg ?? 0 },
    { axis: "Grammar", score: weakAreas.grammar_avg ?? 0 },
    { axis: "Completeness", score: weakAreas.completeness_avg ?? 0 },
  ];

  const hasData = data.some((d) => d.score > 0);

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
      <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-2">Sub-Score Radar</h3>
      {!hasData ? (
        <p className="text-sm text-slate-500 py-8 text-center">No sub-score data yet.</p>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <RadarChart data={data} cx="50%" cy="50%" outerRadius="70%">
            <PolarGrid stroke="#334155" />
            <PolarAngleAxis dataKey="axis" tick={{ fontSize: 11, fill: "#94a3b8" }} />
            <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 9, fill: "#64748b" }} />
            <Radar dataKey="score" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.2} strokeWidth={2} />
          </RadarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
