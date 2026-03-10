import { useEffect, useMemo, useRef, useState } from "react";
import {
  SpeakingNotebookScene,
  getSpeakingNotebook,
  getSpeakingSentenceAudio,
  listeningAudioUrl,
  speakingAudioUrl,
} from "../api";

export default function SpeakingNotebook() {
  const [scenes, setScenes] = useState<SpeakingNotebookScene[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    getSpeakingNotebook()
      .then((d) => setScenes(d.scenes))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    let items = scenes;
    if (filter !== "all") items = items.filter((s) => s.id === filter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      items = items.filter(
        (s) =>
          s.title_en.toLowerCase().includes(q) ||
          s.title_nl.toLowerCase().includes(q) ||
          s.vocab.some(
            (v) => v.dutch.toLowerCase().includes(q) || v.english.toLowerCase().includes(q),
          ) ||
          s.model_sentences.some(
            (m) => m.text.toLowerCase().includes(q) || m.english.toLowerCase().includes(q),
          ),
      );
    }
    return items;
  }, [scenes, filter, search]);

  function playAudio(url: string) {
    if (audioRef.current) audioRef.current.pause();
    const a = new Audio(url);
    audioRef.current = a;
    a.play().catch(() => {});
  }

  function playTTS(sceneId: string, index: number) {
    getSpeakingSentenceAudio(sceneId, index)
      .then((r) => playAudio(listeningAudioUrl(r.audio_file)))
      .catch(() => {});
  }

  if (loading) {
    return <div className="flex items-center justify-center py-16 text-slate-500">Loading...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-xl font-bold mb-4">Speaking Knowledge Summary</h2>

      {/* Scene filter pills */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button
          onClick={() => setFilter("all")}
          className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
            filter === "all"
              ? "bg-slate-800 text-white border-slate-800"
              : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
          }`}
        >
          All ({scenes.length})
        </button>
        {scenes.map((s) => (
          <button
            key={s.id}
            onClick={() => setFilter(filter === s.id ? "all" : s.id)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
              filter === s.id
                ? "bg-slate-800 text-white border-slate-800"
                : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
            }`}
          >
            {s.title_en}
            {s.stats.attempts > 0 && (
              <span className="ml-1 text-xs opacity-60">({s.stats.attempts})</span>
            )}
          </button>
        ))}
      </div>

      {/* Search */}
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search vocab or sentences..."
        className="w-full border border-slate-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white mb-4"
      />

      <p className="text-xs text-slate-400 mb-3">
        {filtered.length} scene{filtered.length !== 1 ? "s" : ""}
      </p>

      {/* Scene cards */}
      <div className="space-y-3">
        {filtered.map((sc) => (
          <SceneCard
            key={sc.id}
            scene={sc}
            expanded={expandedId === sc.id}
            onToggle={() => setExpandedId(expandedId === sc.id ? null : sc.id)}
            onPlayTTS={(idx) => playTTS(sc.id, idx)}
            onPlayRecording={(file) => playAudio(speakingAudioUrl(file))}
          />
        ))}
        {filtered.length === 0 && (
          <p className="text-center text-slate-400 py-8">No scenes match your filter.</p>
        )}
      </div>
    </div>
  );
}

function SceneCard({
  scene: sc,
  expanded,
  onToggle,
  onPlayTTS,
  onPlayRecording,
}: {
  scene: SpeakingNotebookScene;
  expanded: boolean;
  onToggle: () => void;
  onPlayTTS: (index: number) => void;
  onPlayRecording: (file: string) => void;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200/60 shadow-sm hover:shadow-md transition-shadow">
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center justify-between text-left"
      >
        <div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-800">{sc.title_en}</span>
            <span className="text-xs text-slate-400">{sc.title_nl}</span>
            {sc.is_custom && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-600 font-medium">
                custom
              </span>
            )}
          </div>
          <div className="flex gap-3 text-xs text-slate-500 mt-0.5">
            <span>{sc.stats.attempts} attempts</span>
            {sc.stats.avg_score !== null && <span>Avg: {sc.stats.avg_score}%</span>}
            {sc.stats.last_practiced && (
              <span>Last: {sc.stats.last_practiced.split("T")[0]}</span>
            )}
          </div>
        </div>
        <svg
          className={`w-4 h-4 text-slate-400 transition-transform ${expanded ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="px-4 pb-4 pt-1 border-t border-slate-100 space-y-4">
          {/* Vocab */}
          {sc.vocab.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                Vocabulary ({sc.vocab.length})
              </p>
              <div className="space-y-1">
                {sc.vocab.map((v, i) => (
                  <div key={i} className="flex items-start gap-3 text-sm py-1">
                    <span className="font-medium text-slate-800 min-w-[120px]">{v.dutch}</span>
                    <span className="text-slate-500">{v.english}</span>
                    {v.example && (
                      <span className="text-xs text-slate-400 italic ml-auto truncate max-w-[200px]">
                        {v.example}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Model sentences */}
          {sc.model_sentences.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                Model Sentences ({sc.model_sentences.length})
              </p>
              <div className="space-y-1.5">
                {sc.model_sentences.map((m, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <button
                      onClick={() => onPlayTTS(i)}
                      className="text-blue-500 hover:text-blue-700 mt-0.5 flex-shrink-0"
                      title="Play TTS"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M6.3 2.84A1.5 1.5 0 004 4.11v11.78a1.5 1.5 0 002.3 1.27l9.344-5.891a1.5 1.5 0 000-2.538L6.3 2.841z" />
                      </svg>
                    </button>
                    <div>
                      <p className="text-slate-800">{m.text}</p>
                      <p className="text-xs text-slate-400">{m.english}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Best recordings */}
          {sc.best_recordings.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                Best Recordings ({sc.best_recordings.length})
              </p>
              <div className="space-y-1.5">
                {sc.best_recordings.map((r, i) => (
                  <div key={i} className="flex items-center gap-3 text-sm bg-slate-50 rounded-lg px-3 py-2">
                    {r.audio_file && (
                      <button
                        onClick={() => onPlayRecording(r.audio_file!)}
                        className="text-blue-500 hover:text-blue-700 flex-shrink-0"
                        title="Play recording"
                      >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M6.3 2.84A1.5 1.5 0 004 4.11v11.78a1.5 1.5 0 002.3 1.27l9.344-5.891a1.5 1.5 0 000-2.538L6.3 2.841z" />
                        </svg>
                      </button>
                    )}
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      r.score_pct >= 60 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                    }`}>
                      {r.score_pct}%
                    </span>
                    <span className="text-xs text-slate-500 truncate flex-1">
                      {r.question_id}
                    </span>
                    {r.transcript && (
                      <span className="text-xs text-slate-400 truncate max-w-[200px]">
                        {r.transcript}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {sc.stats.attempts === 0 && (
            <p className="text-sm text-slate-400 italic">No practice sessions yet for this scene.</p>
          )}
        </div>
      )}
    </div>
  );
}
