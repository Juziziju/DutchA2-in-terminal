import { useState } from "react";
import type { SpeakingHistoryItem } from "../../api";

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function modePill(mode: string) {
  const labels: Record<string, string> = {
    scene_drill: "Practice",
    mixed_drill: "Practice",
    mock_exam: "Exam",
    shadow_reading: "Shadow",
  };
  const colors: Record<string, string> = {
    scene_drill: "bg-blue-500/20 text-blue-300",
    mixed_drill: "bg-blue-500/20 text-blue-300",
    mock_exam: "bg-purple-500/20 text-purple-300",
    shadow_reading: "bg-amber-500/20 text-amber-300",
  };
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${colors[mode] ?? "bg-slate-600 text-slate-300"}`}>
      {labels[mode] ?? mode}
    </span>
  );
}

function scoreBadge(score: number | null, isShadow: boolean) {
  if (score === null) return <span className="text-slate-500">--</span>;
  const color = score >= 70 ? "text-green-400" : score >= 50 ? "text-blue-400" : "text-red-400";
  return (
    <span className={`text-lg font-bold ${color}`}>
      {score}%{isShadow ? "" : ""}
    </span>
  );
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  const color = value >= 70 ? "bg-green-500" : value >= 50 ? "bg-blue-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-24 text-slate-400">{label}</span>
      <div className="flex-1 bg-slate-700 rounded-full h-2">
        <div className={`${color} rounded-full h-2 transition-all`} style={{ width: `${value}%` }} />
      </div>
      <span className="w-8 text-right text-slate-300">{value}</span>
    </div>
  );
}

export default function HistoryCard({ item }: { item: SpeakingHistoryItem }) {
  const [expanded, setExpanded] = useState(false);
  const isShadow = item.mode === "shadow_reading";
  const fb = item.feedback;

  // Prettify scene name: strip "custom_1_..." prefix
  const sceneName = item.scene.startsWith("custom_")
    ? item.scene.replace(/^custom_\d+_\d+$/, "Custom Scene")
    : item.scene.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-slate-750 transition-colors"
      >
        {scoreBadge(item.score_pct, isShadow)}
        <div className="flex-1 min-w-0">
          <div className="text-white font-medium text-sm truncate">{sceneName}</div>
          <div className="text-xs text-slate-500">{timeAgo(item.date)}</div>
        </div>
        {modePill(item.mode)}
        <svg
          className={`w-4 h-4 text-slate-500 transition-transform ${expanded ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-slate-700 pt-3 space-y-3">
          {isShadow ? (
            // Shadow reading expanded view
            <>
              {fb && (
                <>
                  <div className="text-xs text-slate-400">
                    <span className="text-slate-500">Original: </span>
                    {(fb as any).original_sentence ?? item.question_id}
                  </div>
                  <div className="text-xs text-slate-400">
                    <span className="text-slate-500">Your transcript: </span>
                    {item.transcript ?? "(none)"}
                  </div>
                  {(fb as any).word_matches?.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {(fb as any).word_matches.map((w: string, i: number) => (
                        <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/20 text-green-300">{w}</span>
                      ))}
                      {(fb as any).word_misses?.map((w: string, i: number) => (
                        <span key={`m${i}`} className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-300">{w}</span>
                      ))}
                    </div>
                  )}
                  {(fb as any).feedback && (
                    <p className="text-xs text-slate-400 italic">{(fb as any).feedback}</p>
                  )}
                </>
              )}
            </>
          ) : (
            // Regular session expanded view
            <>
              {item.transcript && (
                <div className="text-xs text-slate-400">
                  <span className="text-slate-500">Transcript: </span>
                  {item.transcript}
                </div>
              )}
              {fb && "vocabulary_score" in fb && (
                <div className="space-y-1.5">
                  <ScoreBar label="Vocabulary" value={fb.vocabulary_score} />
                  <ScoreBar label="Grammar" value={fb.grammar_score} />
                  <ScoreBar label="Completeness" value={fb.completeness_score} />
                </div>
              )}
              {fb && (fb as any).grammar_errors?.length > 0 && (
                <div className="space-y-1">
                  <div className="text-xs text-slate-500 font-medium">Grammar errors:</div>
                  {(fb as any).grammar_errors.map((ge: any, i: number) => (
                    <div key={i} className="text-xs text-slate-400">
                      <span className="line-through text-red-400">{ge.error}</span>
                      {" -> "}
                      <span className="text-green-400">{ge.correction}</span>
                    </div>
                  ))}
                </div>
              )}
              {fb && (fb as any).improved_answer && (
                <div className="text-xs text-slate-400">
                  <span className="text-slate-500">Improved: </span>
                  {(fb as any).improved_answer}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
