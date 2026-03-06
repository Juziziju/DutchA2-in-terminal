import type { MissedWord } from "../../api";

interface Props {
  words: MissedWord[];
}

export default function MissedWordsList({ words }: Props) {
  if (words.length === 0) {
    return (
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-2">Most Missed Words</h3>
        <p className="text-sm text-slate-500 py-4 text-center">No missed words recorded yet.</p>
      </div>
    );
  }

  const maxCount = words[0]?.count ?? 1;

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
      <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-3">Most Missed Words</h3>
      <div className="space-y-2">
        {words.slice(0, 10).map((w, i) => {
          const intensity = Math.min(1, w.count / maxCount);
          return (
            <div key={i} className="flex items-center gap-2">
              <span className="text-xs text-slate-500 w-5 text-right">{i + 1}.</span>
              <span className="text-sm text-white flex-1">{w.phrase}</span>
              <span
                className="text-xs px-2 py-0.5 rounded-full font-medium"
                style={{
                  backgroundColor: `rgba(239, 68, 68, ${0.15 + intensity * 0.3})`,
                  color: `rgb(${180 + intensity * 75}, ${100 - intensity * 40}, ${100 - intensity * 40})`,
                }}
              >
                {w.count}x
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
