interface Props {
  subscores: Record<string, number | null>;
}

const LABELS: Record<string, string> = {
  vocabulary: "Vocabulary",
  grammar: "Grammar",
  completeness: "Completeness",
};

export default function SpeakingSubScoresCard({ subscores }: Props) {
  const entries = Object.entries(LABELS);
  const hasAny = entries.some(([k]) => subscores[k] != null);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">Speaking Sub-scores</h3>
      {!hasAny ? (
        <p className="text-sm text-slate-400 py-4 text-center">No data yet</p>
      ) : (
        <div className="space-y-3">
          {entries.map(([key, label]) => {
            const val = subscores[key];
            if (val == null) {
              return (
                <div key={key}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-700 font-medium">{label}</span>
                    <span className="text-slate-400 text-xs">--</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full" />
                </div>
              );
            }
            const color = val > 75 ? "bg-green-500" : val > 50 ? "bg-yellow-400" : "bg-red-400";
            return (
              <div key={key}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-slate-700 font-medium">{label}</span>
                  <span className="text-slate-500 text-xs font-semibold">{val}%</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${val}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
