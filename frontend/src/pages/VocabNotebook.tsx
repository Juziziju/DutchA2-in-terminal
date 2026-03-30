import { useEffect, useMemo, useState } from "react";
import {
  PersonalVocabItem,
  Rating,
  VocabLevel,
  VocabNoteItem,
  VocabNotebookOut,
  addToLearn,
  deletePersonalVocab,
  getPersonalVocab,
  getPersonalVocabSession,
  getVocabNotebook,
  reviewPersonalVocab,
  updatePersonalVocab,
  vocabAudioUrl,
} from "../api";
import { useAudioPlay } from "../components/AudioPlayer";

type NotebookTab = "course" | "personal" | "questions";

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
          { key: "questions" as const, label: "Questions Vocab" },
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
      {tab === "questions" && <QuestionsVocabTab />}
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
  const [sortBy, setSortBy] = useState<"alpha" | "level" | "category">("level");
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  useEffect(() => {
    getVocabNotebook()
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function handleAddToLearn(vocabId: number) {
    addToLearn(vocabId).then(() => {
      // Optimistically mark as queued in local state
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          items: prev.items.map((w) =>
            w.vocab_id === vocabId ? { ...w, queued: true } : w
          ),
        };
      });
    }).catch(() => {});
  }

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
    } else if (sortBy === "category") {
      items = [...items].sort((a, b) => a.category.localeCompare(b.category) || a.dutch.localeCompare(b.dutch));
    } else {
      const order: Record<VocabLevel, number> = { hard: 0, learning: 1, new: 2, familiar: 3, mastered: 4 };
      items = [...items].sort((a, b) => order[a.level] - order[b.level] || a.dutch.localeCompare(b.dutch));
    }
    return items;
  }, [data, filter, search, sortBy]);

  const categoryGroups = useMemo(() => {
    if (sortBy !== "category") return [];
    const map = new Map<string, VocabNoteItem[]>();
    for (const w of filtered) {
      const list = map.get(w.category);
      if (list) list.push(w);
      else map.set(w.category, [w]);
    }
    return Array.from(map.entries());
  }, [filtered, sortBy]);

  function toggleCategory(cat: string) {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }

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
            onChange={(e) => setSortBy(e.target.value as "alpha" | "level" | "category")}
            className="border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            <option value="level">Sort by level</option>
            <option value="alpha">Sort A-Z</option>
            <option value="category">Sort by scene</option>
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

      {sortBy === "category" ? (
        <div className="space-y-2">
          {categoryGroups.map(([cat, words]) => (
            <div key={cat}>
              <button
                onClick={() => toggleCategory(cat)}
                className="w-full sticky top-0 z-10 bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 flex items-center justify-between hover:bg-slate-100 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <svg
                    className={`w-4 h-4 text-slate-400 transition-transform ${expandedCategories.has(cat) ? "rotate-90" : ""}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  <span className="text-sm font-semibold text-slate-700">{cat}</span>
                </div>
                <span className="text-xs text-slate-400">{words.length}</span>
              </button>
              {expandedCategories.has(cat) && (
                <div className="space-y-1.5 mt-1.5 ml-2">
                  {words.map((w) => (
                    <VocabRow key={w.vocab_id} word={w} showTranslation={showTranslation} onAddToLearn={handleAddToLearn} />
                  ))}
                </div>
              )}
            </div>
          ))}
          {categoryGroups.length === 0 && (
            <p className="text-center text-slate-400 py-8">No words match your filter.</p>
          )}
        </div>
      ) : (
        <div className="space-y-1.5">
          {filtered.map((w) => (
            <VocabRow key={w.vocab_id} word={w} showTranslation={showTranslation} onAddToLearn={handleAddToLearn} />
          ))}
          {filtered.length === 0 && (
            <p className="text-center text-slate-400 py-8">No words match your filter.</p>
          )}
        </div>
      )}
    </>
  );
}

function VocabRow({
  word: w,
  showTranslation,
  onAddToLearn,
}: {
  word: VocabNoteItem;
  showTranslation: boolean;
  onAddToLearn?: (vocabId: number) => void;
}) {
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
        {w.level === "new" && !w.queued && onAddToLearn && (
          <button
            onClick={(e) => { e.stopPropagation(); onAddToLearn(w.vocab_id); }}
            className="flex-shrink-0 text-xs px-2.5 py-1 rounded-lg font-medium bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100 transition-colors"
          >
            + Learn
          </button>
        )}
        {w.level === "new" && w.queued && (
          <span className="flex-shrink-0 text-xs px-2.5 py-1 rounded-lg font-medium bg-green-50 text-green-600 border border-green-200">
            Queued
          </span>
        )}
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


// ── Questions Vocab Tab ─────────────────────────────────────────────────────

interface QuestionEntry {
  dutch: string;
  english: string;
  chinese: string;
  grammar_note?: string;
  example?: string;
}

interface QuestionCategory {
  title: string;
  description: string;
  questions: QuestionEntry[];
}

const QUESTION_VOCAB: QuestionCategory[] = [
  {
    title: "Vraagwoorden (Question Words)",
    description: "Basic question words used in all exam parts",
    questions: [
      { dutch: "Wat?", english: "What?", chinese: "什么？" },
      { dutch: "Wie?", english: "Who?", chinese: "谁？" },
      { dutch: "Waar?", english: "Where?", chinese: "哪里？" },
      { dutch: "Wanneer?", english: "When?", chinese: "什么时候？" },
      { dutch: "Waarom?", english: "Why?", chinese: "为什么？" },
      { dutch: "Hoe?", english: "How?", chinese: "怎样？" },
      { dutch: "Hoeveel?", english: "How many / How much?", chinese: "多少？" },
      { dutch: "Hoe laat?", english: "What time?", chinese: "几点？" },
      { dutch: "Hoe lang?", english: "How long?", chinese: "多长时间？" },
      { dutch: "Hoe vaak?", english: "How often?", chinese: "多久一次？" },
      { dutch: "Welk(e)?", english: "Which?", chinese: "哪个？", grammar_note: "welk (het-word) / welke (de-word & plural)" },
      { dutch: "Hoelang duurt het?", english: "How long does it take?", chinese: "要多长时间？" },
    ],
  },
  {
    title: "Ja/Nee vragen (Yes/No Questions)",
    description: "Verb-first questions — verb moves to position 1",
    questions: [
      { dutch: "Bent u getrouwd?", english: "Are you married?", chinese: "你结婚了吗？", grammar_note: "Verb (bent) first → yes/no question" },
      { dutch: "Heeft u kinderen?", english: "Do you have children?", chinese: "你有孩子吗？", grammar_note: "Heeft + u + noun" },
      { dutch: "Woont u in Amsterdam?", english: "Do you live in Amsterdam?", chinese: "你住在阿姆斯特丹吗？" },
      { dutch: "Werkt u?", english: "Do you work?", chinese: "你工作吗？" },
      { dutch: "Spreekt u Nederlands?", english: "Do you speak Dutch?", chinese: "你说荷兰语吗？" },
      { dutch: "Vindt u dat leuk?", english: "Do you like that?", chinese: "你喜欢那个吗？" },
      { dutch: "Kunt u mij helpen?",  english: "Can you help me?", chinese: "你能帮我吗？" },
      { dutch: "Mag ik iets vragen?", english: "May I ask something?", chinese: "我可以问一下吗？" },
      { dutch: "Is het duur?", english: "Is it expensive?", chinese: "贵吗？" },
      { dutch: "Heeft u een afspraak?", english: "Do you have an appointment?", chinese: "你有预约吗？" },
    ],
  },
  {
    title: "Spreken Onderdeel 1 — Situatievragen",
    description: "Common questions in exam part 1: short answers about daily situations",
    questions: [
      { dutch: "Stel uzelf voor.", english: "Introduce yourself.", chinese: "请自我介绍。", grammar_note: "Imperative — 'stel ... voor' is a separable verb (zich voorstellen)" },
      { dutch: "Vertel wat er aan de hand is.", english: "Tell what is going on.", chinese: "说说怎么了。", grammar_note: "'aan de hand' = going on/wrong" },
      { dutch: "Vertel waarom u belt.", english: "Explain why you are calling.", chinese: "说说你为什么打电话。", grammar_note: "'waarom' triggers subordinate clause: verb goes to end" },
      { dutch: "Wat is er met u aan de hand?", english: "What is wrong with you?", chinese: "你怎么了？" },
      { dutch: "Wat voor klachten heeft u?", english: "What kind of complaints do you have?", chinese: "你有什么症状？", grammar_note: "'wat voor' = what kind of" },
      { dutch: "Hoe laat begint de les?", english: "What time does the lesson start?", chinese: "课几点开始？" },
      { dutch: "Waar kan ik dat vinden?", english: "Where can I find that?", chinese: "我在哪里能找到？" },
      { dutch: "Kunt u dat herhalen?", english: "Can you repeat that?", chinese: "你能重复一下吗？", grammar_note: "Useful when you don't understand the question" },
    ],
  },
  {
    title: "Spreken Onderdeel 2 — Foto beschrijven",
    description: "Questions about photo description — describe what you see + personal opinion",
    questions: [
      { dutch: "Vertel wat u op de foto ziet.", english: "Describe what you see in the photo.", chinese: "描述照片里看到了什么。", grammar_note: "'ziet' — present tense of 'zien' (to see)" },
      { dutch: "Wat ziet u op de foto?", english: "What do you see in the photo?", chinese: "你在照片里看到了什么？" },
      { dutch: "Gaat u vaak naar de markt?", english: "Do you often go to the market?", chinese: "你经常去市场吗？", grammar_note: "'gaat u' — formal you + verb first = question" },
      { dutch: "Waarom wel of niet?", english: "Why or why not?", chinese: "为什么去/不去？" },
      { dutch: "Eet u thuis vaak samen?", english: "Do you often eat together at home?", chinese: "你在家经常一起吃饭吗？" },
      { dutch: "Wat doet u graag in uw vrije tijd?", english: "What do you like to do in your free time?", chinese: "你空闲时间喜欢做什么？", grammar_note: "'graag' = gladly, makes verb into 'like to'" },
      { dutch: "Hoe ziet uw buurt eruit?", english: "What does your neighbourhood look like?", chinese: "你的社区是什么样的？", grammar_note: "'eruitzien' = to look like (separable)" },
      { dutch: "Doet u aan sport?", english: "Do you do sports?", chinese: "你做运动吗？", grammar_note: "'aan sport doen' = to do sports" },
    ],
  },
  {
    title: "Spreken Onderdeel 3 — Roltaken",
    description: "Role play task instructions — you play a role in a situation",
    questions: [
      { dutch: "U wilt een afspraak maken.", english: "You want to make an appointment.", chinese: "你想预约。", grammar_note: "'willen' (want) + infinitive at end" },
      { dutch: "Vertel wat u wilt.", english: "Tell what you want.", chinese: "说说你想要什么。" },
      { dutch: "Vraag informatie over...", english: "Ask for information about...", chinese: "询问关于...的信息。" },
      { dutch: "Leg uit wat het probleem is.", english: "Explain what the problem is.", chinese: "解释问题是什么。", grammar_note: "'uitleggen' = to explain (separable)" },
      { dutch: "U belt naar...", english: "You are calling...", chinese: "你打电话给...。", grammar_note: "'bellen naar' = to call (someone)" },
      { dutch: "Zeg wat u ervan vindt.", english: "Say what you think about it.", chinese: "说说你对此的看法。", grammar_note: "'ervan vinden' = to think about it" },
      { dutch: "Wat wilt u graag?", english: "What would you like?", chinese: "你想要什么？" },
      { dutch: "Kunt u een andere datum voorstellen?", english: "Can you suggest another date?", chinese: "你能建议另一个日期吗？" },
    ],
  },
  {
    title: "Spreken Onderdeel 4 — Vergelijken & Kiezen",
    description: "Compare two options, make a choice, explain why",
    questions: [
      { dutch: "Vergelijk de twee opties.", english: "Compare the two options.", chinese: "比较这两个选项。" },
      { dutch: "Welke kiest u? Waarom?", english: "Which do you choose? Why?", chinese: "你选哪个？为什么？" },
      { dutch: "Wat zijn de voordelen?", english: "What are the advantages?", chinese: "有什么优点？" },
      { dutch: "Wat zijn de nadelen?", english: "What are the disadvantages?", chinese: "有什么缺点？" },
      { dutch: "Wat is het verschil?", english: "What is the difference?", chinese: "有什么区别？", grammar_note: "'het verschil' = the difference (het-word)" },
      { dutch: "Wat past beter bij u?", english: "What suits you better?", chinese: "什么更适合你？", grammar_note: "'passen bij' = to suit" },
      { dutch: "Wat vindt u belangrijker?", english: "What do you find more important?", chinese: "你觉得什么更重要？", grammar_note: "'belangrijker' = comparative of 'belangrijk'" },
      { dutch: "Kunt u uw keuze uitleggen?", english: "Can you explain your choice?", chinese: "你能解释你的选择吗？" },
    ],
  },
  {
    title: "Schrijven — Veelvoorkomende vragen",
    description: "Common question patterns seen in writing exam tasks",
    questions: [
      { dutch: "Wanneer kunt u komen?", english: "When can you come?", chinese: "你什么时候能来？" },
      { dutch: "Kunt u de afspraak verzetten?", english: "Can you reschedule the appointment?", chinese: "你能改约时间吗？", grammar_note: "'verzetten' = to reschedule/move" },
      { dutch: "Hoeveel kost het?", english: "How much does it cost?", chinese: "多少钱？" },
      { dutch: "Waar moet ik naartoe?", english: "Where do I need to go?", chinese: "我要去哪里？", grammar_note: "'naartoe' = to (direction), attached to 'waar'" },
      { dutch: "Hoe kan ik me aanmelden?", english: "How can I register?", chinese: "我怎么报名？", grammar_note: "'zich aanmelden' = to register (separable + reflexive)" },
      { dutch: "Is het mogelijk om...?", english: "Is it possible to...?", chinese: "有没有可能...？" },
      { dutch: "Kunt u mij meer informatie geven?", english: "Can you give me more information?", chinese: "你能给我更多信息吗？" },
      { dutch: "Wat moet ik meenemen?", english: "What do I need to bring?", chinese: "我需要带什么？", grammar_note: "'meenemen' = to bring along (separable)" },
    ],
  },
  {
    title: "Grammatica patronen (Grammar Patterns)",
    description: "Key grammar structures that appear in questions",
    questions: [
      { dutch: "Verb-first = ja/nee vraag", english: "Verb first = yes/no question", chinese: "动词放第一位 = 是/否问题", grammar_note: "Werkt u? Heeft u? Bent u? — verb before subject", example: "Werkt u in Amsterdam? → Do you work in Amsterdam?" },
      { dutch: "Vraagwoord + V2", english: "Question word + verb 2nd", chinese: "疑问词 + 动词在第二位", grammar_note: "Waar woont u? Wat doet u? — question word 1st, verb 2nd", example: "Waar woont u? → Where do you live?" },
      { dutch: "Scheidbare werkwoorden in vragen", english: "Separable verbs in questions", chinese: "可分动词在问题中", grammar_note: "Prefix goes to end: 'Stelt u uzelf voor' → voor-stellen", example: "Wanneer komt u aan? → When do you arrive? (aan-komen)" },
      { dutch: "Bijzin met 'dat/omdat/wanneer'", english: "Subordinate clause — verb to end", chinese: "从句 — 动词移到句末", grammar_note: "After 'dat/omdat/als/wanneer', the verb goes to the END", example: "Vertel waarom u belt. → Tell why you are calling. (belt goes to end)" },
      { dutch: "Modale werkwoorden", english: "Modal verbs: kunnen/willen/moeten/mogen", chinese: "情态动词：能/想/必须/可以", grammar_note: "Modal verb 2nd position, main verb infinitive at end", example: "Kunt u mij helpen? → Can you help me? (helpen at end)" },
      { dutch: "Inversie (subject-verb swap)", english: "Inversion after adverb/time", chinese: "时间/副词后主谓倒装", grammar_note: "After time/place at start, verb stays 2nd, subject moves after", example: "Morgen ga ik naar school. → Tomorrow I go to school." },
    ],
  },
];

function QuestionsVocabTab() {
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set([0]));
  const [search, setSearch] = useState("");

  const toggleSection = (idx: number) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const filteredCategories = useMemo(() => {
    if (!search.trim()) return QUESTION_VOCAB;
    const q = search.toLowerCase();
    return QUESTION_VOCAB.map((cat) => ({
      ...cat,
      questions: cat.questions.filter(
        (e) =>
          e.dutch.toLowerCase().includes(q) ||
          e.english.toLowerCase().includes(q) ||
          e.chinese.includes(q) ||
          (e.grammar_note && e.grammar_note.toLowerCase().includes(q)),
      ),
    })).filter((cat) => cat.questions.length > 0);
  }, [search]);

  const totalQuestions = filteredCategories.reduce((s, c) => s + c.questions.length, 0);

  return (
    <div>
      {/* Header */}
      <div className="mb-4">
        <p className="text-slate-500 text-sm">
          Common Dutch question patterns for the speaking & writing exam — {totalQuestions} items
        </p>
      </div>

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search questions..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Sections */}
      <div className="space-y-3">
        {filteredCategories.map((cat, catIdx) => {
          const originalIdx = QUESTION_VOCAB.indexOf(cat) >= 0 ? QUESTION_VOCAB.indexOf(cat) : catIdx;
          const isExpanded = expandedSections.has(originalIdx) || search.trim().length > 0;

          return (
            <div key={catIdx} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              {/* Section header */}
              <button
                onClick={() => toggleSection(originalIdx)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors"
              >
                <div className="text-left">
                  <h3 className="font-bold text-slate-800 text-sm">{cat.title}</h3>
                  <p className="text-slate-400 text-xs">{cat.description}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">{cat.questions.length}</span>
                  <svg
                    className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? "rotate-90" : ""}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </button>

              {/* Questions */}
              {isExpanded && (
                <div className="border-t border-slate-100">
                  {cat.questions.map((q, qIdx) => (
                    <div
                      key={qIdx}
                      className="px-4 py-3 border-b border-slate-50 last:border-b-0 hover:bg-slate-50/50"
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-slate-800">{q.dutch}</p>
                          <p className="text-blue-600 text-sm">{q.english}</p>
                          <p className="text-slate-500 text-sm">{q.chinese}</p>
                          {q.grammar_note && (
                            <p className="text-amber-600 text-xs mt-1 flex items-start gap-1">
                              <span className="shrink-0">📝</span>
                              <span>{q.grammar_note}</span>
                            </p>
                          )}
                          {q.example && (
                            <p className="text-green-600 text-xs mt-0.5 flex items-start gap-1">
                              <span className="shrink-0">💡</span>
                              <span>{q.example}</span>
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
