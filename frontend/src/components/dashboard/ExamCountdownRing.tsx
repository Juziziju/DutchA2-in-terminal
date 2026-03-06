interface Props {
  daysUntilExam: number | null;
  examDate: string | null;
}

export default function ExamCountdownRing({ daysUntilExam, examDate }: Props) {
  if (daysUntilExam == null || examDate == null) {
    return (
      <div className="flex flex-col items-center justify-center">
        <div className="w-20 h-20 rounded-full border-4 border-dashed border-white/30 flex items-center justify-center">
          <span className="text-xs text-white/60 text-center leading-tight">No exam<br/>date set</span>
        </div>
      </div>
    );
  }

  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  // Assume 180-day prep window for progress ring
  const totalDays = 180;
  const elapsed = totalDays - daysUntilExam;
  const progress = Math.max(0, Math.min(1, elapsed / totalDays));
  const offset = circumference * (1 - progress);

  const color =
    daysUntilExam > 60 ? "stroke-green-400" :
    daysUntilExam > 30 ? "stroke-yellow-400" :
    daysUntilExam > 15 ? "stroke-orange-400" :
    "stroke-red-400";

  return (
    <div className="flex flex-col items-center justify-center">
      <svg width="88" height="88" viewBox="0 0 88 88">
        <circle cx="44" cy="44" r={radius} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="6" />
        <circle
          cx="44" cy="44" r={radius} fill="none"
          className={color}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform="rotate(-90 44 44)"
        />
        <text x="44" y="40" textAnchor="middle" className="fill-white text-xl font-bold" fontSize="22">{daysUntilExam}</text>
        <text x="44" y="56" textAnchor="middle" className="fill-white/70" fontSize="10">days left</text>
      </svg>
      <p className="text-[10px] text-white/50 mt-1">{examDate}</p>
    </div>
  );
}
