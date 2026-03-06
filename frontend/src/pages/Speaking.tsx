import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import CountdownTimer from "../components/CountdownTimer";
import { useAudioRecorder } from "../hooks/useAudioRecorder";
import * as api from "../api";
import { listeningAudioUrl } from "../api";

// ── Types ────────────────────────────────────────────────────────────────────

type Phase =
  | "home"
  | "scene_list"
  | "scene_detail"
  | "practice_setup"
  | "mock_exam_list"
  | "prep"
  | "recording"
  | "uploading"
  | "review"
  | "session_report"
  | "shadow_setup"
  | "shadow_play"
  | "shadow_record"
  | "shadow_review"
  | "shadow_report"
  | "create_scene";

interface CurrentQuestion extends api.SpeakingQuestion {
  question_type: "short" | "long";
}

interface SessionResult {
  questionIndex: number;
  question: CurrentQuestion;
  result: api.SpeakingSubmitResponse | null;
  status: "pending" | "done" | "error";
}

interface ShadowResult {
  sentenceIndex: number;
  sentence: api.SpeakingModelSentence;
  result: api.ShadowSubmitResponse | null;
  status: "pending" | "done" | "error";
}

// ── Main component ──────────────────────────────────────────────────────────

export default function Speaking() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [phase, setPhase] = useState<Phase>("home");
  const [scenes, setScenes] = useState<api.SpeakingSceneSummary[]>([]);
  const [selectedScene, setSelectedScene] = useState<api.SpeakingSceneDetail | null>(null);
  const [questions, setQuestions] = useState<CurrentQuestion[]>([]);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [currentSceneId, setCurrentSceneId] = useState("");
  const [reviewData, setReviewData] = useState<api.SpeakingSubmitResponse | null>(null);
  const [history, setHistory] = useState<api.SpeakingHistoryItem[]>([]);
  const [mockExams, setMockExams] = useState<api.MockExamSummary[]>([]);
  const [currentMode, setCurrentMode] = useState<string>("scene_drill");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const recorder = useAudioRecorder();

  // Shadow reading state
  const [shadowSceneId, setShadowSceneId] = useState("");
  const [shadowScene, setShadowScene] = useState<api.SpeakingSceneDetail | null>(null);
  const [shadowSentenceIndex, setShadowSentenceIndex] = useState(0);
  const [shadowReview, setShadowReview] = useState<api.ShadowSubmitResponse | null>(null);

  // Continuous mode session results
  const [sessionResults, setSessionResults] = useState<SessionResult[]>([]);
  const [shadowResults, setShadowResults] = useState<ShadowResult[]>([]);

  // Warn user before leaving during active practice
  const isInPractice = ["prep", "recording", "uploading", "review", "session_report", "shadow_record", "shadow_review", "shadow_report", "shadow_play"].includes(phase);
  useEffect(() => {
    if (!isInPractice) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isInPractice]);

  // Clean up recorder on unmount
  useEffect(() => {
    return () => {
      recorder.stop();
      recorder.reset();
    };
  }, []);

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

  // Auto-start mock exam if redirected from Mock Exam page with ?mock=exam_id
  const mockStartedRef = useRef(false);
  useEffect(() => {
    const mockId = searchParams.get("mock");
    if (mockId && !mockStartedRef.current) {
      mockStartedRef.current = true;
      setSearchParams({}, { replace: true }); // Clear query param
      startMockExam(mockId);
    }
  }, [searchParams]);

  const currentQuestion = questions[questionIndex] ?? null;

  // ── Navigation helpers ──────────────────────────────────────────────────

  const goHome = () => {
    // Stop any active recording and clean up
    if (recorder.isRecording) {
      recorder.stop();
    }
    recorder.reset();
    prevBlobRef.current = null;
    setPhase("home");
    setError(null);
    setSessionResults([]);
    setShadowResults([]);
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

  const openMockExamList = async () => {
    setLoading(true);
    try {
      const exams = await api.getMockExams();
      setMockExams(exams);
      setPhase("mock_exam_list");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load mock exams");
    } finally {
      setLoading(false);
    }
  };

  const startMockExam = async (examId: string) => {
    setLoading(true);
    try {
      const exam = await api.getMockExamDetail(examId);
      const list: CurrentQuestion[] = [
        ...exam.short.map((q) => ({ ...q, question_type: "short" as const })),
        ...exam.long.map((q) => ({ ...q, question_type: "long" as const })),
      ];
      setQuestions(list);
      setQuestionIndex(0);
      setCurrentSceneId(examId);
      setCurrentMode("mock_exam");
      setSessionResults([]);
      // Acquire mic stream on user gesture — keeps it alive for timer callback
      const micErr = await recorder.acquireStream();
      if (micErr) {
        setError(`Microphone error: ${micErr}`);
        setLoading(false);
        return;
      }
      setPhase("prep");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
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
      setCurrentMode("scene_drill");
      setSessionResults([]);
      // Acquire mic stream on user gesture — keeps it alive for timer callback
      const micErr = await recorder.acquireStream();
      if (micErr) {
        setError(`Microphone error: ${micErr}`);
        setLoading(false);
        return;
      }
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

  // Background upload for Record Practice (continuous mode)
  const backgroundUpload = (blob: Blob, qIdx: number, question: CurrentQuestion) => {
    const entry: SessionResult = {
      questionIndex: qIdx,
      question,
      result: null,
      status: "pending",
    };
    setSessionResults((prev) => [...prev, entry]);

    api
      .submitSpeakingRecording(blob, currentSceneId, question.id, question.question_type, currentMode)
      .then((result) => {
        setSessionResults((prev) =>
          prev.map((r) => (r.questionIndex === qIdx ? { ...r, result, status: "done" } : r)),
        );
      })
      .catch(() => {
        setSessionResults((prev) =>
          prev.map((r) => (r.questionIndex === qIdx ? { ...r, status: "error" } : r)),
        );
      });
  };

  // Background upload for Shadow Reading (continuous mode)
  const backgroundShadowUpload = (blob: Blob, sIdx: number, sentence: api.SpeakingModelSentence) => {
    const entry: ShadowResult = {
      sentenceIndex: sIdx,
      sentence,
      result: null,
      status: "pending",
    };
    setShadowResults((prev) => [...prev, entry]);

    api
      .submitShadowRecording(blob, shadowSceneId, sIdx)
      .then((result) => {
        setShadowResults((prev) =>
          prev.map((r) => (r.sentenceIndex === sIdx ? { ...r, result, status: "done" } : r)),
        );
      })
      .catch(() => {
        setShadowResults((prev) =>
          prev.map((r) => (r.sentenceIndex === sIdx ? { ...r, status: "error" } : r)),
        );
      });
  };

  // After recorder.stop(), audioBlob updates → trigger background upload + auto-advance
  const prevBlobRef = useRef<Blob | null>(null);
  useEffect(() => {
    if (recorder.audioBlob && recorder.audioBlob !== prevBlobRef.current && phase === "recording") {
      prevBlobRef.current = recorder.audioBlob;
      const q = questions[questionIndex];
      if (!q) return;

      // Fire background upload (don't await)
      backgroundUpload(recorder.audioBlob, questionIndex, q);

      // Auto-advance
      if (questionIndex + 1 < questions.length) {
        recorder.reset();
        prevBlobRef.current = null;
        setQuestionIndex(questionIndex + 1);
        setPhase("prep");
      } else {
        recorder.reset();
        prevBlobRef.current = null;
        setPhase("session_report");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recorder.audioBlob, phase]);

  // Shadow recording blob handler → background upload + auto-advance
  useEffect(() => {
    if (recorder.audioBlob && recorder.audioBlob !== prevBlobRef.current && phase === "shadow_record") {
      prevBlobRef.current = recorder.audioBlob;
      const sentence = shadowScene?.model_sentences[shadowSentenceIndex];
      if (!sentence) return;

      // Fire background upload (don't await)
      backgroundShadowUpload(recorder.audioBlob, shadowSentenceIndex, sentence);

      // Auto-advance
      if (shadowScene && shadowSentenceIndex + 1 < shadowScene.model_sentences.length) {
        recorder.reset();
        prevBlobRef.current = null;
        setShadowSentenceIndex(shadowSentenceIndex + 1);
        setPhase("shadow_play");
      } else {
        recorder.reset();
        prevBlobRef.current = null;
        setPhase("shadow_report");
      }
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
        currentMode,
      );
      setReviewData(result);
      setPhase("review");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Upload failed");
      setPhase("home");
    }
  };

  const uploadShadowRecording = async (blob: Blob) => {
    setPhase("uploading");
    try {
      const result = await api.submitShadowRecording(blob, shadowSceneId, shadowSentenceIndex);
      setShadowReview(result);
      setPhase("shadow_review");
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

  // ── Shadow reading helpers ──────────────────────────────────────────────

  const openShadowSetup = () => {
    setPhase("shadow_setup");
    loadScenes();
  };

  const selectShadowScene = async (sceneId: string) => {
    setLoading(true);
    try {
      const detail = await api.getSpeakingSceneDetail(sceneId);
      setShadowScene(detail);
      setShadowSceneId(sceneId);
      setShadowSentenceIndex(0);
      setShadowResults([]);
      setPhase("shadow_play");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  };

  const startShadowRecording = async () => {
    // Acquire mic stream on user gesture
    const micErr = await recorder.acquireStream();
    if (micErr) {
      setError(`Microphone error: ${micErr}`);
      return;
    }
    setPhase("shadow_record");
    await recorder.start();
  };

  const stopShadowRecording = useCallback(() => {
    recorder.stop();
  }, [recorder]);

  const nextShadowSentence = () => {
    recorder.reset();
    prevBlobRef.current = null;
    setShadowReview(null);
    if (shadowScene && shadowSentenceIndex + 1 < shadowScene.model_sentences.length) {
      setShadowSentenceIndex(shadowSentenceIndex + 1);
      setPhase("shadow_play");
    } else {
      goHome();
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
          <p className="text-red-600">{error}</p>
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

  // Count analyzed results for progress indicator
  const analyzedCount = sessionResults.filter((r) => r.status === "done").length;
  const shadowAnalyzedCount = shadowResults.filter((r) => r.status === "done").length;

  switch (phase) {
    case "home":
      return <SpeakingHome scenes={scenes} onBlock1={openSceneList} onBlock2={openPracticeSetup} onBlock3={() => { loadHistory(); setPhase("review"); }} onBlock4={openShadowSetup} history={history} loadHistory={loadHistory} />;
    case "scene_list":
      return <SceneListView scenes={scenes} onSelect={openSceneDetail} onBack={goHome} onCreateScene={() => setPhase("create_scene")} />;
    case "create_scene":
      return <CreateSceneView onBack={openSceneList} onCreated={(sceneId) => { loadScenes(); openSceneDetail(sceneId); }} />;
    case "scene_detail":
      return selectedScene ? <SceneDetailView scene={selectedScene} onBack={openSceneList} onStartPractice={startPractice} /> : null;
    case "practice_setup":
      return <PracticeSetupView scenes={scenes} onStart={startPractice} onBack={goHome} />;
    case "mock_exam_list":
      return <MockExamListView exams={mockExams} onStart={startMockExam} onBack={goHome} />;
    case "prep":
      return currentQuestion ? (
        <PrepView
          question={currentQuestion}
          questionNum={questionIndex + 1}
          total={questions.length}
          analyzedCount={analyzedCount}
          onComplete={startRecording}
          onBack={goHome}
        />
      ) : null;
    case "recording":
      return currentQuestion ? (
        <RecordingView
          question={currentQuestion}
          questionNum={questionIndex + 1}
          total={questions.length}
          analyzedCount={analyzedCount}
          recorder={recorder}
          onStop={finishRecording}
          onBack={goHome}
        />
      ) : null;
    case "uploading":
      return <UploadingView />;
    case "review":
      return reviewData ? <ReviewView data={reviewData} question={currentQuestion} onNext={nextQuestion} onReRecord={reRecord} onHome={goHome} hasMore={questionIndex + 1 < questions.length} /> : <HistoryView history={history} onBack={goHome} loadHistory={loadHistory} />;
    case "session_report":
      return <SessionReportView results={sessionResults} onHome={goHome} />;
    case "shadow_setup":
      return <ShadowSetupView scenes={scenes} onSelect={selectShadowScene} onBack={goHome} />;
    case "shadow_play":
      return shadowScene ? (
        <ShadowPlayView
          scene={shadowScene}
          sentenceIndex={shadowSentenceIndex}
          analyzedCount={shadowAnalyzedCount}
          onStartRecording={startShadowRecording}
          onBack={goHome}
        />
      ) : null;
    case "shadow_record":
      return shadowScene ? (
        <ShadowRecordView
          scene={shadowScene}
          sentenceIndex={shadowSentenceIndex}
          analyzedCount={shadowAnalyzedCount}
          recorder={recorder}
          onStop={stopShadowRecording}
          onBack={goHome}
        />
      ) : null;
    case "shadow_review":
      return shadowReview ? <ShadowReviewView data={shadowReview} onNext={nextShadowSentence} onBack={goHome} hasMore={shadowScene ? shadowSentenceIndex + 1 < shadowScene.model_sentences.length : false} /> : null;
    case "shadow_report":
      return shadowScene ? <ShadowReportView results={shadowResults} onHome={goHome} /> : null;
    default:
      return null;
  }
}


// ── Sub-views ───────────────────────────────────────────────────────────────

function SpeakingHome({
  scenes, onBlock1, onBlock2, onBlock3, onBlock4, history, loadHistory,
}: {
  scenes: api.SpeakingSceneSummary[];
  onBlock1: () => void;
  onBlock2: () => void;
  onBlock3: () => void;
  onBlock4: () => void;
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
      <h1 className="text-2xl font-bold text-slate-800 mb-6">Speaking Practice</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        {/* Block 1 — Scene Input */}
        <button onClick={onBlock1} className="bg-slate-800 hover:bg-slate-700 rounded-xl p-6 text-left transition-colors border border-slate-700">
          <div className="text-3xl mb-3">📖</div>
          <h2 className="text-lg font-bold text-white mb-1">Scene Input</h2>
          <p className="text-sm text-slate-400 mb-3">Learn vocabulary and model sentences for each exam scene</p>
          <div className="text-xs text-slate-500">{scenes.length} scenes available</div>
        </button>
        {/* Block 2 — Record Practice */}
        <button onClick={onBlock2} className="bg-slate-800 hover:bg-slate-700 rounded-xl p-6 text-left transition-colors border border-slate-700">
          <div className="text-3xl mb-3">🎙️</div>
          <h2 className="text-lg font-bold text-white mb-1">Record Practice</h2>
          <p className="text-sm text-slate-400 mb-3">Practice speaking with timed recording, just like the real exam</p>
          <div className="text-xs text-slate-500">{totalAttempts} recordings done</div>
        </button>
        {/* Block 3 — AI Review */}
        <button onClick={onBlock3} className="bg-slate-800 hover:bg-slate-700 rounded-xl p-6 text-left transition-colors border border-slate-700">
          <div className="text-3xl mb-3">🤖</div>
          <h2 className="text-lg font-bold text-white mb-1">AI Review</h2>
          <p className="text-sm text-slate-400 mb-3">Review your past recordings with AI feedback</p>
          <div className="flex gap-4 text-xs text-slate-500">
            <span>{history.length} reviews</span>
            {avgScore !== null && <span>Avg score: {avgScore}%</span>}
          </div>
        </button>
        {/* Block 4 — Shadow Reading */}
        <button onClick={onBlock4} className="bg-slate-800 hover:bg-slate-700 rounded-xl p-6 text-left transition-colors border border-slate-700">
          <div className="text-3xl mb-3">🔊</div>
          <h2 className="text-lg font-bold text-white mb-1">Shadow Reading</h2>
          <p className="text-sm text-slate-400 mb-3">Listen to model sentences, repeat, and compare your pronunciation</p>
          <div className="text-xs text-slate-500">Improve pronunciation & fluency</div>
        </button>
        {/* Block 5 — Freestyle Talk */}
        <Link
          to="/study/speaking/freestyle"
          className="bg-gradient-to-br from-sky-900/60 to-slate-800 hover:from-sky-800/60 hover:to-slate-700 rounded-xl p-6 text-left transition-colors border border-sky-700/40 md:col-span-2"
        >
          <div className="flex items-center gap-2 mb-3">
            <div className="text-3xl">💬</div>
            <span className="bg-sky-500/20 text-sky-300 text-[10px] px-2 py-0.5 rounded-full font-medium">BETA</span>
          </div>
          <h2 className="text-lg font-bold text-white mb-1">Freestyle Talk</h2>
          <p className="text-sm text-slate-400">Have a free conversation in Dutch with AI</p>
        </Link>
      </div>
    </div>
  );
}


function SceneListView({
  scenes, onSelect, onBack, onCreateScene,
}: {
  scenes: api.SpeakingSceneSummary[];
  onSelect: (id: string) => void;
  onBack: () => void;
  onCreateScene: () => void;
}) {
  const builtIn = scenes.filter((s) => !s.is_custom);
  const custom = scenes.filter((s) => s.is_custom);

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <button onClick={onBack} className="text-blue-400 hover:text-blue-300 text-sm mb-4">
        ← Back
      </button>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Exam Scenes</h1>
        <button
          onClick={onCreateScene}
          className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium"
        >
          + Create Scene
        </button>
      </div>

      {/* Custom scenes */}
      {custom.length > 0 && (
        <>
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Your Scenes</h2>
          <div className="space-y-3 mb-6">
            {custom.map((s) => (
              <button
                key={s.id}
                onClick={() => onSelect(s.id)}
                className="w-full rounded-xl p-4 text-left transition-colors border bg-blue-900/30 hover:bg-blue-900/50 border-blue-700/50 cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-white font-semibold">{s.title_en}</h3>
                      {s.level && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-blue-700/50 text-blue-300">{s.level}</span>
                      )}
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
        </>
      )}

      {/* Built-in scenes */}
      <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Built-in Scenes</h2>
      <div className="space-y-3">
        {builtIn.map((s) => (
          <button
            key={s.id}
            onClick={() => onSelect(s.id)}
            className="w-full rounded-xl p-4 text-left transition-colors border bg-slate-800 hover:bg-slate-700 border-slate-700 cursor-pointer"
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


function CreateSceneView({
  onBack, onCreated,
}: {
  onBack: () => void;
  onCreated: (sceneId: string) => void;
}) {
  const [topic, setTopic] = useState("");
  const [level, setLevel] = useState<"A1" | "A2" | "B1">("A2");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [showAdminPopup, setShowAdminPopup] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");
  const [adminError, setAdminError] = useState("");

  const doCreate = async (adminPw?: string) => {
    if (!topic.trim()) return;
    setGenerating(true);
    setError("");
    try {
      const result = await api.createCustomScene(topic.trim(), level, adminPw);
      onCreated(result.scene_id);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to generate scene";
      if (msg.includes("limit reached")) {
        setShowAdminPopup(true);
        setGenerating(false);
      } else {
        setError(msg);
        setGenerating(false);
      }
    }
  };

  const handleCreate = () => doCreate();

  const handleAdminSubmit = async () => {
    if (!adminPassword.trim()) return;
    setAdminError("");
    setShowAdminPopup(false);
    await doCreate(adminPassword.trim());
    if (!generating) {
      // If it failed again, the error will be set
      setAdminPassword("");
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <button onClick={onBack} className="text-blue-400 hover:text-blue-300 text-sm mb-4">
        ← Back
      </button>
      <h1 className="text-2xl font-bold text-slate-800 mb-6">Create Custom Scene</h1>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-2">Topic (in English)</label>
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g. Visiting the doctor, Ordering food at a restaurant..."
            className="w-full rounded-lg border border-slate-600 bg-slate-800 text-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={generating}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-600 mb-2">Difficulty Level</label>
          <div className="flex gap-3">
            {(["A1", "A2", "B1"] as const).map((l) => (
              <button
                key={l}
                onClick={() => setLevel(l)}
                disabled={generating}
                className={`flex-1 py-3 rounded-lg font-semibold text-sm transition-colors ${
                  level === l
                    ? "bg-blue-600 text-white"
                    : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                }`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        <button
          onClick={handleCreate}
          disabled={!topic.trim() || generating}
          className="w-full py-3 rounded-lg font-semibold transition-colors bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {generating ? "Generating scene... (10-20s)" : "Generate Scene"}
        </button>

        <p className="text-xs text-slate-500 text-center">
          AI will generate vocabulary, model sentences, and exam questions for your topic. Limited to 5 custom scenes per account.
        </p>
      </div>

      {/* Admin password popup */}
      {showAdminPopup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 mx-4 max-w-sm w-full shadow-xl">
            <h3 className="text-lg font-bold text-slate-800 mb-2">Scene Limit Reached</h3>
            <p className="text-sm text-slate-600 mb-4">
              You've reached the limit of 5 custom scenes. Enter the admin password to unlock more.
            </p>
            <input
              type="password"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdminSubmit()}
              placeholder="Admin password"
              className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
            {adminError && <p className="text-xs text-red-500 mb-2">{adminError}</p>}
            <div className="flex gap-2">
              <button
                onClick={() => { setShowAdminPopup(false); setAdminPassword(""); }}
                className="flex-1 py-2 rounded-lg border border-slate-300 text-slate-600 text-sm hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAdminSubmit}
                disabled={!adminPassword.trim()}
                className="flex-1 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
              >
                Unlock
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


function SceneDetailView({
  scene, onBack, onStartPractice,
}: {
  scene: api.SpeakingSceneDetail;
  onBack: () => void;
  onStartPractice: (sceneId: string, filter: "all" | "short" | "long") => void;
}) {
  const [playingIdx, setPlayingIdx] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [questions, setQuestions] = useState<api.SpeakingQuestions | null>(null);
  const [showQuestions, setShowQuestions] = useState(false);

  const playSentence = async (idx: number) => {
    try {
      setPlayingIdx(idx);
      const { audio_file } = await api.getSpeakingSentenceAudio(scene.id, idx);
      if (audioRef.current) {
        audioRef.current.pause();
      }
      const audio = new Audio(listeningAudioUrl(audio_file));
      audioRef.current = audio;
      audio.onended = () => setPlayingIdx(null);
      audio.onerror = () => setPlayingIdx(null);
      await audio.play();
    } catch {
      setPlayingIdx(null);
    }
  };

  const loadQuestions = async () => {
    if (questions) { setShowQuestions(!showQuestions); return; }
    try {
      const qs = await api.getSpeakingQuestions(scene.id);
      setQuestions(qs);
      setShowQuestions(true);
    } catch { /* ignore */ }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <button onClick={onBack} className="text-blue-400 hover:text-blue-300 text-sm mb-4">
        ← Back to scenes
      </button>
      <h1 className="text-2xl font-bold text-slate-800 mb-1">{scene.title_en}</h1>
      <p className="text-slate-500 mb-4">{scene.title_nl}</p>

      {/* Quick start practice */}
      <button
        onClick={() => onStartPractice(scene.id, "all")}
        className="w-full mb-6 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold"
      >
        Start Practice
      </button>

      {/* Vocab */}
      <h2 className="text-lg font-semibold text-slate-800 mb-3">Vocabulary</h2>
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
      <h2 className="text-lg font-semibold text-slate-800 mb-3">Model Sentences</h2>
      <div className="space-y-2 mb-8">
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

      {/* Questions (expandable) */}
      <button
        onClick={loadQuestions}
        className="text-blue-400 hover:text-blue-300 text-sm font-medium mb-3"
      >
        {showQuestions ? "▼ Hide Exam Questions" : "▶ Show Exam Questions"}
      </button>
      {showQuestions && questions && (
        <div className="space-y-4">
          {questions.short.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-slate-500 uppercase mb-2">Short Questions (30s)</h3>
              <div className="space-y-2">
                {questions.short.map((q, i) => (
                  <div key={i} className="bg-slate-800 rounded-lg p-3 border border-slate-700">
                    <p className="text-white text-sm">{q.prompt_nl}</p>
                    <p className="text-slate-400 text-xs">{q.prompt_en}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          {questions.long.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-slate-500 uppercase mb-2">Long Questions (60s)</h3>
              <div className="space-y-2">
                {questions.long.map((q, i) => (
                  <div key={i} className="bg-slate-800 rounded-lg p-3 border border-slate-700">
                    <p className="text-white text-sm">{q.prompt_nl}</p>
                    <p className="text-slate-400 text-xs">{q.prompt_en}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
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

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <button onClick={onBack} className="text-blue-400 hover:text-blue-300 text-sm mb-4">
        ← Back
      </button>
      <h1 className="text-2xl font-bold text-slate-800 mb-6">Start Practice</h1>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-2">Choose a scene</label>
          <div className="space-y-2">
            {scenes.map((s) => (
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
          <label className="block text-sm font-medium text-slate-600 mb-2">Question type</label>
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


function MockExamListView({
  exams, onStart, onBack,
}: {
  exams: api.MockExamSummary[];
  onStart: (examId: string) => void;
  onBack: () => void;
}) {
  return (
    <div className="p-6 max-w-3xl mx-auto">
      <button onClick={onBack} className="text-blue-400 hover:text-blue-300 text-sm mb-4">
        ← Back
      </button>
      <h1 className="text-2xl font-bold text-slate-800 mb-2">Real Exam Practice</h1>
      <p className="text-slate-500 text-sm mb-6">
        Based on real DUO inburgering A2 speaking exam questions. Each set has 8 short questions (15s prep, 30s record) and 8 long questions (30s prep, 60s record), matching the actual exam format.
      </p>
      <div className="space-y-3">
        {exams.map((e) => (
          <button
            key={e.id}
            onClick={() => onStart(e.id)}
            className="w-full bg-slate-800 hover:bg-slate-700 rounded-xl p-5 text-left transition-colors border border-slate-700"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-white font-semibold text-lg">{e.title}</h3>
                <p className="text-sm text-slate-400 mt-1">
                  {e.short_count} short + {e.long_count} long questions · ~35 min
                </p>
              </div>
              <span className="text-blue-400 text-sm font-medium">Start →</span>
            </div>
          </button>
        ))}
      </div>

      <div className="mt-6 bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
        <h3 className="text-sm font-medium text-slate-300 mb-2">About these questions</h3>
        <p className="text-xs text-slate-400">
          Questions sourced from official DUO practice exams, Dik Verhaar spreekoefeningen, and Uilentaal oefenexamens. They follow the post-March 2025 format: recording only (no multiple choice). Topics include daily life, opinions, comparisons with your home country, and practical situations.
        </p>
      </div>
    </div>
  );
}


function ProgressBar({ current, total }: { current: number; total: number }) {
  return (
    <div className="w-full bg-slate-700 rounded-full h-2">
      <div
        className="bg-blue-500 h-2 rounded-full transition-all duration-500"
        style={{ width: `${total > 0 ? (current / total) * 100 : 0}%` }}
      />
    </div>
  );
}


function SessionProgressIndicator({ questionNum, total, analyzedCount }: { questionNum: number; total: number; analyzedCount: number }) {
  return (
    <div className="text-xs text-slate-500 flex items-center gap-2">
      <span>Q {questionNum}/{total}</span>
      {analyzedCount > 0 && (
        <>
          <span>·</span>
          <span>{analyzedCount} analyzed</span>
        </>
      )}
    </div>
  );
}


function PrepView({
  question, questionNum, total, analyzedCount, onComplete, onBack,
}: {
  question: CurrentQuestion;
  questionNum: number;
  total: number;
  analyzedCount: number;
  onComplete: () => void;
  onBack: () => void;
}) {
  return (
    <div className="p-6 max-w-2xl mx-auto flex flex-col items-center">
      <button onClick={onBack} className="self-start text-blue-400 hover:text-blue-300 text-sm mb-4">
        ← Cancel
      </button>
      <SessionProgressIndicator questionNum={questionNum} total={total} analyzedCount={analyzedCount} />
      <div className="text-sm text-slate-500 mb-2">
        Question {questionNum} of {total} · {question.question_type === "short" ? "Short" : "Long"}
      </div>

      <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 w-full mb-6">
        <p className="text-white text-lg mb-2">{question.prompt_nl}</p>
        <p className="text-slate-400 text-sm">{question.prompt_en}</p>
      </div>

      <div className="text-sm text-slate-500 mb-4">Preparation time — read the question and think about your answer</div>
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
  question, questionNum, total, analyzedCount, recorder, onStop, onBack,
}: {
  question: CurrentQuestion;
  questionNum: number;
  total: number;
  analyzedCount: number;
  recorder: ReturnType<typeof useAudioRecorder>;
  onStop: () => void;
  onBack: () => void;
}) {
  if (recorder.permissionDenied || recorder.error) {
    const title = recorder.permissionDenied ? "Microphone Access Denied" : "Recording Error";
    const msg = recorder.permissionDenied
      ? "Please allow microphone access in your browser settings to use speaking practice."
      : recorder.error ?? "An unknown error occurred while recording.";
    return (
      <div className="p-6 max-w-2xl mx-auto text-center">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h2 className="text-lg font-bold text-red-600 mb-2">{title}</h2>
          <p className="text-slate-500 mb-4">{msg}</p>
          <button onClick={onBack} className="px-6 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-medium">
            Back to Speaking
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl mx-auto flex flex-col items-center">
      <SessionProgressIndicator questionNum={questionNum} total={total} analyzedCount={analyzedCount} />

      <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 w-full mb-6">
        <p className="text-white">{question.prompt_nl}</p>
        <p className="text-slate-400 text-sm">{question.prompt_en}</p>
      </div>

      {/* Recording indicator */}
      <div className="flex items-center gap-3 mb-4">
        <span className="w-4 h-4 bg-red-500 rounded-full animate-pulse" />
        <span className="text-red-500 font-medium">Recording...</span>
      </div>

      <CountdownTimer
        seconds={question.record_seconds}
        onComplete={onStop}
        label="Recording time"
        color="#ef4444"
      />

      <div className="mt-6 flex gap-3">
        <button
          onClick={onBack}
          className="px-6 py-3 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 font-medium"
        >
          Cancel
        </button>
        <button
          onClick={onStop}
          className="px-8 py-3 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold"
        >
          Stop Recording
        </button>
      </div>
    </div>
  );
}


function UploadingView() {
  return (
    <div className="p-6 max-w-2xl mx-auto flex flex-col items-center justify-center min-h-[400px]">
      <div className="animate-spin w-12 h-12 border-3 border-blue-400 border-t-transparent rounded-full mb-4" />
      <h2 className="text-lg font-semibold text-slate-800 mb-2">Analyzing your speech...</h2>
      <p className="text-slate-500 text-sm">Transcribing audio and generating AI feedback</p>
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
      <h1 className="text-2xl font-bold text-slate-800 mb-4">AI Review</h1>

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
      <h1 className="text-2xl font-bold text-slate-800 mb-6">Speaking History</h1>
      {history.length === 0 ? (
        <p className="text-slate-500">No recordings yet. Start a practice session!</p>
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


// ── Session Report View (Record Practice / Mock Exam) ────────────────────────

function SessionReportView({
  results, onHome,
}: {
  results: SessionResult[];
  onHome: () => void;
}) {
  const doneCount = results.filter((r) => r.status === "done").length;
  const totalCount = results.length;
  const allDone = doneCount === totalCount;

  const doneResults = results.filter((r) => r.status === "done" && r.result);
  const avgScore = doneResults.length > 0
    ? Math.round(doneResults.reduce((sum, r) => sum + (r.result?.score_pct ?? 0), 0) / doneResults.length)
    : null;

  const avgVocab = doneResults.length > 0
    ? Math.round(doneResults.reduce((sum, r) => sum + (r.result?.feedback.vocabulary_score ?? 0), 0) / doneResults.length)
    : 0;
  const avgGrammar = doneResults.length > 0
    ? Math.round(doneResults.reduce((sum, r) => sum + (r.result?.feedback.grammar_score ?? 0), 0) / doneResults.length)
    : 0;
  const avgComplete = doneResults.length > 0
    ? Math.round(doneResults.reduce((sum, r) => sum + (r.result?.feedback.completeness_score ?? 0), 0) / doneResults.length)
    : 0;

  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-800 mb-4">Session Complete</h1>

      {/* Progress */}
      <div className="mb-4">
        <div className="flex items-center justify-between text-sm text-slate-500 mb-1">
          <span>{allDone ? "All analyzed" : `Analyzing ${doneCount}/${totalCount}...`}</span>
          <span>{doneCount}/{totalCount}</span>
        </div>
        <ProgressBar current={doneCount} total={totalCount} />
      </div>

      {/* Average scores */}
      {avgScore !== null && (
        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Average Score</h2>
            <div className={`text-3xl font-bold ${avgScore >= 70 ? "text-green-400" : avgScore >= 50 ? "text-blue-400" : "text-red-400"}`}>
              {avgScore}%
            </div>
          </div>
          <div className="flex justify-around">
            <ScoreRing score={avgVocab} label="Vocabulary" />
            <ScoreRing score={avgGrammar} label="Grammar" />
            <ScoreRing score={avgComplete} label="Completeness" />
          </div>
        </div>
      )}

      {/* Per-question results */}
      <div className="space-y-3 mb-6">
        {results.map((r, i) => {
          const isExpanded = expandedIdx === i;
          return (
            <div key={i} className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
              <button
                onClick={() => setExpandedIdx(isExpanded ? null : i)}
                className="w-full p-4 text-left flex items-center justify-between"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">Q{r.questionIndex + 1}</span>
                    <span className="text-xs px-1.5 py-0.5 rounded bg-slate-700 text-slate-400">
                      {r.question.question_type}
                    </span>
                  </div>
                  <p className="text-white text-sm mt-1 truncate">{r.question.prompt_nl}</p>
                </div>
                <div className="flex items-center gap-3 ml-3">
                  {r.status === "pending" && (
                    <div className="animate-spin w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full" />
                  )}
                  {r.status === "error" && (
                    <span className="text-red-400 text-sm font-medium">Error</span>
                  )}
                  {r.status === "done" && r.result && (
                    <span className={`text-lg font-bold ${r.result.score_pct >= 70 ? "text-green-400" : r.result.score_pct >= 50 ? "text-blue-400" : "text-red-400"}`}>
                      {r.result.score_pct}%
                    </span>
                  )}
                  <span className="text-slate-500 text-sm">{isExpanded ? "▲" : "▼"}</span>
                </div>
              </button>

              {isExpanded && r.status === "done" && r.result && (
                <div className="px-4 pb-4 space-y-3 border-t border-slate-700 pt-3">
                  <div>
                    <h4 className="text-xs font-medium text-slate-400 mb-1">What you said</h4>
                    <p className="text-sm text-white">{r.result.transcript}</p>
                  </div>
                  <div>
                    <h4 className="text-xs font-medium text-slate-400 mb-1">Feedback</h4>
                    <p className="text-sm text-slate-300">{r.result.feedback.feedback_en}</p>
                  </div>
                  <div className="flex justify-around">
                    <ScoreRing score={r.result.feedback.vocabulary_score} size={40} label="Vocab" />
                    <ScoreRing score={r.result.feedback.grammar_score} size={40} label="Grammar" />
                    <ScoreRing score={r.result.feedback.completeness_score} size={40} label="Complete" />
                  </div>
                  {r.result.feedback.grammar_errors.length > 0 && (
                    <div className="space-y-1">
                      <h4 className="text-xs font-medium text-red-400">Grammar errors</h4>
                      {r.result.feedback.grammar_errors.map((e, j) => (
                        <div key={j} className="text-xs">
                          <span className="text-red-300 line-through">{e.error}</span>
                          <span className="text-slate-500 mx-1">→</span>
                          <span className="text-green-300">{e.correction}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <div>
                    <h4 className="text-xs font-medium text-slate-400 mb-1">Improved version</h4>
                    <p className="text-sm text-green-300">{r.result.feedback.improved_answer}</p>
                  </div>
                  <div>
                    <h4 className="text-xs font-medium text-slate-400 mb-1">Model answer</h4>
                    <p className="text-sm text-blue-300">{r.result.model_answer}</p>
                  </div>
                </div>
              )}

              {isExpanded && r.status === "pending" && (
                <div className="px-4 pb-4 border-t border-slate-700 pt-3 text-center">
                  <div className="animate-spin w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full mx-auto mb-2" />
                  <p className="text-sm text-slate-500">Still analyzing...</p>
                </div>
              )}

              {isExpanded && r.status === "error" && (
                <div className="px-4 pb-4 border-t border-slate-700 pt-3">
                  <p className="text-sm text-red-400">Failed to analyze this recording.</p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <button
        onClick={onHome}
        className="w-full py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold"
      >
        Back to Home
      </button>
    </div>
  );
}


// ── Shadow Reading Views ─────────────────────────────────────────────────────

function ShadowSetupView({
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
      <h1 className="text-2xl font-bold text-slate-800 mb-2">Shadow Reading</h1>
      <p className="text-slate-500 text-sm mb-6">
        Pick a scene to practice. You'll listen to each model sentence, repeat it, and get AI feedback on your pronunciation.
      </p>
      <div className="space-y-3">
        {scenes.map((s) => (
          <button
            key={s.id}
            onClick={() => onSelect(s.id)}
            className="w-full bg-slate-800 hover:bg-slate-700 rounded-xl p-4 text-left transition-colors border border-slate-700"
          >
            <h3 className="text-white font-semibold">{s.title_en}</h3>
            <p className="text-sm text-slate-400">{s.title_nl}</p>
            <p className="text-xs text-slate-500 mt-1">{s.sentence_count} sentences</p>
          </button>
        ))}
      </div>
    </div>
  );
}


function ShadowPlayView({
  scene, sentenceIndex, analyzedCount, onStartRecording, onBack,
}: {
  scene: api.SpeakingSceneDetail;
  sentenceIndex: number;
  analyzedCount: number;
  onStartRecording: () => void;
  onBack: () => void;
}) {
  const sentence = scene.model_sentences[sentenceIndex];
  const [playing, setPlaying] = useState(false);
  const [hasPlayed, setHasPlayed] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Auto-play on mount (for continuous mode after first sentence)
  const autoPlayedRef = useRef(false);
  useEffect(() => {
    if (sentenceIndex > 0 && !autoPlayedRef.current) {
      autoPlayedRef.current = true;
      playSentence();
    }
    return () => { autoPlayedRef.current = false; };
  }, [sentenceIndex]);

  const playSentence = async () => {
    try {
      setPlaying(true);
      const { audio_file } = await api.getSpeakingSentenceAudio(scene.id, sentenceIndex);
      if (audioRef.current) {
        audioRef.current.pause();
      }
      const audio = new Audio(listeningAudioUrl(audio_file));
      audioRef.current = audio;
      audio.onended = () => { setPlaying(false); setHasPlayed(true); };
      audio.onerror = () => { setPlaying(false); };
      await audio.play();
    } catch {
      setPlaying(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto flex flex-col items-center">
      <button onClick={onBack} className="self-start text-blue-400 hover:text-blue-300 text-sm mb-4">
        ← Back
      </button>
      <div className="text-xs text-slate-500 mb-1 flex items-center gap-2">
        <span>Sentence {sentenceIndex + 1} of {scene.model_sentences.length}</span>
        {analyzedCount > 0 && (
          <>
            <span>·</span>
            <span>{analyzedCount} analyzed</span>
          </>
        )}
      </div>

      <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 w-full mb-6 text-center">
        <p className="text-white text-lg mb-2">{sentence.text}</p>
        <p className="text-slate-400 text-sm">{sentence.english}</p>
      </div>

      <button
        onClick={playSentence}
        disabled={playing}
        className={`w-20 h-20 rounded-full flex items-center justify-center text-3xl transition-colors mb-6 ${
          playing ? "bg-blue-500 animate-pulse" : "bg-blue-600 hover:bg-blue-700"
        }`}
      >
        {playing ? "⏸" : "▶"}
      </button>
      <p className="text-slate-500 text-sm mb-6">
        {hasPlayed ? "Listen again or start recording" : "Listen to the sentence first"}
      </p>

      <button
        onClick={onStartRecording}
        disabled={!hasPlayed}
        className="w-full py-3 rounded-lg font-semibold transition-colors bg-red-600 hover:bg-red-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Start Recording
      </button>
    </div>
  );
}


function ShadowRecordView({
  scene, sentenceIndex, analyzedCount, recorder, onStop, onBack,
}: {
  scene: api.SpeakingSceneDetail;
  sentenceIndex: number;
  analyzedCount: number;
  recorder: ReturnType<typeof useAudioRecorder>;
  onStop: () => void;
  onBack: () => void;
}) {
  const sentence = scene.model_sentences[sentenceIndex];

  if (recorder.permissionDenied || recorder.error) {
    const title = recorder.permissionDenied ? "Microphone Access Denied" : "Recording Error";
    const msg = recorder.permissionDenied
      ? "Please allow microphone access in your browser settings."
      : recorder.error ?? "An unknown error occurred while recording.";
    return (
      <div className="p-6 max-w-2xl mx-auto text-center">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h2 className="text-lg font-bold text-red-600 mb-2">{title}</h2>
          <p className="text-slate-500 mb-4">{msg}</p>
          <button onClick={onBack} className="px-6 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-medium">
            Back to Speaking
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl mx-auto flex flex-col items-center">
      <div className="text-xs text-slate-500 mb-2 flex items-center gap-2">
        <span>Sentence {sentenceIndex + 1} of {scene.model_sentences.length}</span>
        {analyzedCount > 0 && (
          <>
            <span>·</span>
            <span>{analyzedCount} analyzed</span>
          </>
        )}
      </div>

      <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 w-full mb-6 text-center">
        <p className="text-white text-lg">{sentence.text}</p>
        <p className="text-slate-400 text-sm">{sentence.english}</p>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <span className="w-4 h-4 bg-red-500 rounded-full animate-pulse" />
        <span className="text-red-500 font-medium">Recording...</span>
      </div>

      <CountdownTimer
        seconds={15}
        onComplete={onStop}
        label="Recording time"
        color="#ef4444"
      />

      <div className="mt-6 flex gap-3">
        <button
          onClick={onBack}
          className="px-6 py-3 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 font-medium"
        >
          Cancel
        </button>
        <button
          onClick={onStop}
          className="px-8 py-3 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold"
        >
          Stop Recording
        </button>
      </div>
    </div>
  );
}


function ShadowReviewView({
  data, onNext, onBack, hasMore,
}: {
  data: api.ShadowSubmitResponse;
  onNext: () => void;
  onBack: () => void;
  hasMore: boolean;
}) {
  const scoreColor = data.similarity_score >= 70 ? "text-green-400" : data.similarity_score >= 50 ? "text-blue-400" : "text-red-400";

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-800 mb-4">Shadow Reading Review</h1>

      {/* Score */}
      <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 mb-4 text-center">
        <div className={`text-4xl font-bold ${scoreColor} mb-1`}>{data.similarity_score}%</div>
        <div className="text-sm text-slate-400">Similarity Score</div>
      </div>

      {/* Side by side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
          <h3 className="text-sm font-medium text-slate-400 mb-2">Original</h3>
          <p className="text-white">{data.original_sentence}</p>
        </div>
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
          <h3 className="text-sm font-medium text-slate-400 mb-2">What you said</h3>
          <p className="text-white">{data.transcript}</p>
        </div>
      </div>

      {/* Word analysis */}
      <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 mb-4">
        {data.word_matches.length > 0 && (
          <div className="mb-2">
            <span className="text-xs text-green-400 font-medium">Matched: </span>
            <span className="text-xs text-slate-300">{data.word_matches.join(", ")}</span>
          </div>
        )}
        {data.word_misses.length > 0 && (
          <div className="mb-2">
            <span className="text-xs text-red-400 font-medium">Missed: </span>
            <span className="text-xs text-slate-300">{data.word_misses.join(", ")}</span>
          </div>
        )}
        <p className="text-slate-300 text-sm mt-2">{data.feedback}</p>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button onClick={onBack} className="flex-1 py-3 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-medium">
          Done
        </button>
        {hasMore && (
          <button onClick={onNext} className="flex-1 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium">
            Next Sentence
          </button>
        )}
      </div>
    </div>
  );
}


// ── Shadow Report View (end of continuous shadow session) ────────────────────

function ShadowReportView({
  results, onHome,
}: {
  results: ShadowResult[];
  onHome: () => void;
}) {
  const doneCount = results.filter((r) => r.status === "done").length;
  const totalCount = results.length;
  const allDone = doneCount === totalCount;

  const doneResults = results.filter((r) => r.status === "done" && r.result);
  const avgSimilarity = doneResults.length > 0
    ? Math.round(doneResults.reduce((sum, r) => sum + (r.result?.similarity_score ?? 0), 0) / doneResults.length)
    : null;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-800 mb-4">Shadow Reading Report</h1>

      {/* Progress */}
      <div className="mb-4">
        <div className="flex items-center justify-between text-sm text-slate-500 mb-1">
          <span>{allDone ? "All analyzed" : `Analyzing ${doneCount}/${totalCount}...`}</span>
          <span>{doneCount}/{totalCount}</span>
        </div>
        <ProgressBar current={doneCount} total={totalCount} />
      </div>

      {/* Average similarity */}
      {avgSimilarity !== null && (
        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 mb-6 text-center">
          <div className={`text-4xl font-bold ${avgSimilarity >= 70 ? "text-green-400" : avgSimilarity >= 50 ? "text-blue-400" : "text-red-400"} mb-1`}>
            {avgSimilarity}%
          </div>
          <div className="text-sm text-slate-400">Average Similarity</div>
        </div>
      )}

      {/* Per-sentence results */}
      <div className="space-y-3 mb-6">
        {results.map((r, i) => {
          const scoreColor = r.result
            ? r.result.similarity_score >= 80
              ? "bg-green-900/30 border-green-700/50"
              : r.result.similarity_score >= 50
                ? "bg-yellow-900/20 border-yellow-700/50"
                : "bg-red-900/20 border-red-700/50"
            : "border-slate-700";

          return (
            <div key={i} className={`bg-slate-800 rounded-xl p-4 border ${scoreColor}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-slate-500">S{r.sentenceIndex + 1}</span>
                {r.status === "pending" && (
                  <div className="animate-spin w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full" />
                )}
                {r.status === "error" && (
                  <span className="text-red-400 text-sm">Error</span>
                )}
                {r.status === "done" && r.result && (
                  <span className={`text-lg font-bold ${r.result.similarity_score >= 70 ? "text-green-400" : r.result.similarity_score >= 50 ? "text-blue-400" : "text-red-400"}`}>
                    {r.result.similarity_score}%
                  </span>
                )}
              </div>

              <div className="space-y-1">
                <div>
                  <span className="text-xs text-slate-500">Original: </span>
                  <span className="text-sm text-white">{r.sentence.text}</span>
                </div>
                {r.status === "done" && r.result && (
                  <>
                    <div>
                      <span className="text-xs text-slate-500">You said: </span>
                      <span className="text-sm text-white">{r.result.transcript}</span>
                    </div>
                    <div className="flex gap-3 text-xs mt-1">
                      {r.result.word_matches.length > 0 && (
                        <span className="text-green-400">{r.result.word_matches.length} matched</span>
                      )}
                      {r.result.word_misses.length > 0 && (
                        <span className="text-red-400">{r.result.word_misses.length} missed</span>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <button
        onClick={onHome}
        className="w-full py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold"
      >
        Back to Home
      </button>
    </div>
  );
}
