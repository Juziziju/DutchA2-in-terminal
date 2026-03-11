import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import CountdownTimer from "../components/CountdownTimer";
import { useAudioRecorder } from "../hooks/useAudioRecorder";
import * as api from "../api";
import { listeningAudioUrl } from "../api";
import HistoryViewNew from "../components/speaking/HistoryView";
import ProgressReport from "../components/speaking/ProgressReport";
import { useSprekenExamGuard } from "../contexts/ExerciseProvider";

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
  | "create_scene"
  | "progress"
  | "spreken_exam_intro"
  | "spreken_onderdeel_intro"
  | "spreken_prep"
  | "spreken_record"
  | "spreken_review"
  | "spreken_exam_results";

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

  // Spreken exam state
  const [sprekenExam, setSprekenExam] = useState<api.SprekenExamDetail | null>(null);
  const [sprekenOnderdeelIdx, setSprekenOnderdeelIdx] = useState(0);
  const [sprekenVraagIdx, setSprekenVraagIdx] = useState(0);
  const [sprekenResults, setSprekenResults] = useState<SessionResult[]>([]);
  const [sprekenCurrentBlob, setSprekenCurrentBlob] = useState<Blob | null>(null);
  const [showQuitModal, setShowQuitModal] = useState(false);
  const { setSprekenExamActive } = useSprekenExamGuard();

  // Warn user before leaving during active practice
  const isInPractice = ["prep", "recording", "uploading", "review", "session_report", "shadow_record", "shadow_review", "shadow_report", "shadow_play", "spreken_prep", "spreken_record", "spreken_review", "spreken_exam_intro", "spreken_onderdeel_intro", "spreken_exam_results"].includes(phase);
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

  // Auto-start spreken exam if redirected with ?spreken=exam_id
  const sprekenStartedRef = useRef(false);
  useEffect(() => {
    const sprekenId = searchParams.get("spreken");
    if (sprekenId && !sprekenStartedRef.current) {
      sprekenStartedRef.current = true;
      setSearchParams({}, { replace: true });
      selectSprekenExam(sprekenId);
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
    setSprekenExamActive(false);
    setShowQuitModal(false);
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

  // ── Spreken exam helpers ──────────────────────────────────────────────────

  const selectSprekenExam = async (examId: string) => {
    setLoading(true);
    try {
      const exam = await api.getSprekenExamDetail(examId);
      setSprekenExam(exam);
      setSprekenOnderdeelIdx(0);
      setSprekenVraagIdx(0);
      setSprekenResults([]);
      setSprekenExamActive(true);
      setPhase("spreken_exam_intro");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load exam");
    } finally {
      setLoading(false);
    }
  };

  const startSprekenOnderdeel = async () => {
    const micErr = await recorder.acquireStream();
    if (micErr) {
      setError(`Microphone error: ${micErr}`);
      return;
    }
    setPhase("spreken_onderdeel_intro");
  };

  const startSprekenPrep = () => {
    setPhase("spreken_prep");
  };

  const startSprekenRecord = async () => {
    setPhase("spreken_record");
    await recorder.start();
  };

  const stopSprekenRecord = useCallback(() => {
    recorder.stop();
  }, [recorder]);

  // Compute global question index for spreken exam
  const sprekenGlobalIdx = (() => {
    if (!sprekenExam) return 0;
    let idx = 0;
    for (let o = 0; o < sprekenOnderdeelIdx; o++) {
      idx += sprekenExam.onderdelen[o].vragen.length;
    }
    return idx + sprekenVraagIdx;
  })();
  const sprekenTotalQuestions = sprekenExam
    ? sprekenExam.onderdelen.reduce((s, o) => s + o.vragen.length, 0)
    : 0;
  const sprekenCurrentOnderdeel = sprekenExam?.onderdelen[sprekenOnderdeelIdx] ?? null;
  const sprekenCurrentVraag = sprekenCurrentOnderdeel?.vragen[sprekenVraagIdx] ?? null;

  // Background upload for spreken exam (fire-and-forget, auto-advance)
  const sprekenBackgroundUpload = (blob: Blob, gIdx: number, vraag: api.SprekenVraag) => {
    if (!sprekenExam) return;
    const entry: SessionResult = {
      questionIndex: gIdx,
      question: {
        id: vraag.id,
        prompt_nl: vraag.vraag_nl,
        prompt_en: vraag.vraag_en,
        prep_seconds: vraag.prep_seconds,
        record_seconds: vraag.record_seconds,
        expected_phrases: vraag.expected_phrases,
        model_answer: vraag.model_answer,
        question_type: vraag.question_type as "short" | "long",
      },
      result: null,
      status: "pending",
    };
    setSprekenResults((prev) => [...prev, entry]);

    api.submitSpeakingRecording(blob, sprekenExam.id, vraag.id, vraag.question_type, "spreken_exam")
      .then((result) => {
        setSprekenResults((prev) =>
          prev.map((r) => (r.questionIndex === gIdx ? { ...r, result, status: "done" } : r)),
        );
      })
      .catch(() => {
        setSprekenResults((prev) =>
          prev.map((r) => (r.questionIndex === gIdx ? { ...r, status: "error" } : r)),
        );
      });
  };

  // Handle spreken recording blob — store blob and go to review
  useEffect(() => {
    if (recorder.audioBlob && recorder.audioBlob !== prevBlobRef.current && phase === "spreken_record") {
      prevBlobRef.current = recorder.audioBlob;
      setSprekenCurrentBlob(recorder.audioBlob);
      setPhase("spreken_review");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recorder.audioBlob, phase]);

  // Spreken review: re-record goes back to prep
  const sprekenReRecord = () => {
    setSprekenCurrentBlob(null);
    recorder.reset();
    prevBlobRef.current = null;
    setPhase("spreken_prep");
  };

  // Spreken review: accept recording, upload and advance
  const sprekenAcceptAndAdvance = () => {
    const vraag = sprekenCurrentVraag;
    if (!vraag || !sprekenExam || !sprekenCurrentOnderdeel || !sprekenCurrentBlob) return;

    // Fire background upload
    sprekenBackgroundUpload(sprekenCurrentBlob, sprekenGlobalIdx, vraag);

    // Reset
    setSprekenCurrentBlob(null);
    recorder.reset();
    prevBlobRef.current = null;

    if (sprekenVraagIdx + 1 < sprekenCurrentOnderdeel.vragen.length) {
      setSprekenVraagIdx(sprekenVraagIdx + 1);
      setPhase("spreken_prep");
    } else if (sprekenOnderdeelIdx + 1 < sprekenExam.onderdelen.length) {
      setSprekenOnderdeelIdx(sprekenOnderdeelIdx + 1);
      setSprekenVraagIdx(0);
      setPhase("spreken_onderdeel_intro");
    } else {
      setPhase("spreken_exam_results");
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
    // Acquire mic on user gesture (before auto-record flow starts)
    const micErr = await recorder.acquireStream();
    if (micErr) {
      setError(`Microphone error: ${micErr}`);
      return;
    }
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
      return <SpeakingHome scenes={scenes} onBlock1={openSceneList} onBlock2={openPracticeSetup} onBlock3={() => { loadHistory(); setPhase("review"); }} onBlock4={openShadowSetup} onProgress={() => setPhase("progress")} history={history} loadHistory={loadHistory} />;
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
      return reviewData ? <ReviewView data={reviewData} question={currentQuestion} onNext={nextQuestion} onReRecord={reRecord} onHome={goHome} hasMore={questionIndex + 1 < questions.length} /> : <HistoryViewNew onBack={goHome} />;
    case "progress":
      return <ProgressReport onBack={goHome} onGenerateScene={async (topic) => {
        try {
          const res = await api.createCustomScene(topic, "A2");
          openSceneDetail(res.scene_id);
        } catch { /* ignore */ }
      }} />;
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
    case "spreken_exam_intro":
      return sprekenExam ? (
        <>
          <SprekenExamIntroView exam={sprekenExam} onStart={startSprekenOnderdeel} onQuit={() => setShowQuitModal(true)} />
          {showQuitModal && <QuitModal onContinue={() => setShowQuitModal(false)} onStop={goHome} />}
        </>
      ) : null;
    case "spreken_onderdeel_intro":
      return sprekenCurrentOnderdeel && sprekenExam ? (
        <>
          <SprekenOnderdeelIntroView
            exam={sprekenExam}
            onderdeel={sprekenCurrentOnderdeel}
            globalIdx={sprekenGlobalIdx}
            total={sprekenTotalQuestions}
            onStart={startSprekenPrep}
            onQuit={() => setShowQuitModal(true)}
          />
          {showQuitModal && <QuitModal onContinue={() => setShowQuitModal(false)} onStop={goHome} />}
        </>
      ) : null;
    case "spreken_prep":
      return sprekenCurrentVraag && sprekenExam ? (
        <>
          <SprekenPrepView
            exam={sprekenExam}
            vraag={sprekenCurrentVraag}
            globalIdx={sprekenGlobalIdx}
            total={sprekenTotalQuestions}
            onComplete={startSprekenRecord}
            onQuit={() => setShowQuitModal(true)}
          />
          {showQuitModal && <QuitModal onContinue={() => setShowQuitModal(false)} onStop={goHome} />}
        </>
      ) : null;
    case "spreken_record":
      return sprekenCurrentVraag && sprekenExam ? (
        <>
          <SprekenRecordView
            exam={sprekenExam}
            vraag={sprekenCurrentVraag}
            globalIdx={sprekenGlobalIdx}
            total={sprekenTotalQuestions}
            recorder={recorder}
            onStop={stopSprekenRecord}
            onQuit={() => setShowQuitModal(true)}
          />
          {showQuitModal && <QuitModal onContinue={() => setShowQuitModal(false)} onStop={goHome} />}
        </>
      ) : null;
    case "spreken_review":
      return sprekenCurrentVraag && sprekenExam && sprekenCurrentBlob ? (
        <>
          <SprekenReviewView
            exam={sprekenExam}
            vraag={sprekenCurrentVraag}
            globalIdx={sprekenGlobalIdx}
            total={sprekenTotalQuestions}
            blob={sprekenCurrentBlob}
            onReRecord={sprekenReRecord}
            onNext={sprekenAcceptAndAdvance}
            onQuit={() => setShowQuitModal(true)}
          />
          {showQuitModal && <QuitModal onContinue={() => setShowQuitModal(false)} onStop={goHome} />}
        </>
      ) : null;
    case "spreken_exam_results":
      return sprekenExam ? (
        <SprekenExamResultsView exam={sprekenExam} results={sprekenResults} onHome={goHome} />
      ) : null;
    default:
      return null;
  }
}


// ── Sub-views ───────────────────────────────────────────────────────────────

function SpeakingHome({
  scenes, onBlock1, onBlock2, onBlock3, onBlock4, onProgress, history, loadHistory,
}: {
  scenes: api.SpeakingSceneSummary[];
  onBlock1: () => void;
  onBlock2: () => void;
  onBlock3: () => void;
  onBlock4: () => void;
  onProgress: () => void;
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
        {/* Progress Report */}
        <button onClick={onProgress} className="bg-gradient-to-br from-indigo-900/40 to-slate-800 hover:from-indigo-800/40 hover:to-slate-700 rounded-xl p-6 text-left transition-colors border border-indigo-700/30">
          <div className="text-3xl mb-3">📊</div>
          <h2 className="text-lg font-bold text-white mb-1">Progress Report</h2>
          <p className="text-sm text-slate-400 mb-3">Track improvement, see patterns, and get AI suggestions</p>
          <div className="text-xs text-slate-500">Charts, trends & insights</div>
        </button>
        {/* Shadow Reading */}
        <button onClick={onBlock4} className="bg-slate-800 hover:bg-slate-700 rounded-xl p-6 text-left transition-colors border border-slate-700">
          <div className="text-3xl mb-3">🔊</div>
          <h2 className="text-lg font-bold text-white mb-1">Shadow Reading</h2>
          <p className="text-sm text-slate-400 mb-3">Listen to model sentences, repeat, and compare your pronunciation</p>
          <div className="text-xs text-slate-500">Improve pronunciation & fluency</div>
        </button>
        {/* Knowledge Summary */}
        <Link
          to="/study/speaking/notebook"
          className="bg-gradient-to-br from-emerald-900/40 to-slate-800 hover:from-emerald-800/40 hover:to-slate-700 rounded-xl p-6 text-left transition-colors border border-emerald-700/30"
        >
          <div className="text-3xl mb-3">📓</div>
          <h2 className="text-lg font-bold text-white mb-1">Knowledge Summary</h2>
          <p className="text-sm text-slate-400 mb-3">Browse all scene vocab, sentences, and your best recordings</p>
          <div className="text-xs text-slate-500">Organized by scene</div>
        </Link>
        {/* Freestyle Talk */}
        <Link
          to="/study/speaking/freestyle"
          className="bg-gradient-to-br from-sky-900/60 to-slate-800 hover:from-sky-800/60 hover:to-slate-700 rounded-xl p-6 text-left transition-colors border border-sky-700/40"
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
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const playSentence = useCallback(async () => {
    try {
      setPlaying(true);
      const { audio_file } = await api.getSpeakingSentenceAudio(scene.id, sentenceIndex);
      if (audioRef.current) {
        audioRef.current.pause();
      }
      const audio = new Audio(listeningAudioUrl(audio_file));
      audioRef.current = audio;
      audio.onended = () => {
        setPlaying(false);
        // Auto-start recording after playback finishes
        onStartRecording();
      };
      audio.onerror = () => { setPlaying(false); };
      await audio.play();
    } catch {
      setPlaying(false);
    }
  }, [scene.id, sentenceIndex, onStartRecording]);

  // Auto-play on mount
  const autoPlayedRef = useRef(false);
  useEffect(() => {
    if (autoPlayedRef.current) return;
    autoPlayedRef.current = true;
    playSentence();
    return () => {
      if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    };
  }, [sentenceIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="p-6 max-w-2xl mx-auto flex flex-col items-center">
      <button onClick={onBack} className="self-start text-blue-400 hover:text-blue-300 text-sm mb-4">
        &larr; Back
      </button>
      <div className="text-xs text-slate-500 mb-1 flex items-center gap-2">
        <span>Sentence {sentenceIndex + 1} of {scene.model_sentences.length}</span>
        {analyzedCount > 0 && (
          <>
            <span>&middot;</span>
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
        {playing ? "Playing... recording starts automatically after" : "Click play to listen, recording starts after playback"}
      </p>
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

  // Spacebar to stop recording
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

      <p className="text-slate-500 text-xs mt-4 mb-2">Press <kbd className="px-1.5 py-0.5 bg-slate-200 rounded text-slate-700 text-xs font-mono">Space</kbd> to stop</p>

      <div className="mt-3 flex gap-3">
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
  // Spacebar for next sentence (or done)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.code === "Space" && !e.repeat) {
        e.preventDefault();
        if (hasMore) onNext(); else onBack();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [hasMore, onNext, onBack]);

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
      <p className="text-slate-400 text-xs mt-3 text-center">
        Press <kbd className="px-1.5 py-0.5 bg-slate-200 rounded text-slate-700 text-xs font-mono">Space</kbd> for {hasMore ? "next sentence" : "done"}
      </p>
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


// ── Spreken Exam Views ──────────────────────────────────────────────────────

// ── DUO Exam Chrome ─────────────────────────────────────────────────────────

function DuoExamChrome({
  title,
  questionIdx,
  totalQuestions,
  onQuit,
  nextLabel,
  onNext,
  onSkip,
  children,
}: {
  title: string;
  questionIdx: number; // -1 for non-question pages
  totalQuestions: number;
  onQuit: () => void;
  nextLabel?: string;
  onNext?: () => void;
  onSkip?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="-m-6 flex flex-col min-h-[calc(100vh-57px)]">
      {/* Header */}
      <div className="bg-[#1e3a5c] px-4 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-white text-lg font-bold">NL</span>
          <span className="text-white/80 text-sm font-medium">{title}</span>
        </div>
        <button
          onClick={onQuit}
          className="text-white/70 hover:text-white text-xl font-bold w-8 h-8 flex items-center justify-center rounded hover:bg-white/10"
          title="Stop exam"
        >
          &times;
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 bg-[#f5f5f0] overflow-y-auto">
        <div className="max-w-2xl mx-auto py-8 px-4">
          <div className="bg-white rounded-xl shadow-sm p-6 md:p-8">
            {children}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="bg-[#1e3a5c] px-4 py-3 flex items-center justify-between flex-shrink-0">
        <div>
          {onSkip && (
            <button
              onClick={onSkip}
              className="text-white/60 hover:text-white text-sm px-3 py-1.5"
            >
              Skip
            </button>
          )}
        </div>
        <div>
          {questionIdx >= 0 && (
            <span className="bg-orange-500 text-white text-xs font-bold px-3 py-1 rounded-full">
              {questionIdx + 1} / {totalQuestions}
            </span>
          )}
        </div>
        <div>
          {onNext && (
            <button
              onClick={onNext}
              className="bg-orange-500 hover:bg-orange-600 text-white font-bold px-5 py-2 rounded-lg text-sm transition-colors"
            >
              {nextLabel ?? "VOLGENDE"} &gt;
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Quit modal ──────────────────────────────────────────────────────────────

function QuitModal({ onContinue, onStop }: { onContinue: () => void; onStop: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 max-w-sm mx-4 shadow-xl">
        <h2 className="text-lg font-bold text-slate-800 mb-2">Wilt u het examen stoppen?</h2>
        <p className="text-slate-500 text-sm mb-6">Uw opnames worden niet opgeslagen.</p>
        <div className="flex gap-3">
          <button
            onClick={onContinue}
            className="flex-1 py-2.5 rounded-lg border border-slate-300 text-slate-700 font-medium hover:bg-slate-50"
          >
            Doorgaan
          </button>
          <button
            onClick={onStop}
            className="flex-1 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium"
          >
            Stoppen
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Spreken views with DUO chrome ───────────────────────────────────────────

function SprekenExamIntroView({
  exam, onStart, onQuit,
}: {
  exam: api.SprekenExamDetail;
  onStart: () => void;
  onQuit: () => void;
}) {
  const totalQuestions = exam.onderdelen.reduce((s, o) => s + o.vragen.length, 0);

  return (
    <DuoExamChrome
      title={exam.title}
      questionIdx={-1}
      totalQuestions={totalQuestions}
      onQuit={onQuit}
      nextLabel="START"
      onNext={onStart}
    >
      <h1 className="text-xl font-bold text-slate-800 mb-4">{exam.title}</h1>
      <p className="text-slate-500 text-sm mb-6">
        {exam.onderdelen.length} onderdelen &middot; {totalQuestions} vragen &middot; ~35 minuten
      </p>

      <div className="space-y-3 mb-6">
        {exam.onderdelen.map((o, i) => (
          <div key={i} className="flex items-center gap-3 bg-slate-50 rounded-lg p-3">
            <div className="w-8 h-8 rounded-full bg-[#1e3a5c] flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
              {o.nummer}
            </div>
            <div>
              <h3 className="font-medium text-slate-800">{o.titel}</h3>
              <p className="text-xs text-slate-500">{o.beschrijving_en} &middot; {o.vragen.length} vragen</p>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-blue-50 rounded-lg p-4 text-sm text-slate-600">
        <p className="font-medium text-slate-700 mb-1">How it works:</p>
        <ul className="list-disc list-inside space-y-1">
          <li>Each question has preparation time (read the situation)</li>
          <li>Then recording time (answer the question)</li>
          <li>All recordings are analyzed after the exam</li>
          <li>Full results at the end</li>
        </ul>
      </div>
    </DuoExamChrome>
  );
}


function SprekenOnderdeelIntroView({
  exam, onderdeel, globalIdx, total, onStart, onQuit,
}: {
  exam: api.SprekenExamDetail;
  onderdeel: api.SprekenOnderdeel;
  globalIdx: number;
  total: number;
  onStart: () => void;
  onQuit: () => void;
}) {
  return (
    <DuoExamChrome
      title={exam.title}
      questionIdx={globalIdx}
      totalQuestions={total}
      onQuit={onQuit}
      nextLabel="VOLGENDE"
      onNext={onStart}
    >
      <div className="text-center py-6">
        <div className="w-16 h-16 rounded-full bg-[#1e3a5c] flex items-center justify-center text-white font-bold text-2xl mx-auto mb-4">
          {onderdeel.nummer}
        </div>
        <h2 className="text-xl font-bold text-slate-800 mb-2">
          Onderdeel {onderdeel.nummer} - {onderdeel.titel}
        </h2>
        <p className="text-slate-600 mb-2">{onderdeel.beschrijving}</p>
        <p className="text-slate-400 text-sm">{onderdeel.beschrijving_en}</p>
        <p className="text-xs text-slate-400 mt-4">{onderdeel.vragen.length} vragen</p>
      </div>
    </DuoExamChrome>
  );
}


function SprekenPrepView({
  exam, vraag, globalIdx, total, onComplete, onQuit,
}: {
  exam: api.SprekenExamDetail;
  vraag: api.SprekenVraag;
  globalIdx: number;
  total: number;
  onComplete: () => void;
  onQuit: () => void;
}) {
  const [showEnglish, setShowEnglish] = useState(false);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Auto-play TTS for situation + question
  const autoPlayedRef = useRef(false);
  useEffect(() => {
    if (autoPlayedRef.current) return;
    autoPlayedRef.current = true;
    (async () => {
      try {
        setAudioPlaying(true);
        const { audio_file } = await api.getSprekenQuestionAudio(exam.id, vraag.id);
        const audio = new Audio(listeningAudioUrl(audio_file));
        audioRef.current = audio;
        audio.onended = () => setAudioPlaying(false);
        audio.onerror = () => setAudioPlaying(false);
        await audio.play();
      } catch {
        setAudioPlaying(false);
      }
    })();
    return () => {
      if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    };
  }, [exam.id, vraag.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <DuoExamChrome
      title={exam.title}
      questionIdx={globalIdx}
      totalQuestions={total}
      onQuit={onQuit}
      onSkip={onComplete}
    >
      {/* Image (Onderdeel 2 & 4) */}
      {vraag.image_url && (
        <img
          src={vraag.image_url}
          alt="Foto bij de vraag"
          className="w-full rounded-lg mb-4 object-cover max-h-48"
        />
      )}

      {/* Situation */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-[#1e3a5c] uppercase">Situatie</span>
            {audioPlaying && (
              <span className="text-xs text-blue-500 flex items-center gap-1">
                <svg className="w-3 h-3 animate-pulse" fill="currentColor" viewBox="0 0 20 20"><path d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z"/></svg>
                Playing...
              </span>
            )}
          </div>
          <button
            onClick={() => setShowEnglish(!showEnglish)}
            className="text-xs text-slate-400 hover:text-slate-600 border border-slate-300 rounded px-2 py-0.5"
          >
            {showEnglish ? "NL" : "EN"}
          </button>
        </div>
        <p className="text-slate-700 text-sm leading-relaxed">
          {showEnglish ? vraag.situatie_en : vraag.situatie_nl}
        </p>
      </div>

      {/* Question */}
      <div className="border-t border-slate-200 pt-4 mb-6">
        <span className="text-xs font-semibold text-[#1e3a5c] uppercase block mb-1">Vraag</span>
        <p className="text-slate-800 text-lg font-medium">
          {showEnglish ? vraag.vraag_en : vraag.vraag_nl}
        </p>
      </div>

      {/* Tips */}
      {vraag.tips.length > 0 && (
        <div className="bg-slate-50 rounded-lg p-3 mb-6">
          <span className="text-xs font-medium text-slate-500 block mb-1">Tips:</span>
          <div className="flex flex-wrap gap-1">
            {vraag.tips.map((tip, i) => (
              <span key={i} className="text-xs bg-white text-slate-600 px-2 py-0.5 rounded border border-slate-200">
                {tip}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Prep countdown */}
      <div className="flex flex-col items-center">
        <p className="text-sm text-slate-500 mb-3">Preparation time</p>
        <CountdownTimer
          seconds={vraag.prep_seconds}
          onComplete={onComplete}
          label="Prep"
          color="#1e3a5c"
        />
      </div>
    </DuoExamChrome>
  );
}


function SprekenRecordView({
  exam, vraag, globalIdx, total, recorder, onStop, onQuit,
}: {
  exam: api.SprekenExamDetail;
  vraag: api.SprekenVraag;
  globalIdx: number;
  total: number;
  recorder: ReturnType<typeof useAudioRecorder>;
  onStop: () => void;
  onQuit: () => void;
}) {
  const [showEnglish, setShowEnglish] = useState(false);
  const isLast = globalIdx + 1 >= total;

  if (recorder.permissionDenied || recorder.error) {
    return (
      <DuoExamChrome title={exam.title} questionIdx={globalIdx} totalQuestions={total} onQuit={onQuit}>
        <div className="text-center py-8">
          <h2 className="text-lg font-bold text-red-600 mb-2">
            {recorder.permissionDenied ? "Microphone Access Denied" : "Recording Error"}
          </h2>
          <p className="text-slate-500 mb-4">
            {recorder.permissionDenied
              ? "Please allow microphone access in your browser settings."
              : recorder.error ?? "An unknown error occurred."}
          </p>
        </div>
      </DuoExamChrome>
    );
  }

  return (
    <DuoExamChrome
      title={exam.title}
      questionIdx={globalIdx}
      totalQuestions={total}
      onQuit={onQuit}
      nextLabel={isLast ? "INLEVEREN" : "VOLGENDE"}
      onNext={onStop}
    >
      {/* Image (Onderdeel 2 & 4) */}
      {vraag.image_url && (
        <img
          src={vraag.image_url}
          alt="Foto bij de vraag"
          className="w-full rounded-lg mb-4 object-cover max-h-48"
        />
      )}

      {/* Situation + Question */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-[#1e3a5c] uppercase">Situatie</span>
          <button
            onClick={() => setShowEnglish(!showEnglish)}
            className="text-xs text-slate-400 hover:text-slate-600 border border-slate-300 rounded px-2 py-0.5"
          >
            {showEnglish ? "NL" : "EN"}
          </button>
        </div>
        <p className="text-slate-700 text-sm leading-relaxed mb-3">
          {showEnglish ? vraag.situatie_en : vraag.situatie_nl}
        </p>
        <div className="border-t border-slate-200 pt-3">
          <span className="text-xs font-semibold text-[#1e3a5c] uppercase block mb-1">Vraag</span>
          <p className="text-slate-800 text-lg font-medium">
            {showEnglish ? vraag.vraag_en : vraag.vraag_nl}
          </p>
        </div>
      </div>

      {/* Recording pill */}
      <div className="mt-6 flex justify-center">
        <div className="bg-slate-800 rounded-full px-6 py-3 flex items-center gap-3 min-w-[280px]">
          <span className="w-3 h-3 bg-red-500 rounded-full animate-pulse flex-shrink-0" />
          <div className="flex-1">
            <CountdownTimer
              seconds={vraag.record_seconds}
              onComplete={onStop}
              label=""
              color="#ef4444"
            />
          </div>
        </div>
      </div>
    </DuoExamChrome>
  );
}


function SprekenReviewView({
  exam, vraag, globalIdx, total, blob, onReRecord, onNext, onQuit,
}: {
  exam: api.SprekenExamDetail;
  vraag: api.SprekenVraag;
  globalIdx: number;
  total: number;
  blob: Blob;
  onReRecord: () => void;
  onNext: () => void;
  onQuit: () => void;
}) {
  const [showEnglish, setShowEnglish] = useState(false);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrl = useMemo(() => URL.createObjectURL(blob), [blob]);
  const isLast = globalIdx + 1 >= total;

  useEffect(() => {
    return () => {
      if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    };
  }, []);

  const playRecording = () => {
    if (audioRef.current) { audioRef.current.pause(); }
    const a = new Audio(audioUrl);
    audioRef.current = a;
    setPlaying(true);
    a.onended = () => setPlaying(false);
    a.onerror = () => setPlaying(false);
    a.play().catch(() => setPlaying(false));
  };

  return (
    <DuoExamChrome
      title={exam.title}
      questionIdx={globalIdx}
      totalQuestions={total}
      onQuit={onQuit}
      nextLabel={isLast ? "INLEVEREN" : "VOLGENDE"}
      onNext={onNext}
    >
      {/* Image (Onderdeel 2 & 4) */}
      {vraag.image_url && (
        <img
          src={vraag.image_url}
          alt="Foto bij de vraag"
          className="w-full rounded-lg mb-4 object-cover max-h-48"
        />
      )}

      {/* Situation + Question */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-[#1e3a5c] uppercase">Situatie</span>
          <button
            onClick={() => setShowEnglish(!showEnglish)}
            className="text-xs text-slate-400 hover:text-slate-600 border border-slate-300 rounded px-2 py-0.5"
          >
            {showEnglish ? "NL" : "EN"}
          </button>
        </div>
        <p className="text-slate-700 text-sm leading-relaxed mb-3">
          {showEnglish ? vraag.situatie_en : vraag.situatie_nl}
        </p>
        <div className="border-t border-slate-200 pt-3">
          <span className="text-xs font-semibold text-[#1e3a5c] uppercase block mb-1">Vraag</span>
          <p className="text-slate-800 text-lg font-medium">
            {showEnglish ? vraag.vraag_en : vraag.vraag_nl}
          </p>
        </div>
      </div>

      {/* Playback + Re-record controls */}
      <div className="mt-6 space-y-3">
        <div className="flex justify-center">
          <button
            onClick={playRecording}
            disabled={playing}
            className={`flex items-center gap-2 px-6 py-3 rounded-full font-medium text-sm transition-colors ${
              playing
                ? "bg-blue-100 text-blue-600 animate-pulse"
                : "bg-blue-600 text-white hover:bg-blue-700"
            }`}
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M6.3 2.84A1.5 1.5 0 004 4.11v11.78a1.5 1.5 0 002.3 1.27l9.344-5.891a1.5 1.5 0 000-2.538L6.3 2.841z" />
            </svg>
            {playing ? "Playing..." : "Play recording"}
          </button>
        </div>
        <div className="flex justify-center">
          <button
            onClick={onReRecord}
            className="text-sm text-slate-500 hover:text-slate-700 underline"
          >
            Re-record
          </button>
        </div>
      </div>
    </DuoExamChrome>
  );
}


function SprekenExamResultsView({
  exam, results, onHome,
}: {
  exam: api.SprekenExamDetail;
  results: SessionResult[];
  onHome: () => void;
}) {
  const doneResults = results.filter((r) => r.status === "done" && r.result);
  const pendingCount = results.filter((r) => r.status === "pending").length;
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

  // Group results by onderdeel
  let globalOffset = 0;
  const onderdeelGroups = exam.onderdelen.map((o) => {
    const count = o.vragen.length;
    const group = results.filter((r) => r.questionIndex >= globalOffset && r.questionIndex < globalOffset + count);
    globalOffset += count;
    return { onderdeel: o, results: group };
  });

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-800 mb-2">Exam Results</h1>
      <p className="text-slate-500 text-sm mb-6">{exam.title}</p>

      {/* Pending indicator */}
      {pendingCount > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4 flex items-center gap-3">
          <div className="animate-spin w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full flex-shrink-0" />
          <p className="text-blue-700 text-sm">
            Analyzing {pendingCount} recording{pendingCount > 1 ? "s" : ""}... Results will appear as they complete.
          </p>
        </div>
      )}

      {/* Overall score */}
      {avgScore !== null && (
        <div className="bg-gradient-to-br from-amber-900/30 to-slate-800 rounded-xl p-6 border border-amber-700/30 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Overall Score</h2>
            <div className={`text-4xl font-bold ${avgScore >= 70 ? "text-green-400" : avgScore >= 50 ? "text-amber-400" : "text-red-400"}`}>
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

      {/* Per-onderdeel breakdown */}
      {onderdeelGroups.map(({ onderdeel, results: oResults }, oi) => {
        const oDone = oResults.filter((r) => r.status === "done" && r.result);
        const oAvg = oDone.length > 0
          ? Math.round(oDone.reduce((s, r) => s + (r.result?.score_pct ?? 0), 0) / oDone.length)
          : null;

        return (
          <div key={oi} className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-500 uppercase">
                Onderdeel {onderdeel.nummer}: {onderdeel.titel}
              </h3>
              {oAvg !== null && (
                <span className={`text-sm font-bold ${oAvg >= 70 ? "text-green-400" : oAvg >= 50 ? "text-amber-400" : "text-red-400"}`}>
                  {oAvg}%
                </span>
              )}
            </div>
            <div className="space-y-2">
              {oResults.map((r, ri) => {
                const isExpanded = expandedIdx === r.questionIndex;
                return (
                  <div key={ri} className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                    <button
                      onClick={() => setExpandedIdx(isExpanded ? null : r.questionIndex)}
                      className="w-full p-3 text-left flex items-center justify-between"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm truncate">{r.question.prompt_nl}</p>
                      </div>
                      <div className="flex items-center gap-2 ml-3">
                        {r.status === "pending" && (
                          <div className="animate-spin w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full" />
                        )}
                        {r.status === "done" && r.result && (
                          <span className={`text-lg font-bold ${r.result.score_pct >= 70 ? "text-green-400" : r.result.score_pct >= 50 ? "text-amber-400" : "text-red-400"}`}>
                            {r.result.score_pct}%
                          </span>
                        )}
                        {r.status === "error" && <span className="text-red-400 text-sm">Error</span>}
                        <span className="text-slate-500 text-sm">{isExpanded ? "▲" : "▼"}</span>
                      </div>
                    </button>

                    {isExpanded && r.status === "done" && r.result && (
                      <div className="px-3 pb-3 space-y-2 border-t border-slate-700 pt-2">
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
                        <div>
                          <h4 className="text-xs font-medium text-slate-400 mb-1">Model answer</h4>
                          <p className="text-sm text-blue-300">{r.result.model_answer}</p>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      <button
        onClick={onHome}
        className="w-full py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold"
      >
        Back to Home
      </button>
    </div>
  );
}
