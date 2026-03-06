interface Props {
  reviewDates: string[];
  activeDates: string[];
}

export default function ConsistencyHeatmap({ reviewDates, activeDates }: Props) {
  const allActive = new Set([...reviewDates, ...activeDates]);
  const today = new Date();
  const days: { date: string; level: number }[] = [];

  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const iso = d.toISOString().slice(0, 10);
    const inReview = reviewDates.includes(iso);
    const inActive = allActive.has(iso);
    // 0=none, 1=light, 2=medium, 3=strong
    const level = inReview && inActive ? 3 : inReview ? 2 : inActive ? 1 : 0;
    days.push({ date: iso, level });
  }

  const activeDayCount = days.filter(d => d.level > 0).length;
  const colors = ["bg-slate-100", "bg-green-200", "bg-green-400", "bg-green-600"];

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">Study Consistency (30 days)</h3>
      <div className="flex gap-1.5 flex-wrap">
        {days.map(d => (
          <div
            key={d.date}
            className={`w-6 h-6 rounded-sm ${colors[d.level]} transition-colors`}
            title={`${d.date}: ${d.level > 0 ? "Active" : "No activity"}`}
          />
        ))}
      </div>
      <p className="text-xs text-slate-400 mt-3">{activeDayCount} active days in the last 30</p>
    </div>
  );
}
