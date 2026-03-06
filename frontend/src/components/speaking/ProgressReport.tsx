import { useEffect, useState } from "react";
import * as api from "../../api";
import ScoreTrendChart from "./ScoreTrendChart";
import SubScoreRadar from "./SubScoreRadar";
import WeekComparisonCard from "./WeekComparison";
import MissedWordsList from "./MissedWordsList";
import GrammarPatterns from "./GrammarPatterns";
import AIInsightCard from "./AIInsightCard";

interface Props {
  onBack: () => void;
  onGenerateScene?: (topic: string) => void;
}

export default function ProgressReport({ onBack, onGenerateScene }: Props) {
  const [data, setData] = useState<api.SpeakingProgressData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const d = await api.getSpeakingProgress();
        if (!cancelled) setData(d);
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load progress");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <button onClick={onBack} className="text-blue-400 hover:text-blue-300 text-sm mb-4">&larr; Back</button>
        <div className="text-center py-12">
          <div className="inline-block w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-500 mt-2 text-sm">Loading progress data...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <button onClick={onBack} className="text-blue-400 hover:text-blue-300 text-sm mb-4">&larr; Back</button>
        <p className="text-red-400">{error ?? "No data available"}</p>
      </div>
    );
  }

  // Mode stats summary
  const modeEntries = Object.entries(data.mode_stats.by_mode);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <button onClick={onBack} className="text-blue-400 hover:text-blue-300 text-sm mb-4">&larr; Back</button>

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Speaking Progress</h1>
          <p className="text-sm text-slate-500">{data.total_sessions} total sessions</p>
        </div>
        {data.comparison.delta !== null && (
          <div className={`text-sm font-medium px-3 py-1 rounded-full ${
            data.comparison.delta > 0
              ? "bg-green-500/20 text-green-400"
              : data.comparison.delta < 0
              ? "bg-red-500/20 text-red-400"
              : "bg-slate-700 text-slate-400"
          }`}>
            {data.comparison.delta > 0 ? "+" : ""}{data.comparison.delta}% vs last week
          </div>
        )}
      </div>

      {/* Score Trend */}
      <div className="mb-4">
        <ScoreTrendChart trends={data.weekly_trends} />
      </div>

      {/* Radar + Week Comparison (side by side on desktop) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <SubScoreRadar weakAreas={data.weak_areas} />
        <WeekComparisonCard comparison={data.comparison} weakAreas={data.weak_areas} />
      </div>

      {/* Missed Words + Grammar Patterns */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <MissedWordsList words={data.missed_words} />
        <GrammarPatterns patterns={data.grammar_patterns} />
      </div>

      {/* Session Stats */}
      {modeEntries.length > 0 && (
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-5 mb-4">
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-3">Session Stats</h3>
          <div className="flex flex-wrap gap-3">
            {modeEntries.map(([mode, count]) => {
              const labels: Record<string, string> = {
                scene_drill: "Practice",
                mixed_drill: "Mixed",
                mock_exam: "Exam",
                shadow_reading: "Shadow",
              };
              return (
                <span key={mode} className="text-sm text-slate-300">
                  <span className="font-medium">{count}</span>{" "}
                  <span className="text-slate-500">{labels[mode] ?? mode}</span>
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* AI Insight (loads async) */}
      <AIInsightCard onGenerateScene={onGenerateScene} />
    </div>
  );
}
