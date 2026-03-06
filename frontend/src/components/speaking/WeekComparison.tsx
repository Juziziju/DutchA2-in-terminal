import type { WeekComparison as WeekComparisonData, WeakAreas } from "../../api";

interface Props {
  comparison: WeekComparisonData;
  weakAreas: WeakAreas;
}

function DeltaArrow({ delta }: { delta: number | null }) {
  if (delta === null) return null;
  if (delta > 0) return <span className="text-green-400 text-sm font-medium">+{delta}%</span>;
  if (delta < 0) return <span className="text-red-400 text-sm font-medium">{delta}%</span>;
  return <span className="text-slate-400 text-sm">+0%</span>;
}

function MiniBar({ label, value }: { label: string; value: number | null }) {
  if (value === null) return null;
  const color = value >= 70 ? "bg-green-500" : value >= 50 ? "bg-blue-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-24 text-slate-400">{label}</span>
      <div className="flex-1 bg-slate-700 rounded-full h-1.5">
        <div className={`${color} rounded-full h-1.5`} style={{ width: `${value}%` }} />
      </div>
      <span className="w-8 text-right text-slate-300">{value}</span>
    </div>
  );
}

export default function WeekComparisonCard({ comparison, weakAreas }: Props) {
  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
      <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-3">This Week vs Last Week</h3>
      <div className="flex items-center gap-3 mb-4">
        <div className="text-center">
          <div className="text-2xl font-bold text-slate-300">
            {comparison.last_week_avg ?? "--"}%
          </div>
          <div className="text-[10px] text-slate-500">Last week</div>
        </div>
        <div className="text-slate-500 text-lg">&rarr;</div>
        <div className="text-center">
          <div className="text-2xl font-bold text-white">
            {comparison.this_week_avg ?? "--"}%
          </div>
          <div className="text-[10px] text-slate-500">This week</div>
        </div>
        <DeltaArrow delta={comparison.delta} />
      </div>
      <div className="space-y-2">
        <MiniBar label="Vocabulary" value={weakAreas.vocab_avg} />
        <MiniBar label="Grammar" value={weakAreas.grammar_avg} />
        <MiniBar label="Completeness" value={weakAreas.completeness_avg} />
      </div>
    </div>
  );
}
