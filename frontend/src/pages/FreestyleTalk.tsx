import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAudioRecorder } from "../hooks/useAudioRecorder";
import { freestyleChat, FreestyleEvent, speakingAudioUrl } from "../api";

type State = "idle" | "recording" | "processing" | "playing";

interface Message {
  role: "user" | "assistant";
  content: string;
}

// Silence detection constants
const SILENCE_THRESHOLD = 0.03;
const SILENCE_FRAMES = 90; // ~1.5s at 60fps
const MIN_RECORD_MS = 1000;

const BASE = "";

export default function FreestyleTalk() {
  const [state, setState] = useState<State>("idle");
  const [subtitle, setSubtitle] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recorder = useAudioRecorder();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioQueueRef = useRef<string[]>([]);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const playingSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const amplitudeRef = useRef(0);
  const stateRef = useRef<State>("idle");
  const abortRef = useRef<AbortController | null>(null);
  const doneReceivedRef = useRef(false);

  // Silence detection refs
  const silentFramesRef = useRef(0);
  const autoStopTriggeredRef = useRef(false);
  const recordingStartRef = useRef(0);

  // Expanding ring pulse state
  const pulseRingsRef = useRef<{ born: number; }[]>([]);

  // Keep stateRef in sync
  useEffect(() => { stateRef.current = state; }, [state]);

  // Trigger pulse ring on state change to "playing" or subtitle change
  const prevSubtitleRef = useRef("");
  useEffect(() => {
    if (state === "playing" && subtitle && subtitle !== prevSubtitleRef.current) {
      pulseRingsRef.current.push({ born: performance.now() });
    }
    prevSubtitleRef.current = subtitle;
  }, [state, subtitle]);

  // --- Audio Context setup ---
  const getAudioCtx = useCallback(() => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioContext();
    }
    return audioCtxRef.current;
  }, []);

  const getAnalyser = useCallback(() => {
    if (!analyserRef.current) {
      const ctx = getAudioCtx();
      analyserRef.current = ctx.createAnalyser();
      analyserRef.current.fftSize = 256;
      analyserRef.current.connect(ctx.destination);
    }
    return analyserRef.current;
  }, [getAudioCtx]);

  // --- Canvas visualization ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId = 0;
    let smoothAmp = 0;
    let time = 0;
    let dotAngle = 0;

    const resize = () => {
      canvas.width = canvas.clientWidth * window.devicePixelRatio;
      canvas.height = canvas.clientHeight * window.devicePixelRatio;
    };
    resize();
    window.addEventListener("resize", resize);

    const draw = () => {
      animId = requestAnimationFrame(draw);
      const now = performance.now();
      time += 0.02;
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      // Read analyser data
      let targetAmp = 0;
      const analyser = analyserRef.current;
      if (analyser && (stateRef.current === "recording" || stateRef.current === "playing")) {
        const data = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b, 0) / data.length;
        targetAmp = avg / 255;
      } else if (stateRef.current === "processing") {
        targetAmp = 0.15 + 0.1 * Math.sin(time * 2);
      } else {
        targetAmp = 0.05 + 0.03 * Math.sin(time * 1.5);
      }

      // --- Silence detection (recording only) ---
      if (stateRef.current === "recording") {
        if (targetAmp < SILENCE_THRESHOLD) {
          silentFramesRef.current++;
        } else {
          silentFramesRef.current = 0;
        }
        const elapsed = now - recordingStartRef.current;
        if (
          silentFramesRef.current > SILENCE_FRAMES &&
          elapsed > MIN_RECORD_MS &&
          !autoStopTriggeredRef.current
        ) {
          autoStopTriggeredRef.current = true;
          // Use setTimeout to avoid calling stop inside rAF synchronously
          setTimeout(() => recorder.stop(), 0);
        }
      }

      smoothAmp += (targetAmp - smoothAmp) * 0.12;
      amplitudeRef.current = smoothAmp;

      const cx = w / 2;
      const cy = h * 0.40;
      const baseR = Math.min(w, h) * 0.15;
      const dpr = window.devicePixelRatio;

      // --- A. Background radial glow ---
      const bgGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, baseR * 3);
      const glowAlpha = 0.08 + smoothAmp * 0.15;
      bgGlow.addColorStop(0, `rgba(56, 189, 248, ${glowAlpha})`);
      bgGlow.addColorStop(0.5, `rgba(56, 189, 248, ${glowAlpha * 0.3})`);
      bgGlow.addColorStop(1, "transparent");
      ctx.fillStyle = bgGlow;
      ctx.fillRect(0, 0, w, h);

      // --- B. Glowing sphere cluster ---
      const scale = 1 + smoothAmp * 0.3;
      const outerGlowAlpha = 0.3 + smoothAmp * 0.5;

      // Save and apply blur via shadow (canvas filter not universally supported)
      // Main sphere
      const mainGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, baseR * scale);
      mainGrad.addColorStop(0, `rgba(255, 255, 255, ${0.9 * outerGlowAlpha})`);
      mainGrad.addColorStop(0.3, `rgba(125, 211, 252, ${0.7 * outerGlowAlpha})`);
      mainGrad.addColorStop(0.7, `rgba(56, 189, 248, ${0.3 * outerGlowAlpha})`);
      mainGrad.addColorStop(1, "transparent");
      ctx.fillStyle = mainGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, baseR * scale, 0, Math.PI * 2);
      ctx.fill();

      // Satellite blobs (2-3 offset circles)
      const satellites = [
        { phase: 0, dist: 0.35, size: 0.6, color: [56, 189, 248] },
        { phase: 2.1, dist: 0.3, size: 0.5, color: [125, 211, 252] },
        { phase: 4.2, dist: 0.25, size: 0.45, color: [186, 230, 253] },
      ];
      for (const sat of satellites) {
        const angle = time * 0.8 + sat.phase;
        const dist = baseR * sat.dist * (1 + smoothAmp * 0.5);
        const sx = cx + Math.cos(angle) * dist;
        const sy = cy + Math.sin(angle) * dist;
        const sr = baseR * sat.size * scale;
        const sGrad = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr);
        sGrad.addColorStop(0, `rgba(${sat.color.join(",")}, ${0.5 * outerGlowAlpha})`);
        sGrad.addColorStop(1, "transparent");
        ctx.fillStyle = sGrad;
        ctx.beginPath();
        ctx.arc(sx, sy, sr, 0, Math.PI * 2);
        ctx.fill();
      }

      // Core bright spot
      const coreGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, baseR * 0.25 * scale);
      coreGrad.addColorStop(0, `rgba(255, 255, 255, ${0.8 + smoothAmp * 0.2})`);
      coreGrad.addColorStop(1, "transparent");
      ctx.fillStyle = coreGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, baseR * 0.25 * scale, 0, Math.PI * 2);
      ctx.fill();

      // --- C. Orbiting dots ---
      const dotCount = 10;
      const orbitRx = baseR * 1.6 * scale;
      const orbitRy = baseR * 1.2 * scale;
      const dotSpeed = stateRef.current === "recording" || stateRef.current === "playing"
        ? 0.02 + smoothAmp * 0.06
        : stateRef.current === "processing"
          ? 0.015
          : 0.005;
      dotAngle += dotSpeed;

      for (let i = 0; i < dotCount; i++) {
        const a = dotAngle + (i / dotCount) * Math.PI * 2;
        const dx = cx + Math.cos(a) * orbitRx;
        const dy = cy + Math.sin(a) * orbitRy;
        // Fade based on position (dimmer at sides)
        const posFade = 0.3 + 0.7 * Math.abs(Math.sin(a));
        const dotAlpha = (0.4 + smoothAmp * 0.6) * posFade;
        const dotR = (2 + smoothAmp * 2) * dpr;
        ctx.beginPath();
        ctx.arc(dx, dy, dotR, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(186, 230, 253, ${dotAlpha})`;
        ctx.fill();
      }

      // --- D. Expanding pulse rings ---
      const pulses = pulseRingsRef.current;
      for (let i = pulses.length - 1; i >= 0; i--) {
        const age = (now - pulses[i].born) / 1000; // seconds
        if (age > 1.5) {
          pulses.splice(i, 1);
          continue;
        }
        const progress = age / 1.5;
        const ringR = baseR * (1 + progress * 2.5);
        const ringAlpha = 0.5 * (1 - progress);
        ctx.beginPath();
        ctx.arc(cx, cy, ringR, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(56, 189, 248, ${ringAlpha})`;
        ctx.lineWidth = 1.5 * dpr * (1 - progress * 0.5);
        ctx.stroke();
      }

      // --- Processing: rotating arc ---
      if (stateRef.current === "processing") {
        const arcR = baseR * 1.8;
        ctx.beginPath();
        ctx.arc(cx, cy, arcR, time * 1.5, time * 1.5 + Math.PI * 0.6);
        ctx.strokeStyle = `rgba(56, 189, 248, 0.4)`;
        ctx.lineWidth = 2 * dpr;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx, cy, arcR, time * 1.5 + Math.PI, time * 1.5 + Math.PI * 1.4);
        ctx.stroke();
      }
    };

    draw();
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  // --- Connect mic stream to analyser when recording ---
  useEffect(() => {
    if (!recorder.isRecording || !recorder.streamRef.current) return;
    const ctx = getAudioCtx();
    if (ctx.state === "suspended") ctx.resume();
    const source = ctx.createMediaStreamSource(recorder.streamRef.current);
    const analyser = getAnalyser();
    analyser.disconnect();
    source.connect(analyser);
    return () => {
      source.disconnect();
      analyser.connect(ctx.destination);
    };
  }, [recorder.isRecording, recorder.streamRef, getAudioCtx, getAnalyser]);

  // --- Audio playback queue ---
  const playNext = useCallback(() => {
    const queue = audioQueueRef.current;
    if (queue.length === 0) {
      if (doneReceivedRef.current) {
        setState("idle");
        setSubtitle("");
      }
      return;
    }
    const filename = queue.shift()!;
    const url = speakingAudioUrl(filename);
    const localUrl = `${BASE}/audio_speaking/${filename}`;

    const audio = new Audio();
    currentAudioRef.current = audio;

    const ctx = getAudioCtx();
    if (ctx.state === "suspended") ctx.resume();

    const tryPlay = (src: string, fallback?: string) => {
      audio.src = src;
      audio.crossOrigin = "anonymous";

      const onCanPlay = () => {
        audio.removeEventListener("canplaythrough", onCanPlay);
        audio.removeEventListener("error", onError);
        try {
          if (!playingSourceRef.current || playingSourceRef.current.mediaElement !== audio) {
            playingSourceRef.current = ctx.createMediaElementSource(audio);
          }
          playingSourceRef.current.connect(getAnalyser());
        } catch {
          // Source may already be connected
        }
        audio.play().catch(() => {});
      };

      const onError = () => {
        audio.removeEventListener("canplaythrough", onCanPlay);
        audio.removeEventListener("error", onError);
        if (fallback) {
          tryPlay(fallback);
        } else {
          playNext();
        }
      };

      audio.addEventListener("canplaythrough", onCanPlay);
      audio.addEventListener("error", onError);
      audio.load();
    };

    audio.onended = () => {
      playingSourceRef.current = null;
      currentAudioRef.current = null;
      playNext();
    };

    tryPlay(url, localUrl);
  }, [getAudioCtx, getAnalyser]);

  // --- Handle SSE events ---
  const handleEvent = useCallback((event: FreestyleEvent) => {
    if (event.type === "transcript") {
      setMessages(prev => [...prev, { role: "user", content: event.text ?? "" }]);
      setSubtitle("");
      setState("playing");
    } else if (event.type === "sentence") {
      setSubtitle(event.text ?? "");
      if (event.audio) {
        audioQueueRef.current.push(event.audio);
        if (stateRef.current === "playing" && !currentAudioRef.current) {
          playNext();
        }
      }
    } else if (event.type === "done") {
      doneReceivedRef.current = true;
      setMessages(prev => [...prev, { role: "assistant", content: event.full_text ?? "" }]);
      if (!currentAudioRef.current && audioQueueRef.current.length === 0) {
        setState("idle");
        setSubtitle("");
      }
    }
  }, [playNext]);

  // --- Mic button handler ---
  const handleMicPress = useCallback(async () => {
    setError(null);
    if (state === "recording") {
      recorder.stop();
    } else if (state === "idle") {
      doneReceivedRef.current = false;
      audioQueueRef.current = [];
      silentFramesRef.current = 0;
      autoStopTriggeredRef.current = false;
      recordingStartRef.current = performance.now();
      setState("recording");
      await recorder.start();
    }
  }, [state, recorder]);

  // --- When audioBlob is ready, send to backend ---
  useEffect(() => {
    if (!recorder.audioBlob || state === "idle") return;
    setState("processing");
    setSubtitle("Thinking...");

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    const historyToSend = messages.slice(-20);

    freestyleChat(recorder.audioBlob, historyToSend, handleEvent, ctrl.signal)
      .catch((err) => {
        if (err.name !== "AbortError") {
          setError(err.message);
          setState("idle");
          setSubtitle("");
        }
      })
      .finally(() => {
        recorder.reset();
      });
  }, [recorder.audioBlob]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      currentAudioRef.current?.pause();
      if (audioCtxRef.current?.state !== "closed") {
        audioCtxRef.current?.close();
      }
    };
  }, []);

  const statusText = state === "recording"
    ? "Listening..."
    : state === "processing"
      ? "Processing..."
      : state === "playing"
        ? ""
        : "Tap to speak";

  return (
    <div className="fixed inset-0 flex flex-col z-50" style={{
      background: "linear-gradient(to bottom, #0f172a 0%, #020617 100%)",
    }}>
      {/* Header — transparent overlay */}
      <div className="relative z-10 flex items-center justify-between px-4 pt-4 pb-2">
        <Link to="/study/speaking" className="text-sky-400 hover:text-sky-300 text-sm flex items-center gap-1">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          Back
        </Link>
        <div className="flex items-center gap-2">
          <h1 className="text-white font-semibold text-lg">Freestyle Talk</h1>
          <span className="bg-sky-500/20 text-sky-300 text-[10px] px-2 py-0.5 rounded-full font-medium">BETA</span>
        </div>
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="text-sky-400 hover:text-sky-300 text-xs"
        >
          {showHistory ? "Close" : "History"}
        </button>
      </div>

      {/* History drawer */}
      {showHistory && (
        <div className="relative z-10 mx-4 mb-2 max-h-60 overflow-y-auto bg-slate-800/80 rounded-xl p-3 space-y-2 backdrop-blur">
          {messages.length === 0 && (
            <p className="text-slate-500 text-sm text-center">No messages yet</p>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`text-sm ${m.role === "user" ? "text-sky-300" : "text-white"}`}>
              <span className="text-xs text-slate-500 mr-1">{m.role === "user" ? "You:" : "AI:"}</span>
              {m.content}
            </div>
          ))}
        </div>
      )}

      {/* Canvas visualization */}
      <div className="flex-1 relative">
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

        {/* Subtitle overlay */}
        <div className="absolute bottom-28 left-0 right-0 flex justify-center px-6">
          {subtitle && subtitle !== "Thinking..." && (
            <p className="text-white text-lg font-medium text-center bg-black/40 backdrop-blur-md rounded-2xl px-5 py-3 max-w-md animate-fadeIn">
              {subtitle}
            </p>
          )}
          {subtitle === "Thinking..." && (
            <p className="text-sky-300/70 text-sm font-medium text-center">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      {/* Error */}
      {(error || recorder.error) && (
        <div className="mx-4 mb-2 text-red-400 text-sm text-center bg-red-900/30 rounded-lg p-2">
          {error || recorder.error}
          {recorder.permissionDenied && <span className="block text-xs mt-1">Please allow microphone access in your browser settings.</span>}
        </div>
      )}

      {/* Mic button + status */}
      <div className="flex flex-col items-center pb-8 pt-2">
        <button
          onClick={handleMicPress}
          disabled={state === "processing" || state === "playing"}
          className={`w-18 h-18 rounded-full flex items-center justify-center transition-all duration-300 ${
            state === "recording"
              ? "bg-red-500 border-2 border-red-400 shadow-[0_0_20px_rgba(239,68,68,0.5)] animate-pulse"
              : state === "processing" || state === "playing"
                ? "border-2 border-sky-800 bg-transparent cursor-not-allowed opacity-50"
                : "border-2 border-sky-400 bg-transparent hover:bg-sky-400/10 shadow-[0_0_15px_rgba(56,189,248,0.2)]"
          }`}
        >
          {state === "recording" ? (
            <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 24 24">
              <rect x="6" y="6" width="12" height="12" rx="2" />
            </svg>
          ) : (
            <svg className="w-7 h-7 text-sky-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
            </svg>
          )}
        </button>
        {statusText && <p className="text-slate-500 text-xs mt-3">{statusText}</p>}
      </div>
    </div>
  );
}
