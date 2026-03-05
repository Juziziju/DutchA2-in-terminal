interface Props {
  score: number;
  total: number;
  scorePct: number;
  passThreshold?: number;
  label?: string;
}

export default function ScoreCard({
  score,
  total,
  scorePct,
  passThreshold = 60,
  label = "Score",
}: Props) {
  const passed = scorePct >= passThreshold;
  return (
    <div
      className={`rounded-xl p-6 text-center shadow ${
        passed ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"
      }`}
    >
      <p className="text-sm text-slate-500 mb-1">{label}</p>
      <p className="text-4xl font-bold mb-1">
        {score}/{total}
      </p>
      <p className={`text-2xl font-semibold ${passed ? "text-green-600" : "text-red-500"}`}>
        {scorePct}% — {passed ? "PASS" : "FAIL"}
      </p>
    </div>
  );
}
