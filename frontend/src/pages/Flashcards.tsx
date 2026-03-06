import { useEffect, useRef } from "react";
import { Rating, getFlashcardSession, submitReview, vocabAudioUrl } from "../api";
import { useAudioPlay } from "../components/AudioPlayer";
import { useFlashcardsState } from "../contexts/FlashcardsContext";

const RATING_LABELS: { rating: Rating; label: string; color: string; statKey: string }[] = [
  { rating: "again", label: "Forget", color: "bg-red-100 hover:bg-red-200 text-red-800 shadow-sm", statKey: "forget" },
  { rating: "hard", label: "Blurry", color: "bg-orange-100 hover:bg-orange-200 text-orange-800 shadow-sm", statKey: "blurry" },
  { rating: "good", label: "Remember", color: "bg-green-100 hover:bg-green-200 text-green-800 shadow-sm", statKey: "remember" },
];

const DIR_OPTIONS = [
  { value: "nl_en" as const, label: "NL \u2192 EN", desc: "See Dutch, answer English" },
  { value: "en_nl" as const, label: "EN \u2192 NL", desc: "See English, answer Dutch" },
  { value: "both" as const, label: "Both", desc: "Mixed directions" },
];

export default function Flashcards() {
  const { state: s, set, reset } = useFlashcardsState();
  const spellingRef = useRef<HTMLInputElement>(null);

  const card = s.session?.cards[s.index] ?? null;
  const audioSrc = card?.audio_file ? vocabAudioUrl(card.audio_file) : null;
  const playAudio = useAudioPlay(audioSrc);

  // In spelling mode for current card?
  const isSpellingCard = s.spellingMode && card?.direction === "en_nl";

  // Load session after setup
  useEffect(() => {
    if (s.phase !== "loading" || s.loaded) return;
    const dirParam = s.directions === "both" ? "nl_en,en_nl" : s.directions;
    getFlashcardSession(dirParam)
      .then((sess) => {
        set((p) => ({
          ...p,
          session: sess,
          phase: sess.cards.length === 0 ? "empty" : "front",
          loaded: true,
        }));
      })
      .catch(() => set((p) => ({ ...p, phase: "empty", loaded: true })));
  }, [s.phase, s.loaded]);

  // Auto-play when Dutch is on front (nl_en) and we show front
  useEffect(() => {
    if (s.phase === "front" && card?.direction === "nl_en" && audioSrc) {
      playAudio();
    }
  }, [s.phase, s.index]);

  // Auto-play when Dutch is revealed on back (en_nl)
  useEffect(() => {
    if (s.phase === "back" && card?.direction === "en_nl" && audioSrc) {
      playAudio();
    }
  }, [s.phase]);

  // Focus spelling input when it appears
  useEffect(() => {
    if (s.spellingResult === "pending" && spellingRef.current) {
      spellingRef.current.focus();
    }
  }, [s.spellingResult]);

  // Keep refs to avoid stale closures in keyboard handler
  const phaseRef = useRef(s.phase);
  phaseRef.current = s.phase;
  const revealRef = useRef(reveal);
  revealRef.current = reveal;
  const rateRef = useRef(rate);
  rateRef.current = rate;
  const markMasteredRef = useRef(markMastered);
  markMasteredRef.current = markMastered;

  // Keyboard shortcuts — single registration, refs keep it fresh
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const phase = phaseRef.current;
      if (phase === "front" && e.code === "Space") {
        e.preventDefault();
        revealRef.current();
      } else if (phase === "back") {
        if (e.key === "ArrowLeft") { e.preventDefault(); rateRef.current("again", "forget"); }
        else if (e.key === "ArrowUp") { e.preventDefault(); rateRef.current("hard", "blurry"); }
        else if (e.key === "ArrowRight") { e.preventDefault(); rateRef.current("good", "remember"); }
        else if (e.key === "ArrowDown") { e.preventDefault(); markMasteredRef.current(); }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function reveal() {
    if (isSpellingCard && s.spellingResult === null) {
      // Show spelling input instead of flipping
      set((p) => ({ ...p, spellingResult: "pending", spellingInput: "" }));
      return;
    }
    set((p) => ({ ...p, flipped: true, phase: "back", spellingResult: null }));
  }

  function checkSpelling() {
    if (!card) return;
    const correct = s.spellingInput.trim().toLowerCase() === card.dutch.toLowerCase();
    set((p) => ({
      ...p,
      spellingResult: correct ? "correct" : "wrong",
      flipped: true,
      phase: "back",
    }));
  }

  async function rate(rating: Rating, statKey: string) {
    if (!card || s.submitting) return;
    set((p) => ({ ...p, submitting: true }));
    try {
      await submitReview(card.progress_id, rating, card.vocab_id, card.direction);
      set((p) => ({ ...p, stats: { ...p.stats, [statKey]: (p.stats as Record<string, number>)[statKey] + 1 } }));
    } catch {}
    set((p) => ({ ...p, submitting: false }));
    advance();
  }

  async function markMastered() {
    if (!card || s.submitting) return;
    set((p) => ({ ...p, submitting: true }));
    try {
      await submitReview(card.progress_id, "mastered", card.vocab_id, card.direction);
      set((p) => ({ ...p, stats: { ...p.stats, mastered: p.stats.mastered + 1 } }));
    } catch {}
    set((p) => ({ ...p, submitting: false }));
    advance();
  }

  function skipSpelling() {
    // Skip the spelling input and just reveal the answer
    set((p) => ({ ...p, flipped: true, phase: "back", spellingResult: null }));
  }

  function advance() {
    set((p) => {
      const nextIndex = p.index + 1;
      if (p.session && nextIndex >= p.session.cards.length) {
        return { ...p, phase: "done" };
      }
      return { ...p, index: nextIndex, flipped: false, phase: "front", spellingResult: null, spellingInput: "" };
    });
  }

  function startSession() {
    set((p) => ({ ...p, phase: "loading" }));
  }

  // ── Setup phase ──
  if (s.phase === "setup") {
    return (
      <Screen>
        <h2 className="text-xl font-bold mb-6">Choose Mode</h2>
        <div className="grid grid-cols-3 gap-3 w-full max-w-md mb-6">
          {DIR_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => set((p) => ({ ...p, directions: opt.value }))}
              className={`rounded-xl border-2 p-4 text-center transition-all ${
                s.directions === opt.value
                  ? "border-blue-500 bg-blue-50 shadow-md"
                  : "border-slate-200 bg-white hover:border-slate-300"
              }`}
            >
              <p className="font-bold text-lg">{opt.label}</p>
              <p className="text-xs text-slate-500 mt-1">{opt.desc}</p>
            </button>
          ))}
        </div>

        {/* Spelling toggle — only for en_nl or both */}
        {(s.directions === "en_nl" || s.directions === "both") && (
          <div className="w-full max-w-md bg-white rounded-xl border border-slate-200 p-4 mb-6">
            <label className="flex items-center gap-3 cursor-pointer">
              <div
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  s.spellingMode ? "bg-blue-500" : "bg-slate-300"
                }`}
                onClick={() => set((p) => ({ ...p, spellingMode: !p.spellingMode }))}
              >
                <div
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                    s.spellingMode ? "translate-x-5" : ""
                  }`}
                />
              </div>
              <div>
                <p className="text-sm font-medium">Enable spelling test</p>
                <p className="text-xs text-slate-400">Type the Dutch word before revealing the answer</p>
              </div>
            </label>
          </div>
        )}

        <button
          onClick={startSession}
          className="w-full max-w-md bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 rounded-xl font-semibold hover:from-blue-700 hover:to-indigo-700 shadow-md"
        >
          Start Session
        </button>
      </Screen>
    );
  }

  if (s.phase === "loading") {
    return <Screen><p className="text-slate-500">Loading session...</p></Screen>;
  }

  if (s.phase === "empty") {
    return (
      <Screen>
        <p className="text-slate-600 mb-4">No cards due today. Come back tomorrow!</p>
      </Screen>
    );
  }

  if (s.phase === "done") {
    const total = Object.values(s.stats).reduce((a, b) => a + b, 0);
    return (
      <Screen>
        <h2 className="text-xl font-bold mb-4">Session complete!</h2>
        <div className="grid grid-cols-2 gap-2 text-sm mb-6 w-full max-w-xs">
          {Object.entries(s.stats).map(([k, v]) => (
            <div key={k} className="flex justify-between bg-slate-100 rounded px-3 py-1 capitalize">
              <span>{k}</span><span className="font-bold">{v}</span>
            </div>
          ))}
        </div>
        <div className="flex gap-3 w-full max-w-xs">
          <button
            onClick={reset}
            className="flex-1 border border-slate-300 text-slate-600 px-4 py-2 rounded-xl font-semibold hover:bg-slate-50"
          >
            Back
          </button>
          <button
            onClick={reset}
            className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 py-2 rounded-xl font-semibold hover:from-blue-700 hover:to-indigo-700"
          >
            New session
          </button>
        </div>
      </Screen>
    );
  }

  if (!s.session || !card) return null;

  const total = s.session.cards.length;
  const prompt = card.direction === "nl_en" ? card.dutch : card.english;
  const answer = card.direction === "nl_en" ? card.english : card.dutch;

  return (
    <div className="flex flex-col items-center">
      {/* Progress info */}
      <div className="w-full max-w-md flex items-center justify-between mb-4 text-sm text-slate-500">
        <span>
          {s.index + 1}/{total} · Due: {s.session.due_count} · New: {s.session.new_count}
        </span>
        <div className="flex items-center gap-3">
          <button
            onClick={() => set((p) => ({ ...p, phase: "done" }))}
            className="text-xs text-slate-400 hover:text-slate-700"
            title="End this session and see results"
          >
            End Session
          </button>
        </div>
      </div>

      <div className="w-full max-w-md flex flex-col items-center">
        {/* Progress bar */}
        <div className="w-full max-w-md bg-slate-200 rounded-full h-1.5 mb-6">
          <div
            className="bg-blue-500 h-1.5 rounded-full transition-all"
            style={{ width: `${((s.index) / total) * 100}%` }}
          />
        </div>

        {/* Card */}
        <div className="card-flip-container w-full max-w-md" style={{ minHeight: 220 }}>
          <div className={`card-flip-inner ${s.flipped ? "flipped" : ""}`} style={{ minHeight: 220 }}>
            {/* Front */}
            <div
              className="card-front bg-white rounded-2xl border border-slate-200/60 shadow-lg p-8 flex flex-col items-center justify-center"
              style={{ minHeight: 220 }}
            >
              <span className="text-xs text-slate-400 mb-2">
                {card.direction === "nl_en" ? "NL \u2192 EN" : "EN \u2192 NL"}
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
              className="card-back bg-white rounded-2xl border border-blue-200/60 shadow-lg p-8 flex flex-col items-center justify-center"
              style={{ minHeight: 220 }}
            >
              <span className="text-xs text-slate-400 mb-2">
                {card.direction === "nl_en" ? "NL \u2192 EN" : "EN \u2192 NL"}
              </span>
              {/* Spelling result indicator */}
              {s.spellingResult === "correct" && (
                <p className="text-green-600 font-bold text-sm mb-1">\u2713 Correct!</p>
              )}
              {s.spellingResult === "wrong" && (
                <p className="text-red-500 font-bold text-sm mb-1">\u2717 You typed: {s.spellingInput}</p>
              )}
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
          {s.phase === "front" && s.spellingResult === "pending" ? (
            /* Spelling input mode */
            <div className="space-y-3">
              <p className="text-sm text-slate-500 text-center">Type the Dutch word:</p>
              <input
                ref={spellingRef}
                type="text"
                value={s.spellingInput}
                onChange={(e) => set((p) => ({ ...p, spellingInput: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") checkSpelling();
                  if (e.key === "Escape") skipSpelling();
                }}
                className="w-full border border-slate-300 rounded-xl px-4 py-3 text-center text-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                placeholder="Type here..."
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  onClick={skipSpelling}
                  className="flex-1 border border-slate-300 text-slate-600 py-3 rounded-xl font-semibold hover:bg-slate-50"
                >
                  Skip
                </button>
                <button
                  onClick={checkSpelling}
                  className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 rounded-xl font-semibold hover:from-blue-700 hover:to-indigo-700 shadow-md"
                >
                  Check
                </button>
              </div>
              <p className="text-xs text-slate-400 text-center">Enter to check · Esc to skip</p>
            </div>
          ) : s.phase === "front" ? (
            <>
              <button
                onClick={reveal}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 rounded-xl font-semibold hover:from-blue-700 hover:to-indigo-700 shadow-md"
              >
                Reveal
              </button>
              <p className="text-xs text-slate-400 text-center mt-2">Space to reveal</p>
            </>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-2">
                {RATING_LABELS.map(({ rating, label, color, statKey }) => (
                  <button
                    key={rating}
                    onClick={() => rate(rating, statKey)}
                    disabled={s.submitting}
                    className={`py-3.5 rounded-xl font-medium text-sm ${color} disabled:opacity-50`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-slate-400 text-center mt-2">
                &larr; Forget · &uarr; Blurry · &rarr; Remember · &darr; Mastered
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Screen({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      {children}
    </div>
  );
}
