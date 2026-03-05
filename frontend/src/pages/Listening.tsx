import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  DialogueLine,
  GenerateResponse,
  Question,
  SubmitListeningResponse,
  explainListening,
  generateListening,
  submitListening,
} from "../api";
import AudioPlayer from "../components/AudioPlayer";
import ScoreCard from "../components/ScoreCard";

type Phase = "idle" | "generating" | "pre_play" | "quiz" | "results" | "explain";

export default function Listening() {
  const nav = useNavigate();
  const [phase, setPhase] = useState<Phase>("idle");
  const [data, setData] = useState<GenerateResponse | null>(null);
  const [answers, setAnswers] = useState<string[]>([]);
  const [result, setResult] = useState<SubmitListeningResponse | null>(null);
  const [explanation, setExplanation] = useState("");
  const [explaining, setExplaining] = useState(false);
  const [error, setError] = useState("");
  const [currentAudio, setCurrentAudio] = useState(0);
  const [playing, setPlaying] = useState(false);

  async function handleGenerate() {
    setPhase("generating");
    setError("");
    try {
      const resp = await generateListening();
      setData(resp);
      setAnswers([]);
      setCurrentAudio(0);
      setPlaying(false);
      setPhase("pre_play");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Generation failed.");
      setPhase("idle");
    }
  }

  function startPlayback() {
    setCurrentAudio(0);
    setPlaying(true);
  }

  function onLineEnded() {
    const next = currentAudio + 1;
    if (data && next < data.dialogue.length) {
      setCurrentAudio(next);
    } else {
      setPlaying(false);
    }
  }

  function selectAnswer(qIdx: number, letter: string) {
    setAnswers((prev) => {
      const a = [...prev];
      a[qIdx] = letter;
      return a;
    });
  }

  async function handleSubmit() {
    if (!data) return;
    const resp = await submitListening({
      session_id: data.session_id,
      topic: data.topic,
      dialogue: data.dialogue,
      questions: data.questions,
      user_answers: answers,
      vocab_used: data.vocab_used,
    });
    setResult(resp);
    setPhase("results");
  }

  async function handleExplain() {
    if (!data || !result) return;
    setExplaining(true);
    try {
      const r = await explainListening(data.topic, data.dialogue, data.questions, answers);
      setExplanation(r.explanation);
      setPhase("explain");
    } catch (e: unknown) {
      setExplanation(e instanceof Error ? e.message : "Failed.");
      setPhase("explain");
    } finally {
      setExplaining(false);
    }
  }

  // ── Render phases ───────────────────────────────────────────────────────────

  if (phase === "idle" || phase === "generating") {
    return (
      <PageWrap onBack={() => nav("/")}>
        <div className="flex flex-col items-center gap-6 py-12">
          <div className="text-5xl">🎧</div>
          <h2 className="text-xl font-bold">Listening Exercise</h2>
          <p className="text-slate-500 text-sm text-center max-w-xs">
            AI generates a Dutch A2 dialogue using your vocab, then you answer comprehension
            questions.
          </p>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button
            onClick={handleGenerate}
            disabled={phase === "generating"}
            className="bg-blue-600 text-white px-8 py-3 rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50"
          >
            {phase === "generating" ? "Generating..." : "Generate new exercise"}
          </button>
          {phase === "generating" && (
            <p className="text-sm text-slate-400">
              Calling Qwen + gTTS, this takes ~10–20 seconds...
            </p>
          )}
        </div>
      </PageWrap>
    );
  }

  if (phase === "pre_play" && data) {
    const audioSrc =
      playing && data.dialogue[currentAudio]?.audio_file
        ? `/audio_listening/${data.dialogue[currentAudio].audio_file}`
        : null;

    return (
      <PageWrap onBack={() => setPhase("idle")}>
        <div className="max-w-lg mx-auto">
          <h2 className="text-lg font-bold mb-1">Topic: {data.topic}</h2>
          <p className="text-sm text-slate-500 mb-4">
            Speakers: {data.speakers.join(", ")}
          </p>

          {/* Questions preview */}
          <div className="bg-slate-50 rounded-xl p-4 mb-4 space-y-3">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Read the questions before listening
            </p>
            {data.questions.map((q, i) => (
              <div key={i}>
                <p className="text-sm font-medium">
                  Q{i + 1}. {q.question}
                </p>
                <ul className="text-xs text-slate-500 ml-3">
                  {Object.entries(q.options).map(([k, v]) => (
                    <li key={k}>
                      {k}) {v}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Audio player */}
          {playing && audioSrc && (
            <div className="mb-3 bg-blue-50 rounded-xl p-3">
              <p className="text-xs text-slate-500 mb-1">
                Line {currentAudio + 1}/{data.dialogue.length} —{" "}
                {data.dialogue[currentAudio].speaker}
              </p>
              <AudioPlayer src={audioSrc} autoPlay onEnded={onLineEnded} />
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={startPlayback}
              className="flex-1 bg-blue-600 text-white py-2 rounded-xl font-semibold hover:bg-blue-700"
            >
              {playing ? "Replay" : "Play dialogue"}
            </button>
            <button
              onClick={() => setPhase("quiz")}
              className="flex-1 bg-white border border-slate-300 py-2 rounded-xl hover:bg-slate-50"
            >
              Go to questions
            </button>
          </div>
        </div>
      </PageWrap>
    );
  }

  if (phase === "quiz" && data) {
    const allAnswered = answers.length === data.questions.length && answers.every(Boolean);
    return (
      <PageWrap onBack={() => setPhase("pre_play")}>
        <div className="max-w-lg mx-auto space-y-6">
          <h2 className="text-lg font-bold">Questions — {data.topic}</h2>
          {data.questions.map((q, i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-200 p-4">
              <p className="font-medium mb-3">
                Q{i + 1}. {q.question}
              </p>
              <div className="space-y-2">
                {Object.entries(q.options).map(([k, v]) => (
                  <button
                    key={k}
                    onClick={() => selectAnswer(i, k)}
                    className={`w-full text-left px-4 py-2 rounded-lg border text-sm transition-colors ${
                      answers[i] === k
                        ? "border-blue-500 bg-blue-50 text-blue-800"
                        : "border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <span className="font-semibold mr-2">{k})</span>
                    {v}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <button
            onClick={handleSubmit}
            disabled={!allAnswered}
            className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-40"
          >
            Submit answers
          </button>
        </div>
      </PageWrap>
    );
  }

  if (phase === "results" && data && result) {
    return (
      <PageWrap onBack={() => setPhase("pre_play")}>
        <div className="max-w-lg mx-auto space-y-4">
          <ScoreCard
            score={result.score}
            total={result.total}
            scorePct={result.score_pct}
            label={`Topic: ${data.topic}`}
          />

          {/* Per-question breakdown */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-2">
            {data.questions.map((q, i) => {
              const correct = result.correct[i];
              return (
                <div key={i} className="flex items-start gap-2 text-sm">
                  <span className={correct ? "text-green-500" : "text-red-500"}>
                    {correct ? "✓" : "✗"}
                  </span>
                  <div>
                    <p className="text-slate-700">{q.question}</p>
                    {!correct && (
                      <p className="text-xs text-slate-400">
                        Your: {answers[i]}) {q.options[answers[i]]} &nbsp;|&nbsp; Correct:{" "}
                        {q.answer}) {q.options[q.answer]}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleExplain}
              disabled={explaining}
              className="flex-1 border border-slate-300 py-2 rounded-xl text-sm hover:bg-slate-50 disabled:opacity-50"
            >
              {explaining ? "Getting explanation..." : "Explain answers"}
            </button>
            <button
              onClick={handleGenerate}
              className="flex-1 bg-blue-600 text-white py-2 rounded-xl text-sm font-semibold hover:bg-blue-700"
            >
              New exercise
            </button>
          </div>
        </div>
      </PageWrap>
    );
  }

  if (phase === "explain" && data && result) {
    return (
      <PageWrap onBack={() => setPhase("results")}>
        <div className="max-w-lg mx-auto">
          <h2 className="text-lg font-bold mb-4">Explanation — {data.topic}</h2>
          <div className="bg-white rounded-xl border border-slate-200 p-4 text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
            {explanation}
          </div>
          <button
            onClick={() => setPhase("results")}
            className="mt-4 w-full border border-slate-300 py-2 rounded-xl text-sm hover:bg-slate-50"
          >
            Back to results
          </button>
        </div>
      </PageWrap>
    );
  }

  return null;
}

function PageWrap({ children, onBack }: { children: React.ReactNode; onBack: () => void }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-4 py-3">
        <button onClick={onBack} className="text-slate-500 hover:text-slate-800">
          ← Back
        </button>
      </header>
      <main className="p-6">{children}</main>
    </div>
  );
}
