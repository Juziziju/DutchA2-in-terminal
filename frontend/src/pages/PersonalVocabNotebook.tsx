import { useEffect, useMemo, useState } from "react";
import {
  PersonalVocabItem,
  Rating,
  deletePersonalVocab,
  getPersonalVocab,
  getPersonalVocabSession,
  reviewPersonalVocab,
  updatePersonalVocab,
} from "../api";

type SourceFilter = "all" | "reading" | "knm" | "manual";
type LevelFilter = "all" | "new" | "hard" | "learning" | "familiar" | "mastered";

function classifyLevel(item: PersonalVocabItem): string {
  if (item.mastered) return "mastered";
  if (item.repetitions === 0) return "new";
  if (item.repetitions <= 2 && item.ease_factor < 2.2) return "hard";
  if (item.repetitions <= 2) return "learning";
  return "familiar";
}

const LEVEL_STYLES: Record<string, { color: string; dot: string }> = {
  new: { color: "bg-slate-100 text-slate-600 border-slate-200", dot: "bg-slate-400" },
  hard: { color: "bg-red-50 text-red-700 border-red-200", dot: "bg-red-500" },
  learning: { color: "bg-amber-50 text-amber-700 border-amber-200", dot: "bg-amber-500" },
  familiar: { color: "bg-blue-50 text-blue-700 border-blue-200", dot: "bg-blue-500" },
  mastered: { color: "bg-green-50 text-green-700 border-green-200", dot: "bg-green-500" },
};

export default function PersonalVocabNotebook() {
  const [items, setItems] = useState<PersonalVocabItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [levelFilter, setLevelFilter] = useState<LevelFilter>("all");
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editNotes, setEditNotes] = useState("");

  // Review state
  const [reviewMode, setReviewMode] = useState(false);
  const [reviewCards, setReviewCards] = useState<PersonalVocabItem[]>([]);
  const [reviewIdx, setReviewIdx] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [dueCount, setDueCount] = useState(0);

  useEffect(() => {
    loadData();
  }, []);

  function loadData() {
    setLoading(true);
    Promise.all([getPersonalVocab(), getPersonalVocabSession()])
      .then(([all, session]) => {
        setItems(all);
        setDueCount(session.due_count);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  const filtered = useMemo(() => {
    let list = items;
    if (sourceFilter !== "all") list = list.filter((i) => i.source === sourceFilter);
    if (levelFilter !== "all") list = list.filter((i) => classifyLevel(i) === levelFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (i) => i.dutch.toLowerCase().includes(q) || i.english.toLowerCase().includes(q),
      );
    }
    return list;
  }, [items, sourceFilter, levelFilter, search]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { new: 0, hard: 0, learning: 0, familiar: 0, mastered: 0 };
    items.forEach((i) => { c[classifyLevel(i)] = (c[classifyLevel(i)] || 0) + 1; });
    return c;
  }, [items]);

  function handleDelete(id: number) {
    deletePersonalVocab(id).then(() => {
      setItems((prev) => prev.filter((i) => i.id !== id));
    }).catch(() => {});
  }

  function handleSaveNotes(id: number) {
    updatePersonalVocab(id, { notes: editNotes }).then((updated) => {
      setItems((prev) => prev.map((i) => (i.id === id ? updated : i)));
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

  if (loading) {
    return <div className="flex items-center justify-center py-16 text-slate-500">Loading...</div>;
  }

  // Review mode
  if (reviewMode && reviewCards.length > 0) {
    const card = reviewCards[reviewIdx];
    return (
      <div className="max-w-lg mx-auto py-8">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold">Personal Vocab Review</h2>
          <span className="text-sm text-slate-500">{reviewIdx + 1} / {reviewCards.length}</span>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-6 text-center mb-4">
          <p className="text-2xl font-bold text-slate-800 mb-2">{card.dutch}</p>
          {card.context_sentence && (
            <p className="text-sm text-slate-400 italic mb-4">"{card.context_sentence}"</p>
          )}

          {!showAnswer ? (
            <button
              onClick={() => setShowAnswer(true)}
              className="bg-blue-600 text-white px-6 py-2 rounded-xl font-medium hover:bg-blue-700"
            >
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
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold">Personal Vocabulary</h2>
        {dueCount > 0 && (
          <button
            onClick={startReview}
            className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:from-blue-700 hover:to-indigo-700 shadow-md"
          >
            Review Due ({dueCount})
          </button>
        )}
      </div>

      {/* Source filter pills */}
      <div className="flex flex-wrap gap-2 mb-3">
        {(["all", "reading", "knm", "manual"] as SourceFilter[]).map((f) => (
          <button
            key={f}
            onClick={() => setSourceFilter(f)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium border capitalize transition-colors ${
              sourceFilter === f
                ? "bg-slate-800 text-white border-slate-800"
                : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
            }`}
          >
            {f} {f === "all" ? `(${items.length})` : `(${items.filter((i) => i.source === f).length})`}
          </button>
        ))}
      </div>

      {/* Level filter pills */}
      <div className="flex flex-wrap gap-2 mb-4">
        {(["all", "new", "hard", "learning", "familiar", "mastered"] as LevelFilter[]).map((l) => {
          const style = LEVEL_STYLES[l];
          return (
            <button
              key={l}
              onClick={() => setLevelFilter(levelFilter === l ? "all" : l)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium border capitalize transition-colors flex items-center gap-1.5 ${
                levelFilter === l
                  ? "bg-slate-800 text-white border-slate-800"
                  : l === "all" ? "bg-white text-slate-600 border-slate-200" : `${style?.color} hover:opacity-80`
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
          const level = classifyLevel(item);
          const style = LEVEL_STYLES[level];
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
                <div className="flex gap-1">
                  {editingId === item.id ? (
                    <div className="flex gap-1">
                      <input
                        type="text"
                        value={editNotes}
                        onChange={(e) => setEditNotes(e.target.value)}
                        placeholder="Notes..."
                        className="text-xs border rounded px-2 py-1 w-32"
                        onClick={(e) => e.stopPropagation()}
                      />
                      <button onClick={() => handleSaveNotes(item.id)} className="text-xs text-blue-600 hover:text-blue-800">Save</button>
                      <button onClick={() => setEditingId(null)} className="text-xs text-slate-400">Cancel</button>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setEditingId(item.id); setEditNotes(item.notes); }}
                      className="text-slate-400 hover:text-slate-600"
                      title="Edit notes"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(item.id)}
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
    </div>
  );
}
