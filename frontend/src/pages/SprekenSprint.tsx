import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAudioRecorder } from "../hooks/useAudioRecorder";
import CountdownTimer from "../components/CountdownTimer";
import * as api from "../api";
import { vocabAudioUrl } from "../api";

// ── Types ────────────────────────────────────────────────────────────────────

type Phase =
  | "loading"
  | "activate"
  | "overview"
  | "day_detail"
  | "vocab_drill"
  | "vocab_summary"
  | "speaking_drill_prep"
  | "speaking_drill_record"
  | "speaking_drill_review"
  | "day_complete"
  | "stats";

interface VocabCard extends api.SprintVocabItem {
  _index: number;
  audio_file?: string;
}

// ── Main component ──────────────────────────────────────────────────────────

export default function SprekenSprint() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [overview, setOverview] = useState<api.SprintOverview | null>(null);
  const [dayDetail, setDayDetail] = useState<api.SprintDayDetail | null>(null);
  const [stats, setStats] = useState<api.SprintStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState(0);

  // Vocab drill state
  const [vocabCards, setVocabCards] = useState<VocabCard[]>([]);
  const [vocabIndex, setVocabIndex] = useState(0);
  const [vocabRevealed, setVocabRevealed] = useState(false);
  const [vocabMastered, setVocabMastered] = useState(0);
  const [vocabReviewed, setVocabReviewed] = useState(0);

  // Speaking drill state
  const [speakingQuestions, setSpeakingQuestions] = useState<any[]>([]);
  const [speakingQuestionIdx, setSpeakingQuestionIdx] = useState(0);
  const [speakingScores, setSpeakingScores] = useState<number[]>([]);
  const [speakingTranscript, setSpeakingTranscript] = useState("");
  const [speakingFeedback, setSpeakingFeedback] = useState<string>("");
  const [speakingScore, setSpeakingScore] = useState<number | null>(null);
  const [speakingImproved, setSpeakingImproved] = useState("");
  const [uploadingSpeaking, setUploadingSpeaking] = useState(false);
  const [recordingBlobUrl, setRecordingBlobUrl] = useState<string | null>(null);
  const recorder = useAudioRecorder();
  const navigate = useNavigate();

  // Load overview on mount
  useEffect(() => {
    loadOverview();
  }, []);

  const loadOverview = async () => {
    try {
      const data = await api.getSprintOverview();
      setOverview(data);
      if (!data.active && data.current_day === 0) {
        setPhase("activate");
      } else {
        setPhase("overview");
      }
    } catch {
      setPhase("activate");
    }
  };

  const activate = async () => {
    try {
      await api.activateSprint();
      // Sync sprint vocab into main Vocab table (with TTS) in background
      api.syncSprintVocab().catch(() => {});
      await loadOverview();
      setPhase("overview");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Activation failed");
    }
  };

  const openDay = async (day: number) => {
    setSelectedDay(day);
    try {
      const detail = await api.getSprintDay(day);
      setDayDetail(detail);
      setPhase("day_detail");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load day");
    }
  };

  const startVocabDrill = () => {
    if (!dayDetail) return;
    const cards: VocabCard[] = dayDetail.vocab.map((v, i) => ({ ...v, _index: i }));
    setVocabCards(cards);
    setVocabIndex(0);
    setVocabRevealed(false);
    setVocabMastered(0);
    setVocabReviewed(0);
    setPhase("vocab_drill");
  };

  const rateVocab = async (got_it: boolean) => {
    const newReviewed = vocabReviewed + 1;
    const newMastered = got_it ? vocabMastered + 1 : vocabMastered;
    setVocabReviewed(newReviewed);
    setVocabMastered(newMastered);

    if (vocabIndex + 1 < vocabCards.length) {
      setVocabIndex(vocabIndex + 1);
      setVocabRevealed(false);
    } else {
      // Done — save progress
      try {
        await api.completeSprintVocab(selectedDay, newReviewed, newMastered);
      } catch { /* ignore */ }
      // Refresh day detail
      try {
        const detail = await api.getSprintDay(selectedDay);
        setDayDetail(detail);
      } catch { /* ignore */ }
      setPhase("vocab_summary");
    }
  };

  // Speaking drill
  const startSpeakingDrill = async () => {
    setSpeakingQuestionIdx(0);
    setSpeakingScores([]);
    setSpeakingTranscript("");
    setSpeakingFeedback("");
    setSpeakingScore(null);
    setSpeakingImproved("");
    setRecordingBlobUrl(null);
    // Load questions for this day
    try {
      const qs = await api.getSprintDayQuestions(selectedDay);
      setSpeakingQuestions(qs);
    } catch {
      setSpeakingQuestions([]);
    }
    setPhase("speaking_drill_prep");
  };

  const startSpeakingRecord = async () => {
    setPhase("speaking_drill_record");
    await recorder.start();
  };

  const stopSpeakingRecord = useCallback(() => {
    recorder.stop();
  }, [recorder]);

  // Handle recording blob
  const prevBlobRef = useRef<Blob | null>(null);
  useEffect(() => {
    if (
      recorder.audioBlob &&
      recorder.audioBlob !== prevBlobRef.current &&
      phase === "speaking_drill_record"
    ) {
      prevBlobRef.current = recorder.audioBlob;
      // Store blob URL for playback
      if (recordingBlobUrl) URL.revokeObjectURL(recordingBlobUrl);
      setRecordingBlobUrl(URL.createObjectURL(recorder.audioBlob));
      uploadSpeakingRecording(recorder.audioBlob);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recorder.audioBlob, phase]);

  const uploadSpeakingRecording = async (blob: Blob) => {
    if (!dayDetail) return;
    setUploadingSpeaking(true);
    const q = speakingQuestions[speakingQuestionIdx % speakingQuestions.length];
    try {
      const result = await api.submitSpeakingRecording(
        blob,
        `sprint_day_${selectedDay}`,
        q?.id || `sprint_q${speakingQuestionIdx}`,
        dayDetail.speaking_task.onderdeel && dayDetail.speaking_task.onderdeel <= 1 ? "short" : "long",
        "sprint",
      );
      setSpeakingTranscript(result.transcript);
      setSpeakingFeedback(result.feedback?.feedback_en || "");
      setSpeakingImproved(result.feedback?.improved_answer || "");
      const score = result.score_pct ?? result.feedback?.score ?? 0;
      setSpeakingScore(score);
      setSpeakingScores((prev) => [...prev, score]);
      setPhase("speaking_drill_review");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Upload failed");
      setPhase("day_detail");
    } finally {
      setUploadingSpeaking(false);
    }
  };

  const reRecordSpeaking = () => {
    recorder.reset();
    prevBlobRef.current = null;
    if (recordingBlobUrl) URL.revokeObjectURL(recordingBlobUrl);
    setRecordingBlobUrl(null);
    setSpeakingTranscript("");
    setSpeakingFeedback("");
    setSpeakingImproved("");
    setSpeakingScore(null);
    // Remove last score since we're re-recording
    setSpeakingScores((prev) => prev.slice(0, -1));
    setPhase("speaking_drill_prep");
  };

  const nextSpeakingQuestion = async () => {
    recorder.reset();
    prevBlobRef.current = null;
    if (recordingBlobUrl) URL.revokeObjectURL(recordingBlobUrl);
    setRecordingBlobUrl(null);
    const total = dayDetail?.speaking_task.question_count ?? 4;
    if (speakingQuestionIdx + 1 < total) {
      setSpeakingQuestionIdx(speakingQuestionIdx + 1);
      setSpeakingTranscript("");
      setSpeakingFeedback("");
      setSpeakingScore(null);
      setPhase("speaking_drill_prep");
    } else {
      // Done — save progress
      const avgScore = speakingScores.length > 0
        ? Math.round(speakingScores.reduce((a, b) => a + b, 0) / speakingScores.length)
        : undefined;
      try {
        await api.completeSprintSpeaking(selectedDay, speakingScores.length, avgScore);
      } catch { /* ignore */ }
      try {
        const detail = await api.getSprintDay(selectedDay);
        setDayDetail(detail);
      } catch { /* ignore */ }
      setPhase("day_complete");
    }
  };

  const openStats = async () => {
    try {
      const s = await api.getSprintStats();
      setStats(s);
      setPhase("stats");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load stats");
    }
  };

  // ── Error display ──
  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
          <p className="text-red-600">{error}</p>
        </div>
        <button onClick={() => { setError(null); loadOverview(); }} className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white">
          Back
        </button>
      </div>
    );
  }

  // ── Render ──
  switch (phase) {
    case "loading":
      return (
        <div className="p-6 flex items-center justify-center min-h-[300px]">
          <div className="animate-spin w-8 h-8 border-2 border-orange-400 border-t-transparent rounded-full" />
        </div>
      );

    case "activate":
      return <ActivateView onActivate={activate} />;

    case "overview":
      return overview ? (
        <OverviewView
          data={overview}
          onSelectDay={openDay}
          onStats={openStats}
        />
      ) : null;

    case "day_detail":
      return dayDetail ? (
        <DayDetailView
          data={dayDetail}
          onStartVocab={startVocabDrill}
          onStartSpeaking={startSpeakingDrill}
          onStartMockExam={() => navigate("/study/speaking?spreken=oefenexamen_1")}
          onBack={() => { loadOverview(); setPhase("overview"); }}
        />
      ) : null;

    case "vocab_drill":
      return vocabCards.length > 0 ? (
        <VocabDrillView
          card={vocabCards[vocabIndex]}
          index={vocabIndex}
          total={vocabCards.length}
          revealed={vocabRevealed}
          onReveal={() => setVocabRevealed(true)}
          onRate={rateVocab}
          mastered={vocabMastered}
          reviewed={vocabReviewed}
          onBack={() => setPhase("day_detail")}
        />
      ) : null;

    case "vocab_summary":
      return (
        <VocabSummaryView
          cards={vocabCards}
          mastered={vocabMastered}
          reviewed={vocabReviewed}
          onBack={() => setPhase("day_detail")}
        />
      );

    case "speaking_drill_prep": {
      const q = speakingQuestions[speakingQuestionIdx % Math.max(speakingQuestions.length, 1)];
      return dayDetail ? (
        <SpeakingPrepView
          dayDetail={dayDetail}
          questionIdx={speakingQuestionIdx}
          question={q}
          onStart={startSpeakingRecord}
          onBack={() => setPhase("day_detail")}
        />
      ) : null;
    }

    case "speaking_drill_record": {
      const q2 = speakingQuestions[speakingQuestionIdx % Math.max(speakingQuestions.length, 1)];
      return dayDetail ? (
        <SpeakingRecordView
          dayDetail={dayDetail}
          questionIdx={speakingQuestionIdx}
          question={q2}
          recorder={recorder}
          uploading={uploadingSpeaking}
          onStop={stopSpeakingRecord}
          onBack={() => { recorder.stop(); recorder.reset(); setPhase("day_detail"); }}
        />
      ) : null;
    }

    case "speaking_drill_review": {
      const q3 = speakingQuestions[speakingQuestionIdx % Math.max(speakingQuestions.length, 1)];
      return (
        <SpeakingReviewView
          transcript={speakingTranscript}
          feedback={speakingFeedback}
          improved={speakingImproved}
          score={speakingScore}
          questionIdx={speakingQuestionIdx}
          total={dayDetail?.speaking_task.question_count ?? 4}
          recordingUrl={recordingBlobUrl}
          modelAnswer={q3?.model_answer}
          onNext={nextSpeakingQuestion}
          onReRecord={reRecordSpeaking}
        />
      );
    }

    case "day_complete":
      return (
        <DayCompleteView
          day={selectedDay}
          vocabReviewed={vocabReviewed}
          vocabMastered={vocabMastered}
          speakingScores={speakingScores}
          onBack={() => { loadOverview(); setPhase("overview"); }}
        />
      );

    case "stats":
      return stats ? (
        <StatsView data={stats} onBack={() => { loadOverview(); setPhase("overview"); }} />
      ) : null;

    default:
      return null;
  }
}


