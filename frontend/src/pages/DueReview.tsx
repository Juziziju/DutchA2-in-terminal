import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CardOut, Rating, getFlashcardSession, submitReview, vocabAudioUrl } from "../api";
import { useAudioPlay } from "../components/AudioPlayer";

const RATING_LABELS: { rating: Rating; label: string; color: string }[] = [
  { rating: "again", label: "Forget", color: "bg-red-100 hover:bg-red-200 text-red-800 shadow-sm" },
  { rating: "hard", label: "Blurry", color: "bg-orange-100 hover:bg-orange-200 text-orange-800 shadow-sm" },
  { rating: "good", label: "Remember", color: "bg-green-100 hover:bg-green-200 text-green-800 shadow-sm" },
];

export default function DueReview() {
  const nav = useNavigate();
  const [cards, setCards] = useState<CardOut[]>([]);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ forget: 0, blurry: 0, remember: 0, mastered: 0 });

  const card = cards[index] ?? null;
  const audioSrc = card?.audio_file ? vocabAudioUrl(card.audio_file) : null;
  const playAudio = useAudioPlay(audioSrc);

  useEffect(() => {
    getFlashcardSession("nl_en,en_nl")
      .then((sess) => {
        // Filter to only due cards (not new)
        const dueOnly = sess.cards.filter((c) => !c.is_new);
        setCards(dueOnly);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Auto-play audio on front for nl_en cards
  useEffect(() => {
    if (!flipped && card?.direction === "nl_en" && audioSrc) playAudio();
  }, [index, flipped]);

  // Keyboard shortcuts
  const flipRef = useRef(reveal);
  flipRef.current = reveal;
  const rateRef = useRef(rate);
  rateRef.current = rate;
  const masterRef = useRef(markMastered);
  masterRef.current = markMastered;
  const flippedRef = useRef(flipped);
  flippedRef.current = flipped;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (!flippedRef.current && e.code === "Space") { e.preventDefault(); flipRef.current(); }
      else if (flippedRef.current) {
        if (e.key === "ArrowLeft") { e.preventDefault(); rateRef.current("again"); }
        else if (e.key === "ArrowUp") { e.preventDefault(); rateRef.current("hard"); }
        else if (e.key === "ArrowRight") { e.preventDefault(); rateRef.current("good"); }
        else if (e.key === "ArrowDown") { e.preventDefault(); masterRef.current(); }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function reveal() { setFlipped(true); }

  async function rate(rating: Rating) {
    if (!card || submitting) return;
    setSubmitting(true);
    try {
      await submitReview(card.progress_id, rating, card.vocab_id, card.direction);
      const key = rating === "again" ? "forget" : rating === "hard" ? "blurry" : "remember";
      setStats((p) => ({ ...p, [key]: p[key as keyof typeof p] + 1 }));
    } catch {}
    setSubmitting(false);
    advance();
  }

  async function markMastered() {
    if (!card || submitting) return;
    setSubmitting(true);
    try {
      await submitReview(card.progress_id, "mastered", card.vocab_id, card.direction);
      setStats((p) => ({ ...p, mastered: p.mastered + 1 }));
    } catch {}
    setSubmitting(false);
    advance();
  }

  function advance() {
    setFlipped(false);
    setIndex((p) => p + 1);
  }

  if (loading) {
    return <Center><p className="text-slate-500">Loading due cards...</p></Center>;
  }

  if (cards.length === 0) {
    return (
      <Center>
        <div className="text-5xl mb-4">&#10024;</div>
        <h2 className="text-xl font-bold mb-2 text-slate-800">All caught up!</h2>
        <p className="text-slate-500 mb-6">No cards are due for review right now.</p>
        <div className="flex gap-3">
          <button onClick={() => nav("/vocab-refresh")} className="px-5 py-2.5 border border-slate-300 text-slate-600 rounded-xl font-medium hover:bg-slate-50">
            Full Review
          </button>
          <button onClick={() => nav("/")} className="px-5 py-2.5 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700">
            Dashboard
          </button>
        </div>
      </Center>
    );
  }

  if (index >= cards.length) {
    const total = stats.forget + stats.blurry + stats.remember + stats.mastered;
    return (
      <Center>
        <div className="text-5xl mb-4">&#127881;</div>
        <h2 className="text-xl font-bold mb-4">Due Review Complete!</h2>
        <p className="text-slate-500 mb-4">{total} cards reviewed</p>
        <div className="grid grid-cols-2 gap-2 text-sm mb-6 w-full max-w-xs">
          {Object.entries(stats).map(([k, v]) => (
            <div key={k} className="flex justify-between bg-slate-100 rounded px-3 py-1 capitalize">
              <span>{k}</span><span className="font-bold">{v}</span>
            </div>
          ))}
        </div>
        <div className="flex gap-3">
          <button onClick={() => { setIndex(0); setStats({ forget: 0, blurry: 0, remember: 0, mastered: 0 }); setLoading(true); getFlashcardSession("nl_en,en_nl").then(s => { setCards(s.cards.filter(c => !c.is_new)); }).finally(() => setLoading(false)); }} className="px-5 py-2.5 border border-slate-300 text-slate-600 rounded-xl font-medium hover:bg-slate-50">
            Review Again
          </button>
          <button onClick={() => nav("/")} className="px-5 py-2.5 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700">
            Dashboard
          </button>
        </div>
      </Center>
    );
  }

  const prompt = card.direction === "nl_en" ? card.dutch : card.english;
  const answer = card.direction === "nl_en" ? card.english : card.dutch;

  return (
    <div className="flex flex-col items-center">
      {/* Header */}
      <div className="w-full max-w-md flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold text-slate-800">Due Review</h2>
          <span className="text-xs text-slate-500">{index + 1}/{cards.length} due cards</span>
        </div>
        <button
          onClick={() => setIndex(cards.length)}
          className="text-xs text-slate-400 hover:text-slate-700"
        >
          End Session
        </button>
      </div>

      {/* Progress bar */}
      <div className="w-full max-w-md bg-slate-200 rounded-full h-1.5 mb-6">
        <div className="bg-blue-500 h-1.5 rounded-full transition-all" style={{ width: `${(index / cards.length) * 100}%` }} />
      </div>

      {/* Card */}
      <div className="card-flip-container w-full max-w-md" style={{ minHeight: 220 }}>
        <div className={`card-flip-inner ${flipped ? "flipped" : ""}`} style={{ minHeight: 220 }}>
          <div className="card-front bg-white rounded-2xl border border-slate-200/60 shadow-lg p-8 flex flex-col items-center justify-center" style={{ minHeight: 220 }}>
            <span className="text-xs text-slate-400 mb-2">
              {card.direction === "nl_en" ? "NL \u2192 EN" : "EN \u2192 NL"} · due
            </span>
            <p className="text-3xl font-bold text-center">{prompt}</p>
            {audioSrc && card.direction === "nl_en" && (
              <button onClick={playAudio} className="mt-4 text-blue-500 text-sm hover:text-blue-700">Play audio</button>
            )}
          </div>
          <div className="card-back bg-white rounded-2xl border border-blue-200/60 shadow-lg p-8 flex flex-col items-center justify-center" style={{ minHeight: 220 }}>
            <span className="text-xs text-slate-400 mb-2">{card.direction === "nl_en" ? "NL \u2192 EN" : "EN \u2192 NL"}</span>
            <p className="text-3xl font-bold text-center mb-2">{answer}</p>
            {card.example_dutch && <p className="text-sm text-slate-500 italic text-center mt-2">{card.example_dutch}</p>}
            {card.example_english && <p className="text-xs text-slate-400 text-center">{card.example_english}</p>}
            {audioSrc && card.direction === "en_nl" && (
              <button onClick={playAudio} className="mt-3 text-blue-500 text-sm hover:text-blue-700">Play audio</button>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="mt-6 w-full max-w-md">
        {!flipped ? (
          <>
            <button onClick={reveal} className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 rounded-xl font-semibold hover:from-blue-700 hover:to-indigo-700 shadow-md">
              Reveal
            </button>
            <p className="text-xs text-slate-400 text-center mt-2">Space to reveal</p>
          </>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2">
              {RATING_LABELS.map(({ rating, label, color }) => (
                <button key={rating} onClick={() => rate(rating)} disabled={submitting} className={`py-3.5 rounded-xl font-medium text-sm ${color} disabled:opacity-50`}>
                  {label}
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-400 text-center mt-2">
              &larr; Forget &middot; &uarr; Blurry &middot; &rarr; Remember &middot; &darr; Mastered
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col items-center justify-center py-16">{children}</div>;
}
