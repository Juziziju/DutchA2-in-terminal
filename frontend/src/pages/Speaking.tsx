import { useCallback, useEffect, useRef, useState } from "react";
import CountdownTimer from "../components/CountdownTimer";
import { useAudioRecorder } from "../hooks/useAudioRecorder";
import * as api from "../api";

// ── Types ────────────────────────────────────────────────────────────────────

type Phase =
  | "home"
  | "scene_list"
  | "scene_detail"
  | "practice_setup"
  | "prep"
  | "recording"
  | "uploading"
  | "review";

interface CurrentQuestion extends api.SpeakingQuestion {
  question_type: "short" | "long";
}

// ── Main component ──────────────────────────────────────────────────────────

export default function Speaking() {
  const [phase, setPhase] = useState<Phase>("home");
  const [scenes, setScenes] = useState<api.SpeakingSceneSummary[]>([]);
  const [selectedScene, setSelectedScene] = useState<api.SpeakingSceneDetail | null>(null);
  const [questions, setQuestions] = useState<CurrentQuestion[]>([]);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [currentSceneId, setCurrentSceneId] = useState("");
  const [reviewData, setReviewData] = useState<api.SpeakingSubmitResponse | null>(null);
  const [history, setHistory] = useState<api.SpeakingHistoryItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const recorder = useAudioRecorder();

  const loadScenes = useCallback(async () => {
    try {
      const data = await api.getSpeakingScenes();
      setScenes(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load scenes");
    }
  }, []);

  useEffect(() => {
    loadScenes();
  }, [loadScenes]);

  const currentQuestion = questions[questionIndex] ?? null;

  // ── Navigation helpers ──────────────────────────────────────────────────

  const goHome = () => {
    setPhase("home");
    setError(null);
    loadScenes();
  };

  const openSceneList = () => {
    setPhase("scene_list");
    loadScenes();
  };

  const openSceneDetail = async (sceneId: string) => {
    setLoading(true);
    try {
      const detail = await api.getSpeakingSceneDetail(sceneId);
      setSelectedScene(detail);
      setCurrentSceneId(sceneId);
      setPhase("scene_detail");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  };

  const openPracticeSetup = () => {
    setPhase("practice_setup");
    loadScenes();
  };

  const startPractice = async (sceneId: string, filter: "all" | "short" | "long") => {
    setLoading(true);
    try {
      const qs = await api.getSpeakingQuestions(sceneId);
      let list: CurrentQuestion[] = [];
      if (filter !== "long") {
        list.push(...qs.short.map((q) => ({ ...q, question_type: "short" as const })));
      }
      if (filter !== "short") {
        list.push(...qs.long.map((q) => ({ ...q, question_type: "long" as const })));
      }
      if (list.length === 0) {
        setError("No questions available");
        setLoading(false);
        return;
      }
      setQuestions(list);
      setQuestionIndex(0);
      setCurrentSceneId(sceneId);
      setPhase("prep");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  };

  const startRecording = async () => {
    setPhase("recording");
    await recorder.start();
  };

  const finishRecording = useCallback(() => {
    recorder.stop();
  }, [recorder]);

  // After recorder.stop(), audioBlob updates → trigger upload
  const prevBlobRef = useRef<Blob | null>(null);
  useEffect(() => {
    if (recorder.audioBlob && recorder.audioBlob !== prevBlobRef.current && phase === "recording") {
      prevBlobRef.current = recorder.audioBlob;
      uploadRecording(recorder.audioBlob);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recorder.audioBlob, phase]);

  const uploadRecording = async (blob: Blob) => {
    if (!currentQuestion) return;
    setPhase("uploading");
    try {
      const result = await api.submitSpeakingRecording(
        blob,
        currentSceneId,
        currentQuestion.id,
        currentQuestion.question_type,
        "scene_drill",
      );
      setReviewData(result);
      setPhase("review");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Upload failed");
      setPhase("home");
    }
  };

  const nextQuestion = () => {
    recorder.reset();
    prevBlobRef.current = null;
    if (questionIndex + 1 < questions.length) {
      setQuestionIndex(questionIndex + 1);
      setPhase("prep");
    } else {
      goHome();
    }
  };

  const reRecord = () => {
    recorder.reset();
    prevBlobRef.current = null;
    setPhase("prep");
  };

  const loadHistory = async () => {
    try {
      const h = await api.getSpeakingHistory();
      setHistory(h);
    } catch { /* ignore */ }
  };

  // ── Render ──────────────────────────────────────────────────────────────

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-900/30 border border-red-500/50 rounded-lg p-4 mb-4">
          <p className="text-red-300">{error}</p>
        </div>
        <button onClick={() => { setError(null); goHome(); }} className="btn-primary">
          Back to Speaking
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[300px]">
        <div className="animate-spin w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full" />
      </div>
    );
  }

  switch (phase) {
    case "home":
      return <SpeakingHome scenes={scenes} onBlock1={openSceneList} onBlock2={openPracticeSetup} onBlock3={() => { loadHistory(); setPhase("review"); }} history={history} loadHistory={loadHistory} />;
    case "scene_list":
      return <SceneListView scenes={scenes} onSelect={openSceneDetail} onBack={goHome} />;
    case "scene_detail":
      return selectedScene ? <SceneDetailView scene={selectedScene} onBack={openSceneList} /> : null;
    case "practice_setup":
      return <PracticeSetupView scenes={scenes} onStart={startPractice} onBack={goHome} />;
    case "prep":
      return currentQuestion ? <PrepView question={currentQuestion} questionNum={questionIndex + 1} total={questions.length} onComplete={startRecording} onBack={goHome} /> : null;
    case "recording":
      return currentQuestion ? <RecordingView question={currentQuestion} recorder={recorder} onStop={finishRecording} /> : null;
    case "uploading":
      return <UploadingView />;
    case "review":
      return reviewData ? <ReviewView data={reviewData} question={currentQuestion} onNext={nextQuestion} onReRecord={reRecord} onHome={goHome} hasMore={questionIndex + 1 < questions.length} /> : <HistoryView history={history} onBack={goHome} loadHistory={loadHistory} />;
    default:
      return null;
  }
}


// ── Sub-views ───────────────────────────────────────────────────────────────

function SpeakingHome({
  scenes, onBlock1, onBlock2, onBlock3, history, loadHistory,
}: {
  scenes: api.SpeakingSceneSummary[];
  onBlock1: () => void;
  onBlock2: () => void;
  onBlock3: () => void;
  history: api.SpeakingHistoryItem[];
  loadHistory: () => void;
}) {
  useEffect(() => { loadHistory(); }, [loadHistory]);
  const totalAttempts = scenes.reduce((s, sc) => s + sc.attempts, 0);
  const avgScore = scenes.filter(s => s.avg_score !== null).length > 0
    ? Math.round(scenes.filter(s => s.avg_score !== null).reduce((s, sc) => s + (sc.avg_score ?? 0), 0) / scenes.filter(s => s.avg_score !== null).length)
    : null;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-6">Speaking Practice</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Block 1 */}
        <button onClick={onBlock1} className="bg-slate-800 hover:bg-slate-700 rounded-xl p-6 text-left transition-colors border border-slate-700">
          <div className="text-3xl mb-3">📖</div>
          <h2 className="text-lg font-bold text-white mb-1">Scene Input</h2>
          <p className="text-sm text-slate-400 mb-3">Learn vocabulary and model sentences for each exam scene</p>
          <div className="text-xs text-slate-500">{scenes.length} scenes available</div>
        </button>
        {/* Block 2 */}
        <button onClick={onBlock2} className="bg-slate-800 hover:bg-slate-700 rounded-xl p-6 text-left transition-colors border border-slate-700">
          <div className="text-3xl mb-3">🎙️</div>
          <h2 className="text-lg font-bold text-white mb-1">Record Practice</h2>
          <p className="text-sm text-slate-400 mb-3">Practice speaking with timed recording, just like the real exam</p>
          <div className="text-xs text-slate-500">{totalAttempts} recordings done</div>
        </button>
      </div>
      {/* Block 3 */}
      <button onClick={onBlock3} className="w-full bg-slate-800 hover:bg-slate-700 rounded-xl p-6 text-left transition-colors border border-slate-700">
        <div className="flex items-start gap-4">
          <div className="text-3xl">🤖</div>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-white mb-1">AI Review</h2>
            <p className="text-sm text-slate-400 mb-3">Review your past recordings with AI feedback</p>
            <div className="flex gap-4 text-xs text-slate-500">
              <span>{history.length} reviews</span>
              {avgScore !== null && <span>Avg score: {avgScore}%</span>}
            </div>
          </div>
        </div>
      </button>
    </div>
  );
}


function SceneListView({
  scenes, onSelect, onBack,
}: {
  scenes: api.SpeakingSceneSummary[];
  onSelect: (id: string) => void;
  onBack: () => void;
}) {
  return (
    <div className="p-6 max-w-3xl mx-auto">
      <button onClick={onBack} className="text-blue-400 hover:text-blue-300 text-sm mb-4">
        ← Back
      </button>
      <h1 className="text-2xl font-bold text-white mb-6">Exam Scenes</h1>
      <div className="space-y-3">
        {scenes.map((s) => (
          <button
            key={s.id}
            onClick={() => s.unlocked && onSelect(s.id)}
            disabled={!s.unlocked}
            className={`w-full rounded-xl p-4 text-left transition-colors border ${
              s.unlocked
                ? "bg-slate-800 hover:bg-slate-700 border-slate-700 cursor-pointer"
                : "bg-slate-900 border-slate-800 opacity-50 cursor-not-allowed"
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  {!s.unlocked && <span className="text-lg">🔒</span>}
                  <h3 className="text-white font-semibold">{s.title_en}</h3>
                </div>
                <p className="text-sm text-slate-400">{s.title_nl}</p>
                <p className="text-xs text-slate-500 mt-1">
                  {s.vocab_count} vocab · {s.sentence_count} sentences · {s.question_count} questions
                </p>
              </div>
              {s.avg_score !== null && (
                <div className={`text-lg font-bold ${s.avg_score >= 70 ? "text-green-400" : s.avg_score >= 50 ? "text-blue-400" : "text-red-400"}`}>
                  {s.avg_score}%
                </div>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}


function SceneDetailView({
  scene, onBack,
}: {
  scene: api.SpeakingSceneDetail;
  onBack: () => void;
}) {
  const [playingIdx, setPlayingIdx] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const playSentence = async (idx: number) => {
    try {
      setPlayingIdx(idx);
      const { audio_file } = await api.getSpeakingSentenceAudio(scene.id, idx);
      if (audioRef.current) {
        audioRef.current.pause();
      }
      const audio = new Audio(`/audio_listening/${audio_file}`);
      audioRef.current = audio;
      audio.onended = () => setPlayingIdx(null);
      audio.onerror = () => setPlayingIdx(null);
      await audio.play();
    } catch {
      setPlayingIdx(null);
    }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <button onClick={onBack} className="text-blue-400 hover:text-blue-300 text-sm mb-4">
        ← Back to scenes
      </button>
      <h1 className="text-2xl font-bold text-white mb-1">{scene.title_en}</h1>
      <p className="text-slate-400 mb-6">{scene.title_nl}</p>

      {/* Vocab */}
      <h2 className="text-lg font-semibold text-white mb-3">Vocabulary</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-8">
        {scene.vocab.map((v, i) => (
          <div key={i} className="bg-slate-800 rounded-lg p-3 border border-slate-700">
            <div className="font-semibold text-white">{v.dutch}</div>
            <div className="text-sm text-slate-400">{v.english}</div>
            <div className="text-xs text-slate-500 mt-1 italic">{v.example}</div>
          </div>
        ))}
      </div>

      {/* Model sentences */}
      <h2 className="text-lg font-semibold text-white mb-3">Model Sentences</h2>
      <div className="space-y-2">
        {scene.model_sentences.map((s, i) => (
          <div key={i} className="bg-slate-800 rounded-lg p-3 border border-slate-700 flex items-start gap-3">
            <button
              onClick={() => playSentence(i)}
              disabled={playingIdx === i}
              className={`mt-0.5 flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                playingIdx === i ? "bg-blue-500 animate-pulse" : "bg-slate-700 hover:bg-slate-600"
              }`}
            >
              {playingIdx === i ? "⏸" : "▶"}
            </button>
            <div>
              <div className="text-white">{s.text}</div>
              <div className="text-sm text-slate-400">{s.english}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}


function PracticeSetupView({
  scenes, onStart, onBack,
}: {
  scenes: api.SpeakingSceneSummary[];
  onStart: (sceneId: string, filter: "all" | "short" | "long") => void;
  onBack: () => void;
}) {
  const [selectedScene, setSelectedScene] = useState("");
  const [filter, setFilter] = useState<"all" | "short" | "long">("all");
  const unlocked = scenes.filter((s) => s.unlocked);

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <button onClick={onBack} className="text-blue-400 hover:text-blue-300 text-sm mb-4">
        ← Back
      </button>
      <h1 className="text-2xl font-bold text-white mb-6">Start Practice</h1>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Choose a scene</label>
          <div className="space-y-2">
            {unlocked.map((s) => (
              <button
                key={s.id}
                onClick={() => setSelectedScene(s.id)}
                className={`w-full rounded-lg p-3 text-left border transition-colors ${
                  selectedScene === s.id
                    ? "bg-blue-900/40 border-blue-500"
                    : "bg-slate-800 border-slate-700 hover:border-slate-600"
                }`}
              >
                <span className="text-white font-medium">{s.title_en}</span>
                <span className="text-slate-400 text-sm ml-2">({s.question_count} questions)</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Question type</label>
          <div className="flex gap-2">
            {(["all", "short", "long"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filter === f
                    ? "bg-blue-600 text-white"
                    : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                }`}
              >
                {f === "all" ? "All" : f === "short" ? "Short (30s)" : "Long (60s)"}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={() => selectedScene && onStart(selectedScene, filter)}
          disabled={!selectedScene}
          className="w-full py-3 rounded-lg font-semibold transition-colors bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Start Practice
        </button>
      </div>
    </div>
  );
}


function PrepView({
  question, questionNum, total, onComplete, onBack,
}: {
  question: CurrentQuestion;
  questionNum: number;
  total: number;
  onComplete: () => void;
  onBack: () => void;
}) {
  return (
    <div className="p-6 max-w-2xl mx-auto flex flex-col items-center">
      <button onClick={onBack} className="self-start text-blue-400 hover:text-blue-300 text-sm mb-4">
        ← Cancel
      </button>
      <div className="text-sm text-slate-400 mb-2">
        Question {questionNum} of {total} · {question.question_type === "short" ? "Short" : "Long"}
      </div>

      <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 w-full mb-6">
        <p className="text-white text-lg mb-2">{question.prompt_nl}</p>
        <p className="text-slate-400 text-sm">{question.prompt_en}</p>
      </div>

      <div className="text-sm text-slate-400 mb-4">Preparation time — read the question and think about your answer</div>
      <CountdownTimer
        seconds={question.prep_seconds}
        onComplete={onComplete}
        label="Prep time"
        color="#3b82f6"
      />
      <button
        onClick={onComplete}
        className="mt-6 px-6 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm"
      >
        Skip prep — start recording now
      </button>
    </div>
  );
}


function RecordingView({
  question, recorder, onStop,
}: {
  question: CurrentQuestion;
  recorder: ReturnType<typeof useAudioRecorder>;
  onStop: () => void;
}) {
  if (recorder.permissionDenied) {
    return (
      <div className="p-6 max-w-2xl mx-auto text-center">
        <div className="bg-red-900/30 border border-red-500/50 rounded-lg p-6">
          <h2 className="text-lg font-bold text-red-300 mb-2">Microphone Access Denied</h2>
          <p className="text-slate-400">Please allow microphone access in your browser settings to use speaking practice.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl mx-auto flex flex-col items-center">
      <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 w-full mb-6">
        <p className="text-white">{question.prompt_nl}</p>
        <p className="text-slate-400 text-sm">{question.prompt_en}</p>
      </div>

      {/* Recording indicator */}
      <div className="flex items-center gap-3 mb-4">
        <span className="w-4 h-4 bg-red-500 rounded-full animate-pulse" />
        <span className="text-red-400 font-medium">Recording...</span>
      </div>

      <CountdownTimer
        seconds={question.record_seconds}
        onComplete={onStop}
        label="Recording time"
        color="#ef4444"
      />

      <button
        onClick={onStop}
        className="mt-6 px-8 py-3 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold"
      >
        Stop Recording
      </button>
    </div>
  );
}


function UploadingView() {
  return (
    <div className="p-6 max-w-2xl mx-auto flex flex-col items-center justify-center min-h-[400px]">
      <div className="animate-spin w-12 h-12 border-3 border-blue-400 border-t-transparent rounded-full mb-4" />
      <h2 className="text-lg font-semibold text-white mb-2">Analyzing your speech...</h2>
      <p className="text-slate-400 text-sm">Transcribing audio and generating AI feedback</p>
    </div>
  );
}


function ScoreRing({ score, size = 48, label }: { score: number; size?: number; label: string }) {
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - score / 100);
  const color = score >= 70 ? "#22c55e" : score >= 50 ? "#3b82f6" : "#ef4444";

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: size, height: size }}>
        <svg className="-rotate-90" width={size} height={size}>
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#334155" strokeWidth="4" />
          <circle
            cx={size / 2} cy={size / 2} r={radius} fill="none"
            stroke={color} strokeWidth="4" strokeLinecap="round"
            strokeDasharray={circumference} strokeDashoffset={offset}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-bold text-white">{score}</span>
        </div>
      </div>
      <span className="text-xs text-slate-400">{label}</span>
    </div>
  );
}