// ── Activate View ────────────────────────────────────────────────────────────

function ActivateView({ onActivate }: { onActivate: () => void }) {
  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <div className="text-6xl mb-4">🔥</div>
        <h1 className="text-3xl font-bold text-slate-800 mb-2">Spreken Sprint</h1>
        <p className="text-slate-400">20-day crash course to pass the A2 speaking exam</p>
      </div>

      <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 mb-6">
        <h2 className="text-white font-bold mb-4">What you'll get:</h2>
        <div className="space-y-3">
          <div className="flex gap-3">
            <span className="text-orange-400 font-bold">400</span>
            <span className="text-slate-300">exam-focused vocabulary words & phrases</span>
          </div>
          <div className="flex gap-3">
            <span className="text-orange-400 font-bold">20</span>
            <span className="text-slate-300">days of structured practice plan</span>
          </div>
          <div className="flex gap-3">
            <span className="text-orange-400 font-bold">4</span>
            <span className="text-slate-300">exam parts (onderdelen) covered</span>
          </div>
          <div className="flex gap-3">
            <span className="text-orange-400 font-bold">3</span>
            <span className="text-slate-300">full mock exams in Phase 3</span>
          </div>
        </div>
      </div>

      <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 mb-6">
        <h2 className="text-white font-bold mb-3">3 Phases:</h2>
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-blue-500" />
            <span className="text-slate-300"><b className="text-white">Days 1-7</b> Foundation — core vocab + short answers</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-purple-500" />
            <span className="text-slate-300"><b className="text-white">Days 8-14</b> Role Play — longer answers + comparing</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-orange-500" />
            <span className="text-slate-300"><b className="text-white">Days 15-20</b> Mock Exams — full simulation + weak areas</span>
          </div>
        </div>
      </div>

      <button
        onClick={onActivate}
        className="w-full py-4 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-bold text-lg transition-all"
      >
        Start 20-Day Sprint
      </button>
    </div>
  );
}


