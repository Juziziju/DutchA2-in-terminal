import { useState } from "react";
import type { ListeningHistoryItem, ExamHistoryItem, SpeakingHistoryItem } from "../../api";

interface Props {
  listening: ListeningHistoryItem[];
  speaking: SpeakingHistoryItem[];
  exams: ExamHistoryItem[];
}

function fmtMinutes(mins: number): string {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

type Tab = "listening" | "speaking" | "exams";

export default function RecentActivityTabs({ listening, speaking, exams }: Props) {
  const [tab, setTab] = useState<Tab>("listening");

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: "listening", label: "Listening", count: listening.length },
    { key: "speaking", label: "Speaking", count: speaking.length },
    { key: "exams", label: "Exams", count: exams.length },
  ];

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
      <div className="flex gap-6 border-b border-slate-200 mb-4">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`pb-2 text-sm font-medium transition-colors cursor-pointer ${
              tab === t.key
                ? "text-blue-600 border-b-2 border-blue-600"
                : "text-slate-400 hover:text-slate-600"
            }`}
          >
            {t.label} ({t.count})
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {tab === "listening" && listening.slice(0, 5).map(l => (
          <div key={l.id} className="flex justify-between items-center py-2">
            <div>
              <p className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
                {l.topic}
                {l.level && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                    l.level === "A1" ? "bg-green-100 text-green-700" :
                    l.level === "B1" ? "bg-purple-100 text-purple-700" :
                    "bg-blue-100 text-blue-700"
                  }`}>{l.level}</span>
                )}
                {l.mode === "intensive" && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">intensive</span>
                )}
              </p>
              <p className="text-xs text-slate-400">
                {l.date.split("T")[0]}
                {l.duration_seconds != null && l.duration_seconds > 0 && (
                  <span className="ml-2">{fmtMinutes(Math.round(l.duration_seconds / 60))}</span>
                )}
              </p>
            </div>
            <span className={`text-sm font-semibold ${l.score_pct >= 60 ? "text-green-600" : "text-red-500"}`}>
              {l.score_pct}%
            </span>
          </div>
        ))}

        {tab === "speaking" && speaking.slice(0, 5).map(s => (
          <div key={s.id} className="flex justify-between items-center py-2">
            <div>
              <p className="text-sm font-medium text-slate-700">{s.scene} - {s.question_type}</p>
              <p className="text-xs text-slate-400">{s.date.split("T")[0]}</p>
            </div>
            <span className={`text-sm font-semibold ${(s.score_pct ?? 0) >= 60 ? "text-green-600" : "text-red-500"}`}>
              {s.score_pct != null ? `${s.score_pct}%` : "--"}
            </span>
          </div>
        ))}

        {tab === "exams" && exams.slice(0, 5).map(e => (
          <div key={e.id} className="flex justify-between items-center py-2">
            <div>
              <p className="text-sm font-medium text-slate-700">{e.source}</p>
              <p className="text-xs text-slate-400">{e.date.split("T")[0]}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-sm font-semibold ${e.passed ? "text-green-600" : "text-red-500"}`}>
                {e.avg_score ?? 0}%
              </span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                e.passed ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
              }`}>{e.passed ? "PASS" : "FAIL"}</span>
            </div>
          </div>
        ))}

        {tab === "listening" && listening.length === 0 && <p className="text-sm text-slate-400 text-center py-4">No listening sessions yet.</p>}
        {tab === "speaking" && speaking.length === 0 && <p className="text-sm text-slate-400 text-center py-4">No speaking sessions yet.</p>}
        {tab === "exams" && exams.length === 0 && <p className="text-sm text-slate-400 text-center py-4">No exams taken yet.</p>}
      </div>
    </div>
  );
}
