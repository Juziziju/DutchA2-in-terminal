import { useEffect, useMemo, useState } from "react";
import { VocabLevel, VocabNoteItem, VocabNotebookOut, getVocabNotebook, vocabAudioUrl } from "../api";
import { useAudioPlay } from "../components/AudioPlayer";

const LEVELS: { key: VocabLevel; label: string; color: string; dot: string }[] = [
  { key: "new",      label: "New",      color: "bg-slate-100 text-slate-600 border-slate-200", dot: "bg-slate-400" },
  { key: "hard",     label: "Hard",     color: "bg-red-50 text-red-700 border-red-200",        dot: "bg-red-500" },
  { key: "learning", label: "Learning", color: "bg-amber-50 text-amber-700 border-amber-200",  dot: "bg-amber-500" },
  { key: "familiar", label: "Familiar", color: "bg-blue-50 text-blue-700 border-blue-200",     dot: "bg-blue-500" },
  { key: "mastered", label: "Mastered", color: "bg-green-50 text-green-700 border-green-200",   dot: "bg-green-500" },
];

function LevelBadge({ level }: { level: VocabLevel }) {
  const cfg = LEVELS.find((l) => l.key === level)!;
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${cfg.color}`}>
      {cfg.label}
    </span>
  );
}

function PlayButton({ audioFile }: { audioFile: string }) {
  const src = audioFile ? vocabAudioUrl(audioFile) : null;
  const play = useAudioPlay(src);
  if (!src) return null;
  return (
    <button
      onClick={(e) => { e.stopPropagation(); play(); }}
      className="text-blue-500 hover:text-blue-700 flex-shrink-0"
      title="Play audio"
    >
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
        <path d="M6.3 2.84A1.5 1.5 0 004 4.11v11.78a1.5 1.5 0 002.3 1.27l9.344-5.891a1.5 1.5 0 000-2.538L6.3 2.841z" />
      </svg>
    </button>
  );
}

export default function VocabNotebook() {
  const [data, setData] = useState<VocabNotebookOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<VocabLevel | "all">("all");
  const [showTranslation, setShowTranslation] = useState(false);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"alpha" | "level">("level");

  useEffect(() => {
    getVocabNotebook()
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    if (!data) return [];
    let items = data.items;
    if (filter !== "all") items = items.filter((w) => w.level === filter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      items = items.filter(
        (w) => w.dutch.toLowerCase().includes(q) || w.english.toLowerCase().includes(q) || w.category.toLowerCase().includes(q),
      );
    }
    if (sortBy === "alpha") {
      items = [...items].sort((a, b) => a.dutch.localeCompare(b.dutch));
    } else {
      const order: Record<VocabLevel, number> = { hard: 0, learning: 1, new: 2, familiar: 3, mastered: 4 };
      items = [...items].sort((a, b) => order[a.level] - order[b.level] || a.dutch.localeCompare(b.dutch));
    }
    return items;
  }, [data, filter, search, sortBy]);

  if (loading) {
    return <div className="flex items-center justify-center py-16 text-slate-500">Loading vocabulary...</div>;
  }

  if (!data) {
    return <div className="flex items-center justify-center py-16 text-slate-500">Failed to load vocabulary.</div>;
  }

  const total = data.items.length;

  return (
    <div className="max-w-4xl mx-auto">
      {/* Stats bar */}
      <div className="flex flex-wrap gap-2 mb-5">
        <button
          onClick={() => setFilter("all")}
          className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
            filter === "all"
              ? "bg-slate-800 text-white border-slate-800"
              : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
          }`}
        >
          All ({total})
        </button>
        {LEVELS.map((l) => (
          <button
            key={l.key}
            onClick={() => setFilter(filter === l.key ? "all" : l.key)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors flex items-center gap-1.5 ${
              filter === l.key
                ? "bg-slate-800 text-white border-slate-800"
                : `${l.color} hover:opacity-80`
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${filter === l.key ? "bg-white" : l.dot}`} />
            {l.label} ({data.counts[l.key] ?? 0})
          </button>
        ))}
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search Dutch or English..."
          className="flex-1 border border-slate-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
        />
        <div className="flex gap-2">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as "alpha" | "level")}
            className="border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            <option value="level">Sort by level</option>
            <option value="alpha">Sort A-Z</option>
          </select>
          <button
            onClick={() => setShowTranslation(!showTranslation)}
            className={`px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${
              showTranslation
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-slate-600 border-slate-200 hover:border-blue-400"
            }`}
          >
            {showTranslation ? "Hide EN" : "Show EN"}
          </button>
        </div>
      </div>

      {/* Word count */}
      <p className="text-xs text-slate-400 mb-3">{filtered.length} word{filtered.length !== 1 ? "s" : ""}</p>

      {/* Vocab list */}
      <div className="space-y-1.5">
        {filtered.map((w) => (
          <VocabRow key={w.vocab_id} word={w} showTranslation={showTranslation} />
        ))}
        {filtered.length === 0 && (
          <p className="text-center text-slate-400 py-8">No words match your filter.</p>
        )}
      </div>
    </div>
  );
}

function VocabRow({ word: w, showTranslation }: { word: VocabNoteItem; showTranslation: boolean }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className="bg-white rounded-xl border border-slate-200/60 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-center gap-3 px-4 py-3">
        <PlayButton audioFile={w.audio_file} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-800 truncate">{w.dutch}</span>
            <span className="text-xs text-slate-400">{w.category}</span>
          </div>
          {showTranslation && (
            <p className="text-sm text-slate-500 truncate">{w.english}</p>
          )}
        </div>
        <LevelBadge level={w.level} />
      </div>

      {expanded && (
        <div className="px-4 pb-3 pt-0 border-t border-slate-100 space-y-1.5">
          <div className="flex gap-4 text-sm">
            <span className="text-slate-500">English:</span>
            <span className="text-slate-800">{w.english}</span>
          </div>
          {w.example_dutch && (
            <div className="text-sm">
              <span className="text-slate-500">Example: </span>
              <span className="text-slate-700 italic">{w.example_dutch}</span>
            </div>
          )}
          {w.example_english && (
            <p className="text-xs text-slate-400 italic">{w.example_english}</p>
          )}
          {w.next_review && (
            <p className="text-xs text-slate-400">
              Next review: {w.next_review} · Interval: {w.interval}d · EF: {w.ease_factor}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
