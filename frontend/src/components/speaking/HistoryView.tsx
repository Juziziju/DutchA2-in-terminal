import { useCallback, useEffect, useRef, useState } from "react";
import * as api from "../../api";
import HistoryCard from "./HistoryCard";

type ModeFilter = "all" | "scene_drill" | "shadow_reading" | "mock_exam";

function dateGroup(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const weekAgo = new Date(today.getTime() - 7 * 86400000);
  const monthAgo = new Date(today.getTime() - 30 * 86400000);

  if (d >= today) return "Today";
  if (d >= yesterday) return "Yesterday";
  if (d >= weekAgo) return "This Week";
  if (d >= monthAgo) return "This Month";
  return "Older";
}

const MODE_FILTERS: { key: ModeFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "scene_drill", label: "Practice" },
  { key: "shadow_reading", label: "Shadow" },
  { key: "mock_exam", label: "Exam" },
];

export default function HistoryView({ onBack }: { onBack: () => void }) {
  const [items, setItems] = useState<api.SpeakingHistoryItem[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [modeFilter, setModeFilter] = useState<ModeFilter>("all");
  const sentinelRef = useRef<HTMLDivElement>(null);

  const fetchPage = useCallback(async (p: number, mode: ModeFilter, append: boolean) => {
    setLoading(true);
    try {
      const modeParam = mode === "all" ? undefined : mode;
      const data = await api.getSpeakingHistoryPaged(p, 20, modeParam);
      setItems(prev => append ? [...prev, ...data.items] : data.items);
      setHasMore(p < data.pages);
      setPage(p);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  // Reset on filter change
  useEffect(() => {
    setItems([]);
    setPage(1);
    setHasMore(true);
    fetchPage(1, modeFilter, false);
  }, [modeFilter, fetchPage]);

  // Infinite scroll
  useEffect(() => {
    if (!sentinelRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          fetchPage(page + 1, modeFilter, true);
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, loading, page, modeFilter, fetchPage]);

  // Group items by date
  const groups: { label: string; items: api.SpeakingHistoryItem[] }[] = [];
  let currentGroup = "";
  for (const item of items) {
    const group = dateGroup(item.date);
    if (group !== currentGroup) {
      groups.push({ label: group, items: [] });
      currentGroup = group;
    }
    groups[groups.length - 1].items.push(item);
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <button onClick={onBack} className="text-blue-400 hover:text-blue-300 text-sm mb-4">
        &larr; Back
      </button>
      <h1 className="text-2xl font-bold text-slate-800 mb-4">Speaking History</h1>

      {/* Filter bar */}
      <div className="flex gap-2 mb-4">
        {MODE_FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setModeFilter(f.key)}
            className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
              modeFilter === f.key
                ? "bg-blue-600 text-white"
                : "bg-slate-700 text-slate-300 hover:bg-slate-600"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {items.length === 0 && !loading ? (
        <p className="text-slate-500">No recordings yet. Start a practice session!</p>
      ) : (
        <div className="space-y-4">
          {groups.map((group) => (
            <div key={group.label}>
              <div className="sticky top-0 z-10 bg-slate-900/80 backdrop-blur-sm py-1 mb-2">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  {group.label}
                </span>
              </div>
              <div className="space-y-2">
                {group.items.map((item) => (
                  <HistoryCard key={item.id} item={item} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Sentinel for infinite scroll */}
      <div ref={sentinelRef} className="h-4" />
      {loading && (
        <div className="text-center py-4">
          <div className="inline-block w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}