// ── Overview View (20-day calendar) ──────────────────────────────────────────

function OverviewView({
  data, onSelectDay, onStats,
}: {
  data: api.SprintOverview;
  onSelectDay: (day: number) => void;
  onStats: () => void;
}) {
  const completedPct = Math.round((data.completed_count / 20) * 100);

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            🔥 Spreken Sprint
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            {data.active
              ? `Day ${data.current_day} of 20 — ${data.days_remaining} days left`
              : data.current_day > 20
                ? "Sprint completed!"
                : "Sprint not active"}
          </p>
        </div>
        <button
          onClick={onStats}
          className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-sm"
        >
          Stats
        </button>
      </div>

      {/* Progress bar */}
      <div className="mb-6">
        <div className="flex justify-between text-xs text-slate-400 mb-1">
          <span>{data.completed_count}/20 days done</span>
          <span>{completedPct}%</span>
        </div>
        <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-orange-500 to-red-500 rounded-full transition-all"
            style={{ width: `${completedPct}%` }}
          />
        </div>
      </div>

      {/* Phase headers + day grid */}
      {[1, 2, 3].map((phaseNum) => {
        const phaseDays = data.days.filter((d) => d.phase === phaseNum);
        const phaseColors = { 1: "blue", 2: "purple", 3: "orange" } as const;
        const color = phaseColors[phaseNum as 1 | 2 | 3];
        const phaseNames = { 1: "Foundation / 基础", 2: "Role Play / 角色扮演", 3: "Mock Exams / 模拟考试" };

        return (
          <div key={phaseNum} className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <span className={`w-3 h-3 rounded-full bg-${color}-500`} />
              <h2 className="text-sm font-bold text-slate-300">
                Phase {phaseNum}: {phaseNames[phaseNum as 1 | 2 | 3]}
              </h2>
            </div>
            <div className="grid grid-cols-7 gap-2">
              {phaseDays.map((d) => (
                <button
                  key={d.day}
                  onClick={() => onSelectDay(d.day)}
                  className={`relative rounded-lg p-3 text-center transition-all border ${
                    d.is_current
                      ? `bg-${color}-600/30 border-${color}-500 ring-2 ring-${color}-400/50`
                      : d.completed
                        ? "bg-green-900/30 border-green-700/50"
                        : d.is_past
                          ? "bg-amber-900/20 border-amber-700/30"
                          : "bg-slate-800 border-slate-700 hover:border-slate-600"
                  }`}
                >
                  <div className={`text-lg font-bold ${
                    d.is_current ? "text-white" : d.completed ? "text-green-400" : "text-slate-400"
                  }`}>
                    {d.day}
                  </div>
                  <div className="text-[10px] text-slate-500 truncate mt-1">
                    {d.headline_zh?.slice(0, 4) || d.headline_en?.slice(0, 8)}
                  </div>
                  {d.completed && (
                    <span className="absolute top-1 right-1 text-green-400 text-xs">✓</span>
                  )}
                  {d.is_current && !d.completed && (
                    <span className="absolute top-1 right-1 w-2 h-2 bg-orange-400 rounded-full animate-pulse" />
                  )}
                  {d.speaking_avg_score !== null && (
                    <div className={`text-[10px] mt-0.5 ${
                      d.speaking_avg_score >= 70 ? "text-green-400" : d.speaking_avg_score >= 50 ? "text-blue-400" : "text-red-400"
                    }`}>
                      {d.speaking_avg_score}%
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}


// ── Day Detail View ──────────────────────────────────────────────────────────

function DayDetailView({
  data, onStartVocab, onStartSpeaking, onStartMockExam, onBack,
}: {
  data: api.SprintDayDetail;
  onStartVocab: () => void;
  onStartSpeaking: () => void;
  onStartMockExam: () => void;
  onBack: () => void;
}) {
  const phaseColors = { 1: "blue", 2: "purple", 3: "orange" } as const;
  const color = phaseColors[(data.phase as 1 | 2 | 3)] || "blue";
  const vocabDone = data.progress.vocab_reviewed > 0;
  const speakingDone = data.progress.speaking_sessions > 0;

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <button onClick={onBack} className="text-blue-400 hover:text-blue-300 text-sm mb-4">
        &larr; Back to Overview
      </button>

      <div className="flex items-center gap-3 mb-2">
        <span className={`px-2 py-0.5 rounded-full text-xs font-bold bg-${color}-500/20 text-${color}-400`}>
          Phase {data.phase}
        </span>
        <span className="text-slate-500 text-sm">{data.target_minutes} min</span>
      </div>

      <h1 className="text-2xl font-bold text-slate-800 mb-1">Day {data.day}</h1>
      <p className="text-slate-400 mb-6">{data.headline_zh} / {data.headline_en}</p>

      {/* Vocab card */}
      <div className={`bg-slate-800 rounded-xl p-5 border mb-4 ${vocabDone ? "border-green-700/50" : "border-slate-700"}`}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-white font-bold flex items-center gap-2">
              📖 Vocabulary
              {vocabDone && <span className="text-green-400 text-sm">✓</span>}
            </h2>
            <p className="text-slate-400 text-sm">
              {data.vocab_total} words — {data.vocab_topics.join(", ")}
            </p>
          </div>
          {vocabDone && (
            <span className="text-xs text-green-400">
              {data.progress.vocab_mastered}/{data.progress.vocab_reviewed} mastered
            </span>
          )}
        </div>
        <button
          onClick={onStartVocab}
          className={`w-full py-3 rounded-lg font-medium transition-colors ${
            vocabDone
              ? "bg-slate-700 hover:bg-slate-600 text-slate-300"
              : "bg-blue-600 hover:bg-blue-700 text-white"
          }`}
        >
          {vocabDone ? "Review Again" : "Start Vocab Drill"}
        </button>
      </div>

      {/* Speaking card */}
      <div className={`bg-slate-800 rounded-xl p-5 border mb-4 ${speakingDone ? "border-green-700/50" : "border-slate-700"}`}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-white font-bold flex items-center gap-2">
              🎙️ Speaking Practice
              {speakingDone && <span className="text-green-400 text-sm">✓</span>}
            </h2>
            <p className="text-slate-400 text-sm">
              {data.speaking_task.description_zh}
            </p>
          </div>
          {data.progress.speaking_avg_score !== null && (
            <span className={`text-sm font-bold ${
              data.progress.speaking_avg_score >= 70 ? "text-green-400" : "text-blue-400"
            }`}>
              {data.progress.speaking_avg_score}%
            </span>
          )}
        </div>
        {data.speaking_task.type === "mock_exam" ? (
          <button
            onClick={onStartMockExam}
            className="w-full py-3 rounded-lg font-medium transition-colors bg-red-600 hover:bg-red-700 text-white"
          >
            Start Full Mock Exam
          </button>
        ) : data.speaking_task.type === "listen_only" ? (
          <p className="text-slate-500 text-sm text-center py-3">Rest day — no recording today</p>
        ) : (
          <button
            onClick={onStartSpeaking}
            className={`w-full py-3 rounded-lg font-medium transition-colors ${
              speakingDone
                ? "bg-slate-700 hover:bg-slate-600 text-slate-300"
                : "bg-orange-600 hover:bg-orange-700 text-white"
            }`}
          >
            {speakingDone ? "Practice Again" : "Start Speaking Drill"}
          </button>
        )}
      </div>

      {/* Tip */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
        <h3 className="text-slate-400 text-xs font-bold mb-1">TIP</h3>
        <p className="text-slate-300 text-sm">{data.tip_zh}</p>
        <p className="text-slate-500 text-xs mt-1">{data.tip_en}</p>
      </div>
    </div>
  );
}


// ── Vocab Drill View ─────────────────────────────────────────────────────────

function VocabDrillView({
  card, index, total, revealed, onReveal, onRate, mastered, reviewed, onBack,
}: {
  card: VocabCard;
  index: number;
  total: number;
  revealed: boolean;
  onReveal: () => void;
  onRate: (got_it: boolean) => void;
  mastered: number;
  reviewed: number;
  onBack: () => void;
}) {
  // Auto-play audio when new card appears
  useEffect(() => {
    if (card.audio_file) {
      const audio = new Audio(vocabAudioUrl(card.audio_file));
      audio.play().catch(() => {});
    }
  }, [card.dutch, card.audio_file]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.code === "Space" && !e.repeat) {
        e.preventDefault();
        if (!revealed) onReveal();
      }
      if (revealed && e.code === "ArrowRight") {
        e.preventDefault();
        onRate(true);
      }
      if (revealed && e.code === "ArrowLeft") {
        e.preventDefault();
        onRate(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [revealed, onReveal, onRate]);

  const priorityLabel = { 1: "Must-know", 2: "Important", 3: "Nice-to-have" }[card.priority] || "";
  const priorityColor = { 1: "text-red-400", 2: "text-blue-400", 3: "text-slate-400" }[card.priority] || "";

  return (
    <div className="p-6 max-w-2xl mx-auto flex flex-col items-center">
      <button onClick={onBack} className="self-start text-blue-400 hover:text-blue-300 text-sm mb-4">
        &larr; Back
      </button>

      {/* Progress */}
      <div className="w-full flex items-center justify-between text-xs text-slate-500 mb-2">
        <span>{index + 1} / {total}</span>
        <span>{mastered} mastered</span>
      </div>
      <div className="w-full h-1.5 bg-slate-700 rounded-full mb-6 overflow-hidden">
        <div
          className="h-full bg-blue-500 rounded-full transition-all"
          style={{ width: `${((index + 1) / total) * 100}%` }}
        />
      </div>

      {/* Card */}
      <div
        onClick={() => !revealed && onReveal()}
        className={`w-full bg-slate-800 rounded-2xl p-8 border border-slate-700 mb-6 cursor-pointer transition-all ${
          !revealed ? "hover:border-blue-500/50" : ""
        }`}
      >
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs text-slate-500">{card.topic.replace(/_/g, " ")}</span>
          <span className={`text-xs ${priorityColor}`}>{priorityLabel}</span>
        </div>

        {/* Dutch phrase — always visible */}
        <div className="text-center mb-6">
          <p className="text-2xl font-bold text-white mb-2">{card.dutch}</p>
          {card.audio_file && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                new Audio(vocabAudioUrl(card.audio_file!)).play();
              }}
              className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 text-sm mt-1"
            >
              🔊 Play
            </button>
          )}
          <p className="text-slate-500 text-sm italic mt-2">Say it aloud!</p>
        </div>

        {/* English + example — revealed */}
        {revealed ? (
          <div className="border-t border-slate-700 pt-4 mt-4">
            <p className="text-lg text-blue-300 text-center mb-3">{card.english}</p>
            <p className="text-sm text-slate-400 text-center">{card.example_sentence}</p>
          </div>
        ) : (
          <div className="text-center text-slate-600 text-sm">
            Tap or press <kbd className="px-1.5 py-0.5 bg-slate-700 rounded text-slate-400 text-xs font-mono">Space</kbd> to reveal
          </div>
        )}
      </div>

      {/* Rate buttons */}
      {revealed && (
        <div className="flex gap-3 w-full">
          <button
            onClick={() => onRate(false)}
            className="flex-1 py-3 rounded-lg bg-red-600/20 hover:bg-red-600/30 text-red-400 font-medium border border-red-700/30"
          >
            Need Practice ←
          </button>
          <button
            onClick={() => onRate(true)}
            className="flex-1 py-3 rounded-lg bg-green-600/20 hover:bg-green-600/30 text-green-400 font-medium border border-green-700/30"
          >
            Got It →
          </button>
        </div>
      )}
    </div>
  );
}


// ── Vocab Summary View ───────────────────────────────────────────────────────

function VocabSummaryView({
  cards, mastered, reviewed, onBack,
}: {
  cards: VocabCard[];
  mastered: number;
  reviewed: number;
  onBack: () => void;
}) {
  // Filter to must-know (priority 1) and important (priority 2) only
  const keyCards = cards.filter((c) => c.priority <= 2);

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Vocab Summary</h1>
          <p className="text-slate-400 text-sm">
            {mastered}/{reviewed} mastered — {keyCards.length} key phrases
          </p>
        </div>
        <button
          onClick={onBack}
          className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm"
        >
          Done
        </button>
      </div>

      <div className="space-y-1">
        {keyCards.map((card, i) => (
          <div
            key={i}
            className="bg-slate-800 rounded-lg p-3 border border-slate-700 flex items-start gap-3"
          >
            {/* Play button */}
            {card.audio_file && (
              <button
                onClick={() => new Audio(vocabAudioUrl(card.audio_file!)).play()}
                className="mt-1 shrink-0 w-8 h-8 rounded-full bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 flex items-center justify-center text-sm"
              >
                🔊
              </button>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-white font-medium">{card.dutch}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                  card.priority === 1 ? "bg-red-500/20 text-red-400" : "bg-blue-500/20 text-blue-400"
                }`}>
                  {card.priority === 1 ? "Must-know" : "Important"}
                </span>
              </div>
              <p className="text-blue-300 text-sm">{card.english}</p>
              <p className="text-slate-500 text-xs mt-0.5">{card.example_sentence}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 text-center">
        <button
          onClick={onBack}
          className="px-8 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium"
        >
          Back to Day
        </button>
      </div>
    </div>
  );
}


// ── Speaking Prep View ───────────────────────────────────────────────────────

function SpeakingPrepView({
  dayDetail, questionIdx, question, onStart, onBack,
}: {
  dayDetail: api.SprintDayDetail;
  questionIdx: number;
  question?: any;
  onStart: () => void;
  onBack: () => void;
}) {
  const total = dayDetail.speaking_task.question_count;
  const onderdeel = dayDetail.speaking_task.onderdeel;
  const onderdeelNames: Record<number, string> = {
    1: "Vragen beantwoorden (Short Answers)",
    2: "Fotoalbum (Photo Description)",
    3: "Roltaken (Role Play)",
    4: "Vergelijken en kiezen (Compare & Choose)",
  };

  return (
    <div className="p-6 max-w-2xl mx-auto flex flex-col items-center">
      <button onClick={onBack} className="self-start text-blue-400 hover:text-blue-300 text-sm mb-4">
        &larr; Back
      </button>

      <div className="text-xs text-slate-500 mb-2">
        Question {questionIdx + 1} of {total}
        {onderdeel && <span> — Onderdeel {onderdeel}: {onderdeelNames[onderdeel] || ""}</span>}
      </div>

      {/* Question prompt */}
      {question ? (
        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 w-full mb-6">
          <div className="mb-3">
            <p className="text-slate-400 text-xs font-medium mb-1">Situatie</p>
            <p className="text-white">{question.situatie_nl}</p>
            <p className="text-slate-500 text-sm">{question.situatie_en}</p>
          </div>
          <div className="mb-3">
            <p className="text-slate-400 text-xs font-medium mb-1">Vraag</p>
            <p className="text-white text-lg font-medium">{question.vraag_nl}</p>
            <p className="text-slate-500 text-sm">{question.vraag_en}</p>
          </div>
          {question.tips && question.tips.length > 0 && (
            <div className="border-t border-slate-700 pt-3 mt-3">
              <p className="text-slate-400 text-xs font-medium mb-1">Tips</p>
              <ul className="text-slate-300 text-sm space-y-0.5">
                {question.tips.map((tip: string, i: number) => (
                  <li key={i}>• {tip}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 w-full mb-6">
          <p className="text-slate-300 text-sm">{dayDetail.speaking_task.description_zh}</p>
          <p className="text-slate-500 text-xs mt-1">{dayDetail.speaking_task.description_en}</p>
        </div>
      )}

      <CountdownTimer
        seconds={question?.prep_seconds ?? 30}
        onComplete={onStart}
        label="Preparation time"
        color="#3b82f6"
      />

      <button
        onClick={onStart}
        className="mt-4 px-8 py-3 rounded-lg bg-orange-600 hover:bg-orange-700 text-white font-medium"
      >
        Start Recording Now
      </button>
    </div>
  );
}


// ── Speaking Record View ─────────────────────────────────────────────────────

function SpeakingRecordView({
  dayDetail, questionIdx, question, recorder, uploading, onStop, onBack,
}: {
  dayDetail: api.SprintDayDetail;
  questionIdx: number;
  question?: any;
  recorder: ReturnType<typeof useAudioRecorder>;
  uploading: boolean;
  onStop: () => void;
  onBack: () => void;
}) {
  const seconds = question?.record_seconds ?? (dayDetail.speaking_task.onderdeel === 1 ? 30 : 60);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.code === "Space" && !e.repeat) {
        e.preventDefault();
        onStop();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onStop]);

  if (uploading) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[300px]">
        <div className="animate-spin w-8 h-8 border-2 border-orange-400 border-t-transparent rounded-full mb-4" />
        <p className="text-slate-400">Analyzing your recording...</p>
      </div>
    );
  }

  if (recorder.permissionDenied || recorder.error) {
    return (
      <div className="p-6 max-w-2xl mx-auto text-center">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h2 className="text-lg font-bold text-red-600 mb-2">Microphone Error</h2>
          <p className="text-slate-500 mb-4">{recorder.error ?? "Please allow microphone access."}</p>
          <button onClick={onBack} className="px-6 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white">Back</button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl mx-auto flex flex-col items-center">
      <div className="text-xs text-slate-500 mb-4">
        Question {questionIdx + 1} of {dayDetail.speaking_task.question_count}
      </div>

      {/* Show question during recording */}
      {question && (
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 w-full mb-4">
          <p className="text-white font-medium">{question.vraag_nl}</p>
          <p className="text-slate-500 text-sm">{question.vraag_en}</p>
        </div>
      )}

      <div className="flex items-center gap-3 mb-4">
        <span className="w-4 h-4 bg-red-500 rounded-full animate-pulse" />
        <span className="text-red-500 font-medium">Recording...</span>
      </div>

      <CountdownTimer
        seconds={seconds}
        onComplete={onStop}
        label="Recording time"
        color="#ef4444"
      />

      <p className="text-slate-500 text-xs mt-4">
        Press <kbd className="px-1.5 py-0.5 bg-slate-200 rounded text-slate-700 text-xs font-mono">Space</kbd> to stop
      </p>

      <div className="mt-4 flex gap-3">
        <button onClick={onBack} className="px-6 py-3 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300">Cancel</button>
        <button onClick={onStop} className="px-8 py-3 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold">Stop</button>
      </div>
    </div>
  );
}


// ── Speaking Review View ─────────────────────────────────────────────────────

function SpeakingReviewView({
  transcript, feedback, improved, score, questionIdx, total, recordingUrl, modelAnswer, onNext, onReRecord,
}: {
  transcript: string;
  feedback: string;
  improved: string;
  score: number | null;
  questionIdx: number;
  total: number;
  recordingUrl: string | null;
  modelAnswer?: string;
  onNext: () => void;
  onReRecord: () => void;
}) {
  const scoreColor = score && score >= 70 ? "text-green-400" : score && score >= 50 ? "text-blue-400" : "text-red-400";
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const playRecording = () => {
    if (!recordingUrl) return;
    if (audioRef.current) audioRef.current.pause();
    const audio = new Audio(recordingUrl);
    audioRef.current = audio;
    audio.onended = () => setPlaying(false);
    setPlaying(true);
    audio.play();
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="text-xs text-slate-500 mb-4">
        Question {questionIdx + 1} of {total}
      </div>

      {score !== null && (
        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 mb-4 text-center">
          <div className={`text-4xl font-bold ${scoreColor} mb-1`}>{score}%</div>
          <div className="text-sm text-slate-400">Score</div>
        </div>
      )}

      {/* Playback */}
      {recordingUrl && (
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 mb-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-slate-400">Your Recording</h3>
            <button
              onClick={playRecording}
              className={`px-3 py-1 rounded-full text-sm ${
                playing ? "bg-blue-500/20 text-blue-400 animate-pulse" : "bg-blue-600/20 hover:bg-blue-600/30 text-blue-400"
              }`}
            >
              {playing ? "Playing..." : "🔊 Play"}
            </button>
          </div>
        </div>
      )}

      <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 mb-4">
        <h3 className="text-sm font-medium text-slate-400 mb-2">What you said</h3>
        <p className="text-white">{transcript || "(no speech detected)"}</p>
      </div>

      {feedback && (
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 mb-4">
          <h3 className="text-sm font-medium text-slate-400 mb-2">Feedback</h3>
          <p className="text-slate-300 text-sm">{feedback}</p>
        </div>
      )}

      {improved && (
        <div className="bg-slate-800 rounded-xl p-4 border border-green-700/30 mb-4">
          <h3 className="text-sm font-medium text-green-400 mb-2">Improved Version</h3>
          <p className="text-green-300 text-sm">{improved}</p>
        </div>
      )}

      {modelAnswer && (
        <div className="bg-slate-800 rounded-xl p-4 border border-blue-700/30 mb-4">
          <h3 className="text-sm font-medium text-blue-400 mb-2">Model Answer</h3>
          <p className="text-blue-300 text-sm">{modelAnswer}</p>
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={onReRecord}
          className="flex-1 py-3 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-medium"
        >
          Re-record
        </button>
        <button
          onClick={onNext}
          className="flex-1 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium"
        >
          {questionIdx + 1 < total ? "Next Question" : "Finish Speaking Drill"}
        </button>
      </div>
    </div>
  );
}


// ── Day Complete View ────────────────────────────────────────────────────────

function DayCompleteView({
  day, vocabReviewed, vocabMastered, speakingScores, onBack,
}: {
  day: number;
  vocabReviewed: number;
  vocabMastered: number;
  speakingScores: number[];
  onBack: () => void;
}) {
  const avgScore = speakingScores.length > 0
    ? Math.round(speakingScores.reduce((a, b) => a + b, 0) / speakingScores.length)
    : null;

  return (
    <div className="p-6 max-w-2xl mx-auto text-center">
      <div className="text-6xl mb-4">🎉</div>
      <h1 className="text-2xl font-bold text-white mb-2">Day {day} Complete!</h1>
      <p className="text-slate-400 mb-8">Great work today. Keep the momentum going!</p>

      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
          <div className="text-3xl font-bold text-blue-400">{vocabMastered}/{vocabReviewed}</div>
          <div className="text-sm text-slate-400">Vocab mastered</div>
        </div>
        {avgScore !== null && (
          <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
            <div className={`text-3xl font-bold ${avgScore >= 70 ? "text-green-400" : "text-blue-400"}`}>
              {avgScore}%
            </div>
            <div className="text-sm text-slate-400">Speaking avg</div>
          </div>
        )}
      </div>

      {day < 20 && (
        <p className="text-slate-500 text-sm mb-4">
          Tomorrow: Day {day + 1}
        </p>
      )}

      <button
        onClick={onBack}
        className="px-8 py-3 rounded-lg bg-orange-600 hover:bg-orange-700 text-white font-medium"
      >
        Back to Overview
      </button>
    </div>
  );
}


// ── Stats View ───────────────────────────────────────────────────────────────

function StatsView({
  data, onBack,
}: {
  data: api.SprintStats;
  onBack: () => void;
}) {
  return (
    <div className="p-6 max-w-2xl mx-auto">
      <button onClick={onBack} className="text-blue-400 hover:text-blue-300 text-sm mb-4">
        &larr; Back
      </button>
      <h1 className="text-2xl font-bold text-slate-800 mb-6">Sprint Statistics</h1>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 text-center">
          <div className="text-3xl font-bold text-orange-400">{data.days_completed}/20</div>
          <div className="text-xs text-slate-400">Days completed</div>
        </div>
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 text-center">
          <div className="text-3xl font-bold text-blue-400">{data.total_vocab_mastered}</div>
          <div className="text-xs text-slate-400">Words mastered</div>
        </div>
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 text-center">
          <div className="text-3xl font-bold text-green-400">{data.total_speaking_sessions}</div>
          <div className="text-xs text-slate-400">Speaking sessions</div>
        </div>
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 text-center">
          <div className={`text-3xl font-bold ${
            data.avg_speaking_score && data.avg_speaking_score >= 70 ? "text-green-400" : "text-blue-400"
          }`}>
            {data.avg_speaking_score ?? "—"}%
          </div>
          <div className="text-xs text-slate-400">Avg speaking score</div>
        </div>
      </div>

      {/* Phase scores */}
      <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 mb-6">
        <h2 className="text-white font-bold mb-3">Score by Phase</h2>
        <div className="space-y-2">
          {[
            { phase: 1, name: "Foundation", color: "bg-blue-500" },
            { phase: 2, name: "Role Play", color: "bg-purple-500" },
            { phase: 3, name: "Mock Exams", color: "bg-orange-500" },
          ].map(({ phase, name, color }) => {
            const score = data.phase_avg_scores[phase];
            return (
              <div key={phase} className="flex items-center gap-3">
                <span className={`w-3 h-3 rounded-full ${color}`} />
                <span className="text-slate-300 text-sm flex-1">{name}</span>
                <span className="text-slate-400 text-sm">{score !== null ? `${score}%` : "—"}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Score trend */}
      {data.score_trend.length > 0 && (
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
          <h2 className="text-white font-bold mb-3">Score Trend</h2>
          <div className="flex items-end gap-1 h-24">
            {data.score_trend.map(({ day, score }) => (
              <div key={day} className="flex-1 flex flex-col items-center">
                <div
                  className={`w-full rounded-t ${score >= 70 ? "bg-green-500" : score >= 50 ? "bg-blue-500" : "bg-red-500"}`}
                  style={{ height: `${score}%` }}
                />
                <span className="text-[9px] text-slate-500 mt-1">{day}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
