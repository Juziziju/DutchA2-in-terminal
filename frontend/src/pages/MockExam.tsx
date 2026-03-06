import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ExamQuestion,
  MockExamSummary,
  SectionInfo,
  getExamQuestions,
  getExamSession,
  getMockExams,
  gradeExamSection,
  submitExam,
} from "../api";
import Timer from "../components/Timer";
import { useMockExamState } from "../contexts/MockExamContext";

const PASS_SCORE = 60;

export default function MockExam() {
  const nav = useNavigate();
  const { state: s, set, reset } = useMockExamState();
  const [speakingExams, setSpeakingExams] = useState<MockExamSummary[]>([]);

  useEffect(() => {
    if (s.loaded) return;
    getExamSession()
      .then((data) => set((p) => ({ ...p, examData: data, loaded: true })))
      .catch(() => set((p) => ({ ...p, loaded: true })));
    getMockExams().then(setSpeakingExams).catch(() => {});
  }, [s.loaded]);

  function startFull() {
    if (!s.examData) return;
    const queue = [...s.examData.sections];
    launchSection(queue[0], queue.slice(1), "full", {});
  }

  function startSingle(section: SectionInfo) {
    launchSection(section, [], "single", {});
  }

  function launchSection(
    section: SectionInfo,
    remaining: SectionInfo[],
    mode: "full" | "single",
    scores: Record<string, number | null>,
  ) {
    set((p) => ({
      ...p,
      activeSection: section,
      timerExpired: false,
      sectionQueue: remaining,
      phase: "section",
      mode,
      scores,
      questions: [],
      questionIndex: 0,
      answers: {},
      gradedItems: [],
      sectionScore: null,
      loadingQuestions: true,
    }));
    getExamQuestions(section.code)
      .then((qs) => set((p) => ({ ...p, questions: qs, loadingQuestions: false })))
      .catch(() => set((p) => ({ ...p, loadingQuestions: false })));
  }

  function setAnswer(questionId: string, answer: string) {
    set((p) => ({ ...p, answers: { ...p.answers, [questionId]: answer } }));
  }

  async function submitSection() {
    if (!s.activeSection) return;
    set((p) => ({ ...p, submitting: true }));
    const answerList = s.questions.map((q) => ({
      question_id: q.id,
      answer: s.answers[q.id] ?? "",
    }));
    try {
      const result = await gradeExamSection(s.activeSection.code, answerList);
      set((p) => ({
        ...p,
        gradedItems: result.items,
        sectionScore: result.score_pct,
        phase: "section_review",
        submitting: false,
      }));
    } catch {
      set((p) => ({ ...p, submitting: false }));
    }
  }

  function nextAfterReview() {
    if (!s.activeSection) return;
    const newScores = { ...s.scores, [s.activeSection.code]: s.sectionScore };
    if (s.mode === "full" && s.sectionQueue.length > 0) {
      launchSection(s.sectionQueue[0], s.sectionQueue.slice(1), s.mode, newScores);
    } else {
      finishExam(newScores);
    }
  }

  async function finishExam(finalScores: Record<string, number | null>) {
    set((p) => ({ ...p, submitting: true }));
    try {
      const r = await submitExam("official", finalScores);
      set((p) => ({ ...p, finalResult: r, phase: "results", submitting: false }));
    } catch {
      set((p) => ({ ...p, phase: "results", submitting: false }));
    }
  }

  // ── Menu ──
  if (s.phase === "menu") {
    return (
      <div className="max-w-lg mx-auto space-y-6">
        <h2 className="text-xl font-bold">Mock Exam — Inburgeringsexamen A2</h2>

        <button
          onClick={startFull}
          disabled={!s.examData}
          className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 rounded-xl font-semibold hover:from-blue-700 hover:to-indigo-700 shadow-md disabled:opacity-50"
        >
          Start full exam (all 5 sections)
        </button>

        <div>
          <p className="text-sm font-medium mb-2">Or practice a single section</p>
          <div className="space-y-2">
            {s.examData?.sections.map((sec) => (
              <button
                key={sec.code}
                onClick={() => startSingle(sec)}
                className="w-full flex justify-between items-center bg-white border border-slate-200 rounded-2xl px-4 py-3 hover:shadow-md cursor-pointer transition-all"
              >
                <div>
                  <span className="font-medium">{sec.label}</span>
                  <span className="text-xs text-slate-400 ml-2">{sec.question_count} questions</span>
                </div>
                <span className="text-sm text-slate-400">{sec.default_minutes} min</span>
              </button>
            ))}
          </div>
        </div>

        {/* Speaking Mock Exams */}
        {speakingExams.length > 0 && (
          <div>
            <p className="text-sm font-medium mb-2">Speaking practice exams (real DUO questions)</p>
            <div className="space-y-2">
              {speakingExams.map((e) => (
                <button
                  key={e.id}
                  onClick={() => nav(`/study/speaking?mock=${e.id}`)}
                  className="w-full flex justify-between items-center bg-white border border-slate-200 rounded-2xl px-4 py-3 hover:shadow-md cursor-pointer transition-all"
                >
                  <div>
                    <span className="font-medium">{e.title}</span>
                    <span className="text-xs text-slate-400 ml-2">{e.short_count} short + {e.long_count} long</span>
                  </div>
                  <span className="text-sm text-slate-400">~35 min</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Active section (answering questions) ──
  if (s.phase === "section" && s.activeSection) {
    const sec = s.activeSection;
    const seconds = sec.default_minutes * 60;
    const q = s.questions[s.questionIndex];
    const total = s.questions.length;
    const isLast = s.questionIndex >= total - 1;

    return (
      <div className="max-w-lg mx-auto">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="font-semibold">{sec.label}</p>
            <p className="text-xs text-slate-400">
              {total > 0 ? `Question ${s.questionIndex + 1} / ${total}` : "Loading..."}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Timer
              initialSeconds={seconds}
              onExpired={() => set((p) => ({ ...p, timerExpired: true }))}
            />
            <button onClick={reset} className="text-xs text-slate-400 hover:text-red-500">Exit</button>
          </div>
        </div>

        {/* Progress bar */}
        {total > 0 && (
          <div className="w-full bg-slate-200 rounded-full h-1.5 mb-6">
            <div
              className="bg-blue-500 h-1.5 rounded-full transition-all"
              style={{ width: `${((s.questionIndex) / total) * 100}%` }}
            />
          </div>
        )}

        {s.loadingQuestions && <p className="text-slate-400 text-sm text-center py-8">Loading questions...</p>}

        {q && <QuestionCard question={q} answer={s.answers[q.id] ?? ""} onAnswer={(a) => setAnswer(q.id, a)} />}

        {q && (
          <div className="flex gap-2 mt-4">
            {s.questionIndex > 0 && (
              <button
                onClick={() => set((p) => ({ ...p, questionIndex: p.questionIndex - 1 }))}
                className="flex-1 border border-slate-300 py-2.5 rounded-xl text-sm hover:bg-slate-50"
              >
                Previous
              </button>
            )}
            {!isLast ? (
              <button
                onClick={() => set((p) => ({ ...p, questionIndex: p.questionIndex + 1 }))}
                className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-2.5 rounded-xl font-semibold hover:from-blue-700 hover:to-indigo-700"
              >
                Next
              </button>
            ) : (
              <button
                onClick={submitSection}
                disabled={s.submitting}
                className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 text-white py-2.5 rounded-xl font-semibold hover:from-green-700 hover:to-emerald-700 disabled:opacity-50"
              >
                {s.submitting ? "Grading..." : "Submit Section"}
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  // ── Section review (graded) ──
  if (s.phase === "section_review" && s.activeSection) {
    const sec = s.activeSection;
    return (
      <div className="max-w-lg mx-auto space-y-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-6 text-center">
          <p className="text-sm text-slate-500">{sec.label}</p>
          <p className={`text-4xl font-bold mt-1 ${(s.sectionScore ?? 0) >= PASS_SCORE ? "text-green-600" : "text-red-500"}`}>
            {s.sectionScore}%
          </p>
          <p className={`text-sm font-medium mt-1 ${(s.sectionScore ?? 0) >= PASS_SCORE ? "text-green-600" : "text-red-500"}`}>
            {(s.sectionScore ?? 0) >= PASS_SCORE ? "PASS" : "FAIL"}
          </p>
        </div>

        {/* Review each question */}
        <div className="space-y-3">
          {s.gradedItems.map((item, i) => {
            const q = s.questions.find((qq) => qq.id === item.question_id);
            return (
              <div key={item.question_id} className={`bg-white rounded-2xl border p-4 ${item.correct ? "border-green-200" : "border-red-200"}`}>
                <div className="flex items-start gap-2 mb-2">
                  <span className={`text-sm font-bold ${item.correct ? "text-green-600" : "text-red-500"}`}>
                    {item.correct ? "\u2713" : "\u2717"}
                  </span>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{q?.question_nl || q?.prompt_nl || q?.situation_nl || `Question ${i + 1}`}</p>
                    {q?.question_en && <p className="text-xs text-slate-400">{q.question_en}</p>}
                  </div>
                </div>
                {!item.correct && item.correct_answer && q?.options && (
                  <div className="text-xs space-y-1 ml-6">
                    <p className="text-red-500">Your answer: {item.user_answer} — {q.options[item.user_answer]}</p>
                    <p className="text-green-600">Correct: {item.correct_answer} — {q.options[item.correct_answer]}</p>
                  </div>
                )}
                {item.explanation && (
                  <p className="text-xs text-slate-500 ml-6 mt-1">{item.explanation}</p>
                )}
              </div>
            );
          })}
        </div>

        <button
          onClick={nextAfterReview}
          className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 rounded-xl font-semibold hover:from-blue-700 hover:to-indigo-700 shadow-md"
        >
          {s.mode === "full" && s.sectionQueue.length > 0
            ? `Next: ${s.sectionQueue[0].label}`
            : "See Results"}
        </button>
      </div>
    );
  }

  // ── Final results ──
  if (s.phase === "results" && s.finalResult) {
    const done = Object.values(s.finalResult.scores).filter((v) => v !== null) as number[];
    const avg = s.finalResult.avg_score ?? 0;

    return (
      <div className="max-w-lg mx-auto space-y-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-6 text-center">
          <p className="text-sm text-slate-500">Overall Score</p>
          <p className={`text-5xl font-bold mt-1 ${avg >= PASS_SCORE ? "text-green-600" : "text-red-500"}`}>{avg}%</p>
          <p className={`text-lg font-semibold mt-1 ${s.finalResult.passed ? "text-green-600" : "text-red-500"}`}>
            {s.finalResult.passed ? "PASSED" : "FAILED"}
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-2">
          {s.examData?.sections.map((sec) => {
            const sc = s.finalResult!.scores[sec.code];
            if (sc === null || sc === undefined) return null;
            const pass = sc >= PASS_SCORE;
            return (
              <div key={sec.code} className="flex justify-between text-sm">
                <span>{sec.label}</span>
                <span className={`font-semibold ${pass ? "text-green-600" : "text-red-500"}`}>
                  {sc}% — {pass ? "PASS" : "FAIL"}
                </span>
              </div>
            );
          })}
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => nav("/study-material")}
            className="flex-1 border border-slate-300 py-2 rounded-xl text-sm hover:bg-slate-50"
          >
            See history
          </button>
          <button
            onClick={reset}
            className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-2 rounded-xl text-sm font-semibold hover:from-blue-700 hover:to-indigo-700"
          >
            New exam
          </button>
        </div>
      </div>
    );
  }

  return null;
}

// ── Question rendering ──

function QuestionCard({
  question: q,
  answer,
  onAnswer,
}: {
  question: ExamQuestion;
  answer: string;
  onAnswer: (a: string) => void;
}) {
  const sec = q.section;

  // MC sections: LZ, LU, KNM
  if (sec === "LZ" || sec === "LU" || sec === "KNM") {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 shadow p-6 space-y-4">
        {/* Reading passage */}
        {q.text_nl && (
          <div className="bg-slate-50 rounded-xl p-4">
            <p className="text-sm leading-relaxed">{q.text_nl}</p>
          </div>
        )}
        {/* Listening scenario */}
        {q.scenario_nl && (
          <div className="bg-blue-50 rounded-xl p-4">
            <p className="text-xs font-semibold text-blue-600 uppercase mb-1">Scenario</p>
            <p className="text-sm leading-relaxed">{q.scenario_nl}</p>
          </div>
        )}
        {/* Question */}
        <p className="font-medium">{q.question_nl}</p>
        {q.question_en && <p className="text-xs text-slate-400 -mt-2">{q.question_en}</p>}
        {/* Options */}
        {q.options && (
          <div className="space-y-2">
            {Object.entries(q.options).map(([key, val]) => (
              <button
                key={key}
                onClick={() => onAnswer(key)}
                className={`w-full text-left px-4 py-3 rounded-xl border text-sm transition-all ${
                  answer === key
                    ? "border-blue-500 bg-blue-50 font-medium"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <span className="font-semibold mr-2">{key}.</span>
                {val}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Writing section
  if (sec === "SC") {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 shadow p-6 space-y-4">
        <div className="bg-amber-50 rounded-xl p-4">
          <p className="text-xs font-semibold text-amber-600 uppercase mb-1">Situation</p>
          <p className="text-sm">{q.prompt_nl}</p>
          {q.prompt_en && <p className="text-xs text-slate-400 mt-1">{q.prompt_en}</p>}
        </div>
        <p className="font-medium text-sm">{q.task_nl}</p>
        {q.task_en && <p className="text-xs text-slate-400 -mt-2">{q.task_en}</p>}
        <textarea
          value={answer}
          onChange={(e) => onAnswer(e.target.value)}
          placeholder="Schrijf hier je antwoord..."
          rows={5}
          className="w-full border border-slate-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
        />
      </div>
    );
  }

  // Speaking section
  if (sec === "SP") {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 shadow p-6 space-y-4">
        <div className="bg-purple-50 rounded-xl p-4">
          <p className="text-xs font-semibold text-purple-600 uppercase mb-1">Situation</p>
          <p className="text-sm">{q.situation_nl}</p>
          {q.situation_en && <p className="text-xs text-slate-400 mt-1">{q.situation_en}</p>}
        </div>
        {q.expected_phrases && (
          <div>
            <p className="text-xs text-slate-500 mb-1">Expected phrases to use:</p>
            <div className="flex flex-wrap gap-1">
              {q.expected_phrases.map((p, i) => (
                <span key={i} className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">{p}</span>
              ))}
            </div>
          </div>
        )}
        <p className="text-xs text-slate-400">Speaking practice — say your response out loud, then mark as done.</p>
        <button
          onClick={() => onAnswer("done")}
          className={`w-full py-3 rounded-xl text-sm font-medium transition-all ${
            answer === "done"
              ? "bg-green-100 text-green-700 border border-green-300"
              : "border border-slate-200 hover:bg-slate-50"
          }`}
        >
          {answer === "done" ? "\u2713 Done" : "Mark as done"}
        </button>
      </div>
    );
  }

  return null;
}
