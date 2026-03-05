import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CardOut, Rating, SessionOut, getFlashcardSession, submitReview } from "../api";
import { useAudioPlay } from "../components/AudioPlayer";

type Phase = "loading" | "empty" | "front" | "back" | "done";

const RATING_LABELS: { rating: Rating; label: string; color: string }[] = [
  { rating: "again", label: "Again", color: "bg-red-100 hover:bg-red-200 text-red-800" },
  { rating: "hard", label: "Hard", color: "bg-orange-100 hover:bg-orange-200 text-orange-800" },
  { rating: "good", label: "Good", color: "bg-blue-100 hover:bg-blue-200 text-blue-800" },
  { rating: "easy", label: "Easy", color: "bg-green-100 hover:bg-green-200 text-green-800" },
];

export default function Flashcards() {
  const nav = useNavigate();
  const [session, setSession] = useState<SessionOut | null>(null);
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("loading");
  const [flipped, setFlipped] = useState(false);
  const [stats, setStats] = useState({ again: 0, hard: 0, good: 0, easy: 0, mastered: 0 });
  const [submitting, setSubmitting] = useState(false);

  const card = session?.cards[index] ?? null;

  const audioSrc = card?.audio_file ? `/audio/${card.audio_file}` : null;
  const playAudio = useAudioPlay(audioSrc);

  useEffect(() => {
    getFlashcardSession()
      .then((s) => {
        setSession(s);
        setPhase(s.cards.length === 0 ? "empty" : "front");
      })
      .catch(() => setPhase("empty"));
  }, []);

  // Auto-play when Dutch is on front (nl_en) and we show front
  useEffect(() => {
    if (phase === "front" && card?.direction === "nl_en" && audioSrc) {
      playAudio();
    }
  }, [phase, index]);

  // Auto-play when Dutch is revealed on back (en_nl)
  useEffect(() => {
    if (phase === "back" && card?.direction === "en_nl" && audioSrc) {
      playAudio();
    }
  }, [phase]);

  function reveal() {
    setFlipped(true);
    setPhase("back");
  }

  async function rate(rating: Rating) {
    if (!card || submitting) return;
    setSubmitting(true);
    try {
      await submitReview(card.progress_id, rating);
      setStats((s) => ({ ...s, [rating]: s[rating as keyof typeof s] + 1 }));
    } catch {
      // silent — carry on
    }
    setSubmitting(false);
    advance();
  }

  async function markMastered() {
    if (!card || submitting) return;
    setSubmitting(true);
    try {
      await submitReview(card.progress_id, "mastered");
      setStats((s) => ({ ...s, mastered: s.mastered + 1 }));
    } catch {}
    setSubmitting(false);
    advance();
  }

  function advance() {
    const nextIndex = index + 1;
    if (session && nextIndex >= session.cards.length) {
      setPhase("done");
    } else {
      setIndex(nextIndex);
      setFlipped(false);
      setPhase("front");
    }
  }

  if (phase === "loading") {
    return <Screen><p className="text-slate-500">Loading session...</p></Screen>;
  }

  if (phase === "empty") {
    return (
      <Screen>
        <p className="text-slate-600 mb-4">No cards due today. Come back tomorrow!</p>
        <button onClick={() => nav("/")} className="btn-primary">Back to home</button>
      </Screen>
    );
  }

  if (phase === "done") {
    const total = Object.values(stats).reduce((a, b) => a + b, 0);
    return (
      <Screen>
        <h2 className="text-xl font-bold mb-4">Session complete!</h2>
        <div className="grid grid-cols-2 gap-2 text-sm mb-6 w-full max-w-xs">
          {Object.entries(stats).map(([k, v]) => (
            <div key={k} className="flex justify-between bg-slate-100 rounded px-3 py-1 capitalize">
              <span>{k}</span><span className="font-bold">{v}</span>
            </div>
          ))}
        </div>
        <button onClick={() => nav("/")} className="btn-primary">Back to home</button>
      </Screen>
    );
  }

  if (!session || !card) return null;

  const total = session.cards.length;
  const prompt = card.direction === "nl_en" ? card.dutch : card.english;
  const answer = card.direction === "nl_en" ? card.english : card.dutch;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top bar */}
      <header className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between">
        <button onClick={() => nav("/")} className="text-slate-500 hover:text-slate-800">
          ← Back
        </button>
        <span className="text-sm text-slate-500">
          {index + 1}/{total} &nbsp;·&nbsp; Due: {session.due_count} &nbsp; New: {session.new_count}
        </span>
        <button
          onClick={markMastered}
          className="text-xs text-slate-400 hover:text-slate-700"
          title="Mark as mastered (won't appear again)"
        >
          Mastered
        </button>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-6">
        {/* Progress bar */}
        <div className="w-full max-w-md bg-slate-200 rounded-full h-1.5 mb-6">
          <div
            className="bg-blue-500 h-1.5 rounded-full transition-all"
            style={{ width: `${((index) / total) * 100}%` }}
          />
        </div>

        {/* Card */}
        <div className="card-flip-container w-full max-w-md" style={{ minHeight: 220 }}>
          <div className={`card-flip-inner ${flipped ? "flipped" : ""}`} style={{ minHeight: 220 }}>
            {/* Front */}
            <div
              className="card-front bg-white rounded-2xl border border-slate-200 shadow p-8 flex flex-col items-center justify-center"
              style={{ minHeight: 220 }}
            >
              <span className="text-xs text-slate-400 mb-2">
                {card.direction === "nl_en" ? "NL → EN" : "EN → NL"}
                {card.is_new ? " · new" : ""}
              </span>
              <p className="text-3xl font-bold text-center">{prompt}</p>
              {audioSrc && card.direction === "nl_en" && (
                <button
                  onClick={playAudio}
                  className="mt-4 text-blue-500 text-sm hover:text-blue-700"
                >
                  Play audio
                </button>
              )}
            </div>

            {/* Back */}
            <div
              className="card-back bg-white rounded-2xl border border-blue-200 shadow p-8 flex flex-col items-center justify-center"
              style={{ minHeight: 220 }}
            >
              <span className="text-xs text-slate-400 mb-2">
                {card.direction === "nl_en" ? "NL → EN" : "EN → NL"}
              </span>
              <p className="text-3xl font-bold text-center mb-2">{answer}</p>
              {card.example_dutch && (
                <p className="text-sm text-slate-500 italic text-center mt-2">
                  {card.example_dutch}
                </p>
              )}
              {card.example_english && (
                <p className="text-xs text-slate-400 text-center">
                  {card.example_english}
                </p>
              )}
              {audioSrc && card.direction === "en_nl" && (
                <button
                  onClick={playAudio}
                  className="mt-3 text-blue-500 text-sm hover:text-blue-700"
                >
                  Play audio
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-6 w-full max-w-md">
          {phase === "front" ? (
            <button
              onClick={reveal}
              className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700"
            >
              Reveal
            </button>
          ) : (
            <div className="grid grid-cols-4 gap-2">
              {RATING_LABELS.map(({ rating, label, color }) => (
                <button
                  key={rating}
                  onClick={() => rate(rating)}
                  disabled={submitting}
                  className={`py-3 rounded-xl font-medium text-sm ${color} disabled:opacity-50`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function Screen({ children }: { children: React.ReactNode }) {
  const nav = useNavigate();
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
      {children}
    </div>
  );
}
