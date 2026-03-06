import { useState } from "react";
import { updatePlannerProfile } from "../../api";

interface Props {
  daysUntilExam: number | null;
  examDate: string | null;
  onDateSaved?: (newDate: string) => void;
}

export default function ExamCountdownRing({ daysUntilExam, examDate, onDateSaved }: Props) {
  const [editing, setEditing] = useState(false);
  const [dateValue, setDateValue] = useState(examDate ?? "");
  const [saving, setSaving] = useState(false);

  const today = new Date().toISOString().slice(0, 10);

  async function handleSave() {
    if (!dateValue) return;
    setSaving(true);
    try {
      await updatePlannerProfile({ exam_date: dateValue } as any);
      onDateSaved?.(dateValue);
      setEditing(false);
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <div className="flex flex-col items-center gap-2">
        <input
          type="date"
          min={today}
          value={dateValue}
          onChange={(e) => setDateValue(e.target.value)}
          className="bg-white/20 text-white border border-white/30 rounded px-2 py-1 text-sm [color-scheme:dark]"
        />
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={!dateValue || saving}
            className="text-xs bg-white/20 hover:bg-white/30 text-white px-3 py-1 rounded transition disabled:opacity-50"
          >
            {saving ? "..." : "Save"}
          </button>
          <button
            onClick={() => setEditing(false)}
            className="text-xs text-white/60 hover:text-white/80 px-2 py-1 transition"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (daysUntilExam == null || examDate == null) {
    return (
      <div className="flex flex-col items-center justify-center">
        <button
          onClick={() => { setDateValue(""); setEditing(true); }}
          className="w-20 h-20 rounded-full border-4 border-dashed border-white/30 flex items-center justify-center hover:border-white/50 transition cursor-pointer"
        >
          <span className="text-xs text-white/60 text-center leading-tight">No exam<br/>date set</span>
        </button>
      </div>
    );
  }

  const radius = 36;
  const circumference = 2 * Math.PI * radius;
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
      <button
        onClick={() => { setDateValue(examDate); setEditing(true); }}
        className="text-[10px] text-white/40 hover:text-white/70 transition mt-0.5"
      >
        edit
      </button>
    </div>
  );
}
