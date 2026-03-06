import type { GrammarPattern } from "../../api";

interface Props {
  patterns: GrammarPattern[];
}

export default function GrammarPatterns({ patterns }: Props) {
  if (patterns.length === 0) {
    return (
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-2">Grammar Patterns</h3>
        <p className="text-sm text-slate-500 py-4 text-center">No grammar errors recorded yet.</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
      <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-3">Grammar Patterns</h3>
      <div className="space-y-2.5">
        {patterns.map((p, i) => (
          <div key={i} className="flex items-start gap-2 bg-slate-900/50 rounded-lg p-2.5">
            <div className="flex-1 min-w-0">
              <div className="text-xs">
                <span className="line-through text-red-400">{p.error}</span>
              </div>
              <div className="text-xs">
                <span className="text-green-400">{p.correction}</span>
              </div>
            </div>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-700 text-slate-300 font-medium shrink-0">
              {p.count}x
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
