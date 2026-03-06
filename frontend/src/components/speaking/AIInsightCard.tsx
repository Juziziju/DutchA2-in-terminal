import { useEffect, useState } from "react";
import * as api from "../../api";

interface Props {
  onGenerateScene?: (topic: string) => void;
}

export default function AIInsightCard({ onGenerateScene }: Props) {
  const [insight, setInsight] = useState<api.SpeakingAIInsight | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api.getSpeakingAIInsight();
        if (!cancelled) setInsight(data);
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load AI insight");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl border border-slate-700 p-5">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">🤖</span>
        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide">AI Insight</h3>
      </div>

      {loading ? (
        <div className="space-y-3 animate-pulse">
          <div className="h-4 bg-slate-700 rounded w-3/4" />
          <div className="h-4 bg-slate-700 rounded w-full" />
          <div className="h-4 bg-slate-700 rounded w-2/3" />
        </div>
      ) : error ? (
        <p className="text-sm text-red-400">{error}</p>
      ) : insight ? (
        <div className="space-y-3">
          <p className="text-sm text-slate-300 leading-relaxed">{insight.summary}</p>

          {insight.patterns.length > 0 && (
            <div>
              <div className="text-xs text-slate-500 font-medium mb-1">Patterns observed:</div>
              <ul className="space-y-1">
                {insight.patterns.map((p, i) => (
                  <li key={i} className="text-xs text-slate-400 flex gap-1.5">
                    <span className="text-slate-600">-</span> {p}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {insight.focus_areas.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {insight.focus_areas.map((area, i) => (
                <span key={i} className="text-[10px] px-2 py-1 rounded-full bg-blue-500/20 text-blue-300 font-medium">
                  {area}
                </span>
              ))}
            </div>
          )}

          {insight.suggested_scene_topic && onGenerateScene && (
            <button
              onClick={() => onGenerateScene(insight.suggested_scene_topic!)}
              className="w-full mt-2 text-sm py-2 rounded-lg bg-blue-600/20 text-blue-300 hover:bg-blue-600/30 transition-colors font-medium"
            >
              Generate Practice Scene &rarr;
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}
