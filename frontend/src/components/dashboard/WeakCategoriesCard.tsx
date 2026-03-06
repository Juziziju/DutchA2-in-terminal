import type { VocabCategoryItem } from "../../api";

interface Props {
  categories: VocabCategoryItem[];
}

export default function WeakCategoriesCard({ categories }: Props) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">Weakest Vocab Categories</h3>
      {categories.length === 0 ? (
        <p className="text-sm text-slate-400 py-8 text-center">Import vocab to see categories.</p>
      ) : (
        <div className="space-y-3">
          {categories.map(c => {
            const pct = c.total > 0 ? Math.round((c.mastered / c.total) * 100) : 0;
            const barColor = pct < 30 ? "bg-red-400" : pct < 60 ? "bg-yellow-400" : "bg-green-400";
            return (
              <div key={c.category}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-slate-700 font-medium truncate">{c.category}</span>
                  <span className="text-slate-500 text-xs">{c.mastered}/{c.total}</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${barColor} transition-all`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
