import { useEffect, useMemo, useState } from "react";
import {
  PersonalVocabItem,
  Rating,
  VocabLevel,
  VocabNoteItem,
  VocabNotebookOut,
  deletePersonalVocab,
  getPersonalVocab,
  getPersonalVocabSession,
  getVocabNotebook,
  reviewPersonalVocab,
  updatePersonalVocab,
  vocabAudioUrl,
} from "../api";
import { useAudioPlay } from "../components/AudioPlayer";

type NotebookTab = "course" | "personal";

// ── Shared constants ────────────────────────────────────────────────────────

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

// ── Main component ──────────────────────────────────────────────────────────

export default function VocabNotebook() {
  const [tab, setTab] = useState<NotebookTab>("course");

  return (
    <div className="max-w-4xl mx-auto">
      {/* Tab bar */}
      <div className="flex rounded-lg overflow-hidden border border-slate-200 mb-6">
        {([
          { key: "course" as const, label: "Course Vocab" },
          { key: "personal" as const, label: "Personal Vocab" },
        ]).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 py-2.5 text-sm font-medium ${
              tab === t.key
                ? "bg-blue-600 text-white"
                : "bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "course" && <CourseVocabTab />}
      {tab === "personal" && <PersonalVocabTab />}
    </div>
  );
}

// ── Course Vocab Tab ────────────────────────────────────────────────────────

function CourseVocabTab() {
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

  if (loading) return <div className="flex items-center justify-center py-16 text-slate-500">Loading vocabulary...</div>;
  if (!data) return <div className="flex items-center justify-center py-16 text-slate-500">Failed to load vocabulary.</div>;

  const total = data.items.length;

  return (
    <>
      {/* Stats bar */}
      <div className="flex flex-wrap gap-2 mb-5">
        <button
          onClick={() => setFilter("all")}
          className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
            filter === "all" ? "bg-slate-800 text-white border-slate-800" : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
          }`}
        >
          All ({total})
        </button>
        {LEVELS.map((l) => (
          <button
            key={l.key}
            onClick={() => setFilter(filter === l.key ? "all" : l.key)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors flex items-center gap-1.5 ${
              filter === l.key ? "bg-slate-800 text-white border-slate-800" : `${l.color} hover:opacity-80`
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
              showTranslation ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-600 border-slate-200 hover:border-blue-400"
            }`}
          >
            {showTranslation ? "Hide EN" : "Show EN"}
          </button>
        </div>
      </div>

      <p className="text-xs text-slate-400 mb-3">{filtered.length} word{filtered.length !== 1 ? "s" : ""}</p>

      <div className="space-y-1.5">
        {filtered.map((w) => (
          <VocabRow key={w.vocab_id} word={w} showTranslation={showTranslation} />
        ))}
        {filtered.length === 0 && (
          <p className="text-center text-slate-400 py-8">No words match your filter.</p>
        )}
      </div>
    </>
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

// ── Personal Vocab Tab ──────────────────────────────────────────────────────

type SourceFilter = "all" | "reading" | "knm" | "manual";
type PVLevelFilter = "all" | "new" | "hard" | "learning" | "familiar" | "mastered";

function classifyPVLevel(item: PersonalVocabItem): string {
  if (item.mastered) return "mastered";
  if (item.repetitions === 0) return "new";
  if (item.repetitions <= 2 && item.ease_factor < 2.2) return "hard";
  if (item.repetitions <= 2) return "learning";
  return "familiar";
}

const PV_LEVEL_STYLES: Record<string, { color: string; dot: string }> = {
  new: { color: "bg-slate-100 text-slate-600 border-slate-200", dot: "bg-slate-400" },
  hard: { color: "bg-red-50 text-red-700 border-red-200", dot: "bg-red-500" },
  learning: { color: "bg-amber-50 text-amber-700 border-amber-200", dot: "bg-amber-500" },
  familiar: { color: "bg-blue-50 text-blue-700 border-blue-200", dot: "bg-blue-500" },
  mastered: { color: "bg-green-50 text-green-700 border-green-200", dot: "bg-green-500" },
};

function PersonalVocabTab() {
  const [items, setItems] = useState<PersonalVocabItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [levelFilter, setLevelFilter] = useState<PVLevelFilter>("all");
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editNotes, setEditNotes] = useState("");

  // Review state
  const [reviewMode, setReviewMode] = useState(false);
  const [reviewCards, setReviewCards] = useState<PersonalVocabItem[]>([]);
  const [reviewIdx, setReviewIdx] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [dueCount, setDueCount] = useState(0);

  useEffect(() => { loadData(); }, []);

  function loadData() {
    setLoading(true);
    Promise.all([getPersonalVocab(), getPersonalVocabSession()])
      .then(([all, session]) => { setItems(all); setDueCount(session.due_count); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  const filtered = useMemo(() => {
    let list = items;
    if (sourceFilter !== "all") list = list.filter((i) => i.source === sourceFilter);
    if (levelFilter !== "all") list = list.filter((i) => classifyPVLevel(i) === levelFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((i) => i.dutch.toLowerCase().includes(q) || i.english.toLowerCase().includes(q));
    }
    return list;
  }, [items, sourceFilter, levelFilter, search]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { new: 0, hard: 0, learning: 0, familiar: 0, mastered: 0 };
    items.forEach((i) => { c[classifyPVLevel(i)] = (c[classifyPVLevel(i)] || 0) + 1; });
    return c;
  }, [items]);

  function handleDelete(id: number) {
    deletePersonalVocab(id).then(() => setItems((p) => p.filter((i) => i.id !== id))).catch(() => {});
  }

  function handleSaveNotes(id: number) {
    updatePersonalVocab(id, { notes: editNotes }).then((u) => {
      setItems((p) => p.map((i) => (i.id === id ? u : i)));
      setEditingId(null);
    }).catch(() => {});
  }

  function startReview() {
    getPersonalVocabSession().then((session) => {
      if (session.cards.length === 0) return;
      setReviewCards(session.cards);
      setReviewIdx(0);
      setShowAnswer(false);
      setReviewMode(true);
    }).catch(() => {});
  }

  function handleRate(rating: Rating) {
    const card = reviewCards[reviewIdx];
    reviewPersonalVocab(card.id, rating).then(() => {
      if (reviewIdx + 1 < reviewCards.length) {
        setReviewIdx(reviewIdx + 1);
        setShowAnswer(false);
      } else {
        setReviewMode(false);
        loadData();
      }
    }).catch(() => {});
  }

  if (loading) return <div className="flex items-center justify-center py-16 text-slate-500">Loading...</div>;

  // Review mode
  if (reviewMode && reviewCards.length > 0) {
    const card = reviewCards[reviewIdx];
    return (
      <div className="max-w-lg mx-auto py-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold">Personal Vocab Review</h3>
          <span className="text-sm text-slate-500">{reviewIdx + 1} / {reviewCards.length}</span>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-6 text-center mb-4">
          <p className="text-2xl font-bold text-slate-800 mb-2">{card.dutch}</p>
          {card.context_sentence && (
            <p className="text-sm text-slate-400 italic mb-4">"{card.context_sentence}"</p>
          )}
          {!showAnswer ? (
            <button onClick={() => setShowAnswer(true)} className="bg-blue-600 text-white px-6 py-2 rounded-xl font-medium hover:bg-blue-700">
              Show Answer
            </button>
          ) : (
            <>
              <p className="text-lg text-blue-700 mb-4">{card.english}</p>
              <div className="flex gap-2 justify-center flex-wrap">
                {(["again", "hard", "good", "easy"] as Rating[]).map((r) => (
                  <button
                    key={r}
                    onClick={() => handleRate(r)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium capitalize ${
                      r === "again" ? "bg-red-100 text-red-700 hover:bg-red-200" :
                      r === "hard" ? "bg-orange-100 text-orange-700 hover:bg-orange-200" :
                      r === "good" ? "bg-green-100 text-green-700 hover:bg-green-200" :
                      "bg-blue-100 text-blue-700 hover:bg-blue-200"
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
        <button onClick={() => { setReviewMode(false); loadData(); }} className="text-sm text-slate-500 hover:text-slate-700">
          Exit Review
        </button>
      </div>
    );
  }

  return (
    <>
      {/* Header + review button */}
      {dueCount > 0 && (
        <div className="mb-4">
          <button
            onClick={startReview}
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:from-blue-700 hover:to-indigo-700 shadow-md"
          >
            Review Due ({dueCount})
          </button>
        </div>
      )}

      {/* Source filter pills */}
      <div className="flex flex-wrap gap-2 mb-3">
        {(["all", "reading", "knm", "manual"] as SourceFilter[]).map((f) => (
          <button
            key={f}
            onClick={() => setSourceFilter(f)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium border capitalize transition-colors ${
              sourceFilter === f ? "bg-slate-800 text-white border-slate-800" : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
            }`}
          >
            {f} {f === "all" ? `(${items.length})` : `(${items.filter((i) => i.source === f).length})`}
          </button>
        ))}
      </div>

      {/* Level filter pills */}
      <div className="flex flex-wrap gap-2 mb-4">
        {(["all", "new", "hard", "learning", "familiar", "mastered"] as PVLevelFilter[]).map((l) => {
          const style = PV_LEVEL_STYLES[l];
          return (
            <button
              key={l}
              onClick={() => setLevelFilter(levelFilter === l ? "all" : l)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium border capitalize transition-colors flex items-center gap-1.5 ${
                levelFilter === l ? "bg-slate-800 text-white border-slate-800" : l === "all" ? "bg-white text-slate-600 border-slate-200" : `${style?.color} hover:opacity-80`
              }`}
            >
              {style && <span className={`w-2 h-2 rounded-full ${levelFilter === l ? "bg-white" : style.dot}`} />}
              {l} ({l === "all" ? items.length : counts[l] ?? 0})
            </button>
          );
        })}
      </div>

      {/* Search */}
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search Dutch or English..."
        className="w-full border border-slate-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white mb-4"
      />

      <p className="text-xs text-slate-400 mb-3">{filtered.length} word{filtered.length !== 1 ? "s" : ""}</p>

      {/* Vocab list */}
      <div className="space-y-1.5">
        {filtered.map((item) => {
          const level = classifyPVLevel(item);
          const style = PV_LEVEL_STYLES[level];
          return (
            <div key={item.id} className="bg-white rounded-xl border border-slate-200/60 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-800 truncate">{item.dutch}</span>
                    <span className="text-xs text-slate-400 capitalize">{item.source}</span>
                  </div>
                  <p className="text-sm text-slate-500 truncate">{item.english}</p>
                  {item.context_sentence && (
                    <p className="text-xs text-slate-400 italic truncate mt-0.5">"{item.context_sentence}"</p>
                  )}
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium border capitalize ${style?.color}`}>
                  {level}
                </span>
                <div className="flex gap-1 flex-shrink-0">
                  {editingId === item.id ? (
                    <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="text"
                        value={editNotes}
                        onChange={(e) => setEditNotes(e.target.value)}
                        placeholder="Notes..."
                        className="text-xs border rounded px-2 py-1 w-32"
                      />
                      <button onClick={() => handleSaveNotes(item.id)} className="text-xs text-blue-600 hover:text-blue-800">Save</button>
                      <button onClick={() => setEditingId(null)} className="text-xs text-slate-400">Cancel</button>
                    </div>
                  ) : (
                    <button
                      onClick={(e) => { e.stopPropagation(); setEditingId(item.id); setEditNotes(item.notes); }}
                      className="text-slate-400 hover:text-slate-600"
                      title="Edit notes"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    </button>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }}
                    className="text-red-400 hover:text-red-600"
                    title="Delete"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>
              </div>
              {item.notes && editingId !== item.id && (
                <div className="px-4 pb-2">
                  <p className="text-xs text-slate-500">Note: {item.notes}</p>
                </div>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && (
          <p className="text-center text-slate-400 py-8">
            {items.length === 0
              ? "No personal vocabulary yet. Select text in Reading or KNM exercises to save words."
              : "No words match your filter."}
          </p>
        )}
      </div>
    </>
  );
}