function ReviewView({
  data, question, onNext, onReRecord, onHome, hasMore,
}: {
  data: api.SpeakingSubmitResponse;
  question: CurrentQuestion | null;
  onNext: () => void;
  onReRecord: () => void;
  onHome: () => void;
  hasMore: boolean;
}) {
  const fb = data.feedback;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-4">AI Review</h1>

      {/* Overall score */}
      <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 mb-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Your Score</h2>
          <div className={`text-3xl font-bold ${data.score_pct >= 70 ? "text-green-400" : data.score_pct >= 50 ? "text-blue-400" : "text-red-400"}`}>
            {data.score_pct}%
          </div>
        </div>
        <div className="flex justify-around">
          <ScoreRing score={fb.vocabulary_score} label="Vocabulary" />
          <ScoreRing score={fb.grammar_score} label="Grammar" />
          <ScoreRing score={fb.completeness_score} label="Completeness" />
        </div>
      </div>

      {/* Transcript */}
      <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 mb-4">
        <h3 className="text-sm font-medium text-slate-400 mb-2">What you said</h3>
        <p className="text-white">{data.transcript}</p>
      </div>

      {/* Feedback */}
      <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 mb-4">
        <h3 className="text-sm font-medium text-slate-400 mb-2">AI Feedback</h3>
        <p className="text-slate-300 mb-3">{fb.feedback_en}</p>

        {fb.matched_phrases.length > 0 && (
          <div className="mb-2">
            <span className="text-xs text-green-400 font-medium">Phrases used: </span>
            <span className="text-xs text-slate-300">{fb.matched_phrases.join(", ")}</span>
          </div>
        )}
        {fb.missing_phrases.length > 0 && (
          <div className="mb-2">
            <span className="text-xs text-amber-400 font-medium">Missing phrases: </span>
            <span className="text-xs text-slate-300">{fb.missing_phrases.join(", ")}</span>
          </div>
        )}

        {fb.grammar_errors.length > 0 && (
          <div className="mt-3 space-y-1">
            <h4 className="text-xs font-medium text-red-400">Grammar errors</h4>
            {fb.grammar_errors.map((e, i) => (
              <div key={i} className="text-xs">
                <span className="text-red-300 line-through">{e.error}</span>
                <span className="text-slate-500 mx-1">→</span>
                <span className="text-green-300">{e.correction}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Improved answer */}
      <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 mb-4">
        <h3 className="text-sm font-medium text-slate-400 mb-2">Improved version</h3>
        <p className="text-green-300">{fb.improved_answer}</p>
      </div>

      {/* Model answer */}
      <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 mb-6">
        <h3 className="text-sm font-medium text-slate-400 mb-2">Model answer</h3>
        <p className="text-blue-300">{data.model_answer}</p>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button onClick={onReRecord} className="flex-1 py-3 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-medium">
          Re-record
        </button>
        {hasMore ? (
          <button onClick={onNext} className="flex-1 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium">
            Next Question
          </button>
        ) : (
          <button onClick={onHome} className="flex-1 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium">
            Done
          </button>
        )}
      </div>
    </div>
  );
}


function HistoryView({
  history, onBack, loadHistory,
}: {
  history: api.SpeakingHistoryItem[];
  onBack: () => void;
  loadHistory: () => void;
}) {
  useEffect(() => { loadHistory(); }, [loadHistory]);

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <button onClick={onBack} className="text-blue-400 hover:text-blue-300 text-sm mb-4">
        ← Back
      </button>
      <h1 className="text-2xl font-bold text-white mb-6">Speaking History</h1>
      {history.length === 0 ? (
        <p className="text-slate-400">No recordings yet. Start a practice session!</p>
      ) : (
        <div className="space-y-3">
          {history.map((h) => (
            <div key={h.id} className="bg-slate-800 rounded-lg p-4 border border-slate-700">
              <div className="flex items-center justify-between mb-1">
                <span className="text-white font-medium">{h.scene} — {h.question_id}</span>
                <span className={`font-bold ${(h.score_pct ?? 0) >= 70 ? "text-green-400" : (h.score_pct ?? 0) >= 50 ? "text-blue-400" : "text-red-400"}`}>
                  {h.score_pct ?? "—"}%
                </span>
              </div>
              <div className="text-xs text-slate-500">
                {new Date(h.date).toLocaleString()} · {h.question_type} · {h.mode}
              </div>
              {h.transcript && (
                <p className="text-sm text-slate-400 mt-2 line-clamp-2">{h.transcript}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
