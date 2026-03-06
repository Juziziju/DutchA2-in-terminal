import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

interface Props {
  skillCounts: Record<string, number>;
  mostPracticed: string | null;
  leastPracticed: string | null;
}

export default function PracticeBalanceCard({ skillCounts, mostPracticed, leastPracticed }: Props) {
  const data = Object.entries(skillCounts)
    .map(([skill, count]) => ({ skill, count }))
    .sort((a, b) => b.count - a.count);

  if (data.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">Practice Balance</h3>
        <p className="text-sm text-slate-400 py-4 text-center">No practice data yet.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">Practice Balance (30d)</h3>
      <ResponsiveContainer width="100%" height={data.length * 36 + 20}>
        <BarChart data={data} layout="vertical" margin={{ left: 10, right: 20, top: 0, bottom: 0 }}>
          <XAxis type="number" tick={{ fontSize: 10 }} />
          <YAxis type="category" dataKey="skill" tick={{ fontSize: 11 }} width={90} />
          <Tooltip formatter={(v) => [`${v} sessions`]} />
          <Bar dataKey="count" fill="#6366f1" radius={[0, 4, 4, 0]} barSize={18} />
        </BarChart>
      </ResponsiveContainer>
      <div className="flex gap-3 mt-3 text-xs">
        {mostPracticed && (
          <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Most: {mostPracticed}</span>
        )}
        {leastPracticed && leastPracticed !== mostPracticed && (
          <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded-full">Least: {leastPracticed}</span>
        )}
      </div>
    </div>
  );
}
