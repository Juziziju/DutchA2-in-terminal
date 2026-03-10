import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  ExamHistoryItem,
  ExamTrendPoint,
  FlashcardReviewItem,
  FlashcardStats,
  FlashcardTrendPoint,
  ListeningDetailItem,
  ListeningHistoryItem,
  ListeningTrendPoint,
  SpeakingHistoryItem,
  SpeakingHistoryPage,
  deleteSpeakingRecording,
  getExamResults,
  getExamTrend,
  getFlashcardHistory,
  getFlashcardResults,
  getFlashcardTrend,
  getListeningDetail,
  getListeningResults,
  getListeningTrend,
  getSpeakingHistoryPaged,
  listeningAudioUrl,
  speakingAudioUrl,
} from "../api";

type Tab = "flashcards" | "listening" | "exam" | "speaking";

const RATING_COLORS: Record<string, string> = {
  again: "bg-red-100 text-red-700",
  hard: "bg-orange-100 text-orange-700",
  good: "bg-green-100 text-green-700",
  easy: "bg-green-200 text-green-800",
  mastered: "bg-purple-100 text-purple-700",
};

export default function StudyMaterial() {
  const nav = useNavigate();
  const [tab, setTab] = useState<Tab>("flashcards");
  const [fcStats, setFcStats] = useState<FlashcardStats | null>(null);
  const [listening, setListening] = useState<ListeningHistoryItem[]>([]);
  const [exams, setExams] = useState<ExamHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // Speaking state
  const [speakingItems, setSpeakingItems] = useState<SpeakingHistoryItem[]>([]);
  const [speakingPage, setSpeakingPage] = useState(1);
  const [speakingPages, setSpeakingPages] = useState(1);
  type SpkFilter = "all" | "scene_drill" | "shadow_reading" | "mock_exam";
  const [spkFilter, setSpkFilter] = useState<SpkFilter>("all");
  const speakingAudioRef = useRef<HTMLAudioElement | null>(null);

  // Listening mode filter
  type LisFilter = "all" | "quiz" | "intensive";
  const [lisFilter, setLisFilter] = useState<LisFilter>("all");

  // Trends
  const [fcTrend, setFcTrend] = useState<FlashcardTrendPoint[]>([]);
  const [lisTrend, setLisTrend] = useState<ListeningTrendPoint[]>([]);
  const [examTrend, setExamTrend] = useState<ExamTrendPoint[]>([]);

  // Detail / history
  const [lisDetail, setLisDetail] = useState<ListeningDetailItem | null>(null);
  const [lisDetailLoading, setLisDetailLoading] = useState(false);
  const [fcHistory, setFcHistory] = useState<FlashcardReviewItem[]>([]);

  useEffect(() => {
    const core = Promise.all([getFlashcardResults(), getListeningResults(), getExamResults()])
      .then(([fc, l, e]) => { setFcStats(fc); setListening(l); setExams(e); })
      .catch(() => {});
    const trends = Promise.all([getFlashcardTrend(), getListeningTrend(), getExamTrend()])
      .then(([ft, lt, et]) => { setFcTrend(ft); setLisTrend(lt); setExamTrend(et); })
      .catch(() => {});
    const history = getFlashcardHistory()
      .then(setFcHistory)
      .catch(() => {});
    Promise.all([core, trends, history]).finally(() => setLoading(false));
  }, []);

  // Re-fetch listening data when filter changes
  useEffect(() => {
    const modeParam = lisFilter === "all" ? undefined : lisFilter;
    getListeningResults(modeParam).then(setListening).catch(() => {});
    getListeningTrend(modeParam).then(setLisTrend).catch(() => {});
  }, [lisFilter]);

  // Load speaking data when tab/filter/page changes
  useEffect(() => {
    if (tab !== "speaking") return;
    const modeParam = spkFilter === "all" ? undefined : spkFilter;
    getSpeakingHistoryPaged(speakingPage, 20, modeParam)
      .then((res) => { setSpeakingItems(res.items); setSpeakingPages(res.pages); })
      .catch(() => {});
  }, [tab, spkFilter, speakingPage]);

  function playSpeakingAudio(filename: string) {
    if (speakingAudioRef.current) speakingAudioRef.current.pause();
    const a = new Audio(speakingAudioUrl(filename));
    speakingAudioRef.current = a;
    a.play().catch(() => {});
  }

  function handleDeleteRecording(id: number) {
    deleteSpeakingRecording(id)
      .then(() => { setSpeakingItems((prev) => prev.filter((s) => s.id !== id)); })
      .catch(() => {});
  }

  const [lisDetailError, setLisDetailError] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  function playListeningAudio(filename: string) {
    if (audioRef.current) { audioRef.current.pause(); }
    const a = new Audio(listeningAudioUrl(filename));
    audioRef.current = a;
    a.play().catch(() => {});
  }

  function playSequence(files: string[]) {
    if (audioRef.current) { audioRef.current.pause(); }
    let idx = 0;
    function playNext() {
      if (idx >= files.length) return;
      const a = new Audio(listeningAudioUrl(files[idx]));
      audioRef.current = a;
      a.onended = () => { idx++; playNext(); };
      a.play().catch(() => {});
    }
    playNext();
  }

  function handleListeningExpand(id: number) {
    if (expandedId === id) {
      setExpandedId(null);
      setLisDetail(null);
      return;
    }
    setExpandedId(id);
    setLisDetail(null);
    setLisDetailError(false);
    setLisDetailLoading(true);
    getListeningDetail(id)
      .then((d) => { setLisDetail(d); })
      .catch((err) => { console.error("listening detail error:", err); setLisDetailError(true); })
      .finally(() => setLisDetailLoading(false));
  }

  const TABS: { key: Tab; label: string }[] = [
    { key: "flashcards", label: "Flashcards" },
    { key: "listening", label: "Listening" },
    { key: "speaking", label: "Speaking" },
    { key: "exam", label: "Mock Exam" },
  ];

  return (
    <div className="max-w-2xl mx-auto">
      <h2 className="text-xl font-bold mb-4">Study Material & History</h2>

      {/* Tab bar */}
      <div className="flex rounded-lg overflow-hidden border border-slate-200 mb-6">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); setExpandedId(null); setLisDetail(null); }}
            className={`flex-1 py-2 text-sm font-medium ${
              tab === t.key
                ? "bg-blue-600 text-white"
                : "bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading && <p className="text-slate-400 text-sm">Loading...</p>}

      {/* ── Flashcards tab ── */}
      {tab === "flashcards" && fcStats && (
        <div className="space-y-4">
          {/* Trend chart */}
          {fcTrend.length >= 1 && (
            <div className="bg-white rounded-2xl border border-slate-200 p-4">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Review Trend (30 days)</p>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={fcTrend}>
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(v: string) => v.slice(5)} />
                  <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} domain={[0, 100]} />
                  <Tooltip />
                  <Line yAxisId="left" type="monotone" dataKey="reviewed" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} name="Reviewed" />
                  <Line yAxisId="right" type="monotone" dataKey="correct_pct" stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }} name="Correct %" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            {[
              { label: "Total cards tracked", value: fcStats.total_cards },
              { label: "Mastered", value: fcStats.mastered },
              { label: "Due today", value: fcStats.due_today },
              { label: "Total reviewed", value: fcStats.total_reviewed },
            ].map((s) => (
              <div
                key={s.label}
                className="bg-white rounded-2xl border border-slate-200 p-4 text-center"
              >
                <p className="text-3xl font-bold">{s.value}</p>
                <p className="text-xs text-slate-500 mt-1">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Progress bar */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4">
            <div className="flex justify-between text-xs text-slate-500 mb-2">
              <span>Mastery progress</span>
              <span>{fcStats.mastered}/{fcStats.total_cards}</span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-2.5">
              <div
                className="bg-green-500 h-2.5 rounded-full transition-all"
                style={{ width: `${fcStats.total_cards ? (fcStats.mastered / fcStats.total_cards) * 100 : 0}%` }}
              />
            </div>
          </div>

          {/* CTA */}
          {fcStats.due_today > 0 && (
            <button
              onClick={() => nav("/vocab-refresh")}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 rounded-xl font-semibold hover:from-blue-700 hover:to-indigo-700 shadow-md"
            >
              Start Review ({fcStats.due_today} cards due)
            </button>
          )}

          {/* Recent reviews */}
          {fcHistory.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 p-4">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Recent Reviews</p>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {fcHistory.map((r) => (
                  <div key={r.id} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-medium truncate">{r.dutch}</span>
                      <span className="text-slate-400">{r.direction === "nl_en" ? "\u2192" : "\u2190"}</span>
                      <span className="truncate text-slate-600">{r.english}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${RATING_COLORS[r.rating] ?? "bg-slate-100 text-slate-600"}`}>
                        {r.rating}
                      </span>
                      <span className="text-xs text-slate-400">{r.date.slice(0, 10)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Listening tab ── */}
      {tab === "listening" && (
        <div className="space-y-3">
          {/* Mode filter */}
          <div className="flex rounded-lg overflow-hidden border border-slate-200">
            {(["all", "quiz", "intensive"] as LisFilter[]).map((f) => (
              <button
                key={f}
                onClick={() => setLisFilter(f)}
                className={`flex-1 py-1.5 text-xs font-medium capitalize ${
                  lisFilter === f
                    ? "bg-blue-600 text-white"
                    : "bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          {/* Trend chart */}
          {lisTrend.length >= 1 && (
            <div className="bg-white rounded-2xl border border-slate-200 p-4">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Score Trend (30 days)</p>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={lisTrend}>
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(v: string) => v.slice(5)} />
                  <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} />
                  <Tooltip />
                  <Line type="monotone" dataKey="avg_score" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} name="Avg Score %" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Score dots */}
          {listening.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 p-4">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                Last {Math.min(10, listening.length)} scores
              </p>
              <div className="flex gap-2">
                {listening.slice(0, 10).map((l) => (
                  <div
                    key={l.id}
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white ${
                      l.score_pct >= 60 ? "bg-green-500" : "bg-red-500"
                    }`}
                    title={`${l.topic}: ${l.score_pct}%`}
                  >
                    {l.score_pct}
                  </div>
                ))}
              </div>
            </div>
          )}

          {listening.length === 0 && !loading && (
            <p className="text-slate-400 text-sm">No listening sessions yet.</p>
          )}
          {listening.map((l) => (
            <div
              key={l.id}
              className="bg-white rounded-2xl border border-slate-200 cursor-pointer hover:shadow-md transition-all"
              onClick={() => handleListeningExpand(l.id)}
            >
              <div className="px-4 py-3 flex justify-between items-center">
                <div>
                  <p className="font-medium text-sm flex items-center gap-2">
                    {l.topic}
                    {l.level && (
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${
                        l.level === "A1" ? "bg-green-100 text-green-700" :
                        l.level === "B1" ? "bg-purple-100 text-purple-700" :
                        "bg-blue-100 text-blue-700"
                      }`}>{l.level}</span>
                    )}
                    {l.mode === "intensive" && (
                      <span className="text-xs px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">intensive</span>
                    )}
                  </p>
                  <p className="text-xs text-slate-400">{l.date.split("T")[0]}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-sm font-semibold ${
                      l.score_pct >= 60 ? "text-green-600" : "text-red-500"
                    }`}
                  >
                    {l.score_pct}%
                  </span>
                  <svg className={`w-4 h-4 text-slate-400 transition-transform ${expandedId === l.id ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </div>
              </div>
              {expandedId === l.id && (
                <div className="px-4 pb-3 pt-1 border-t border-slate-100" onClick={(e) => e.stopPropagation()}>
                  {lisDetailLoading && <p className="text-xs text-slate-400 py-2">Loading details...</p>}
                  {lisDetailError && <p className="text-xs text-red-400 py-2">Failed to load details.</p>}
                  {lisDetail && lisDetail.id === l.id && (
                    <div className="space-y-3 mt-2">
                      {/* Dialogue with audio replay */}
                      {lisDetail.dialogue.length > 0 && (
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Dialogue</p>
                            {lisDetail.dialogue.some((d) => d.audio_file) && (
                              <button
                                className="text-xs text-blue-500 hover:text-blue-700"
                                onClick={() => {
                                  // Play all lines sequentially
                                  const files = lisDetail!.dialogue.filter((d) => d.audio_file).map((d) => d.audio_file!);
                                  playSequence(files);
                                }}
                              >
                                Play all
                              </button>
                            )}
                          </div>
                          <div className="space-y-1 text-sm">
                            {lisDetail.dialogue.map((line, i) => (
                              <div key={i} className="flex items-start gap-1.5">
                                {line.audio_file && (
                                  <button
                                    onClick={() => playListeningAudio(line.audio_file!)}
                                    className="text-blue-400 hover:text-blue-600 mt-0.5 flex-shrink-0"
                                    title="Play"
                                  >
                                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M6.3 2.84A1.5 1.5 0 004 4.11v11.78a1.5 1.5 0 002.3 1.27l9.344-5.891a1.5 1.5 0 000-2.538L6.3 2.841z" /></svg>
                                  </button>
                                )}
                                <div>
                                  <span className="font-medium text-blue-600">{line.speaker}:</span>{" "}
                                  <span>{line.text}</span>
                                  {line.english && (
                                    <span className="text-slate-400 text-xs ml-1">({line.english})</span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Questions (quiz mode) */}
                      {lisDetail.questions.length > 0 && lisDetail.mode !== "intensive" && (
                        <div>
                          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Questions</p>
                          <div className="space-y-2">
                            {lisDetail.questions.map((q, i) => (
                              <div key={i} className="bg-slate-50 rounded-lg p-2 text-sm">
                                <p className="font-medium mb-1">{i + 1}. {q.question}</p>
                                <div className="grid grid-cols-2 gap-1 text-xs">
                                  {Object.entries(q.options).map(([key, val]) => {
                                    const isCorrect = key === q.answer;
                                    const isUserAnswer = key === q.user_answer;
                                    let cls = "px-2 py-1 rounded";
                                    if (isCorrect) cls += " bg-green-100 text-green-700 font-medium";
                                    else if (isUserAnswer && !isCorrect) cls += " bg-red-100 text-red-600 line-through";
                                    else cls += " text-slate-600";
                                    return (
                                      <div key={key} className={cls}>
                                        {key}. {val}
                                        {isCorrect && " \u2713"}
                                        {isUserAnswer && !isCorrect && " \u2717"}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Dictation results (intensive mode) */}
                      {lisDetail.results && lisDetail.results.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Dictation</p>
                          <div className="space-y-2">
                            {lisDetail.results.map((r, i) => (
                              <div key={i} className={`rounded-lg p-2 text-sm ${r.correct ? "bg-green-50" : "bg-red-50"}`}>
                                <div className="flex items-center justify-between mb-1">
                                  <span className={`text-xs font-bold ${r.correct ? "text-green-600" : "text-red-500"}`}>
                                    {r.correct ? "\u2713" : "\u2717"} Sentence {i + 1}
                                  </span>
                                  {r.audio_file && (
                                    <button
                                      onClick={() => playListeningAudio(r.audio_file!)}
                                      className="text-blue-400 hover:text-blue-600"
                                    >
                                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M6.3 2.84A1.5 1.5 0 004 4.11v11.78a1.5 1.5 0 002.3 1.27l9.344-5.891a1.5 1.5 0 000-2.538L6.3 2.841z" /></svg>
                                    </button>
                                  )}
                                </div>
                                <p className="text-xs"><span className="text-slate-400">Original:</span> {r.original}</p>
                                <p className="text-xs"><span className="text-slate-400">You typed:</span>{" "}
                                  <span className={r.correct ? "text-green-700" : "text-red-600"}>{r.user_text || <i className="text-slate-300">empty</i>}</span>
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Vocab used */}
                      {lisDetail.vocab_used.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Vocab Used</p>
                          <div className="flex flex-wrap gap-1">
                            {lisDetail.vocab_used.map((v, i) => (
                              <span key={i} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">{v}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex items-center gap-3 mt-3 mb-1">
                    <div className="flex-1 bg-slate-100 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${l.score_pct >= 60 ? "bg-green-500" : "bg-red-400"}`}
                        style={{ width: `${l.score_pct}%` }}
                      />
                    </div>
                    <span className="text-xs text-slate-500">{l.score_pct}%</span>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); nav("/study/listening"); }}
                    className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-2 rounded-lg text-sm font-semibold hover:from-blue-700 hover:to-indigo-700"
                  >
                    Practice Listening
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Speaking tab ── */}
      {tab === "speaking" && (
        <div className="space-y-3">
          {/* Mode filter */}
          <div className="flex rounded-lg overflow-hidden border border-slate-200">
            {(["all", "scene_drill", "shadow_reading", "mock_exam"] as SpkFilter[]).map((f) => (
              <button
                key={f}
                onClick={() => { setSpkFilter(f); setSpeakingPage(1); }}
                className={`flex-1 py-1.5 text-xs font-medium capitalize ${
                  spkFilter === f
                    ? "bg-blue-600 text-white"
                    : "bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                {f === "all" ? "All" : f.replace(/_/g, " ")}
              </button>
            ))}
          </div>

          {speakingItems.length === 0 && !loading && (
            <p className="text-slate-400 text-sm">No speaking sessions yet.</p>
          )}

          {speakingItems.map((s) => (
            <div key={s.id} className="bg-white rounded-2xl border border-slate-200 p-4">
              <div className="flex justify-between items-start">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      (s.score_pct ?? 0) >= 60 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                    }`}>
                      {s.score_pct ?? 0}%
                    </span>
                    <span className="text-sm font-medium text-slate-800">{s.scene}</span>
                    <span className="text-xs text-slate-400 capitalize">{s.mode.replace(/_/g, " ")}</span>
                  </div>
                  <p className="text-xs text-slate-400 mb-1">{s.date.split("T")[0]}</p>
                  {s.transcript && (
                    <p className="text-xs text-slate-500 truncate">{s.transcript}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                  {s.audio_file && (
                    <button
                      onClick={() => playSpeakingAudio(s.audio_file!)}
                      className="text-blue-500 hover:text-blue-700"
                      title="Play recording"
                    >
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M6.3 2.84A1.5 1.5 0 004 4.11v11.78a1.5 1.5 0 002.3 1.27l9.344-5.891a1.5 1.5 0 000-2.538L6.3 2.841z" /></svg>
                    </button>
                  )}
                  <button
                    onClick={() => handleDeleteRecording(s.id)}
                    className="text-red-400 hover:text-red-600"
                    title="Delete recording"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>
              </div>
            </div>
          ))}

          {/* Pagination */}
          {speakingPages > 1 && (
            <div className="flex justify-center gap-2 pt-2">
              <button
                onClick={() => setSpeakingPage((p) => Math.max(1, p - 1))}
                disabled={speakingPage <= 1}
                className="px-3 py-1 text-sm rounded-lg border border-slate-200 disabled:opacity-40"
              >
                Prev
              </button>
              <span className="px-3 py-1 text-sm text-slate-500">
                {speakingPage} / {speakingPages}
              </span>
              <button
                onClick={() => setSpeakingPage((p) => Math.min(speakingPages, p + 1))}
                disabled={speakingPage >= speakingPages}
                className="px-3 py-1 text-sm rounded-lg border border-slate-200 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Exam tab ── */}
      {tab === "exam" && (
        <div className="space-y-3">
          {/* Trend chart */}
          {examTrend.length >= 1 && (
            <div className="bg-white rounded-2xl border border-slate-200 p-4">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Score Trend (30 days)</p>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={examTrend}>
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(v: string) => v.slice(5)} />
                  <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} />
                  <Tooltip />
                  <Line type="monotone" dataKey="avg_score" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} name="Avg Score %" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {exams.length === 0 && !loading && (
            <p className="text-slate-400 text-sm">No mock exams completed yet.</p>
          )}
          {exams.map((e) => {
            const isExpanded = expandedId === e.id;
            const avgScore = e.avg_score ?? 0;
            return (
              <div
                key={e.id}
                className="bg-white rounded-2xl border border-slate-200 cursor-pointer hover:shadow-md transition-all"
                onClick={() => setExpandedId(isExpanded ? null : e.id)}
              >
                <div className="px-4 py-3 flex justify-between items-center">
                  <div>
                    <p className="font-medium text-sm capitalize">{e.source} material</p>
                    <p className="text-xs text-slate-400">{e.date.split("T")[0]}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${
                        e.passed ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                      }`}
                    >
                      {e.passed ? "PASS" : "FAIL"}
                    </span>
                    <span className="text-sm font-semibold">{avgScore}%</span>
                    <svg className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  </div>
                </div>
                {isExpanded && (
                  <div className="px-4 pb-3 pt-1 border-t border-slate-100">
                    <div className="flex flex-wrap gap-3 text-xs text-slate-500 mb-3">
                      {Object.entries(e.scores).map(([code, score]) => (
                        <span key={code}>
                          {code}:{" "}
                          <span className={`font-medium ${score !== null && score >= 60 ? "text-green-600" : "text-red-500"}`}>
                            {score !== null ? `${score}%` : "--"}
                          </span>
                        </span>
                      ))}
                    </div>
                    <button
                      onClick={(ev) => { ev.stopPropagation(); nav("/exam"); }}
                      className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-2 rounded-lg text-sm font-semibold hover:from-blue-700 hover:to-indigo-700"
                    >
                      Retake Exam
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
