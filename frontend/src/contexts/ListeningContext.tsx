import { createContext, useContext, useState, Dispatch, SetStateAction, ReactNode } from "react";
import { GenerateResponse, GenerateIntensiveResponse, SubmitListeningResponse, SubmitIntensiveResponse } from "../api";

type Phase = "idle" | "generating" | "pre_play" | "quiz" | "results" | "explain";
type IntensivePhase = "idle" | "select" | "generating" | "dictation" | "results";

export type ListeningMode = "quiz" | "intensive";
export type ListeningLevel = "A1" | "A2" | "B1";
export type ContentType = "dialogue" | "news" | "article";

export interface ListeningState {
  phase: Phase;
  mode: ListeningMode;
  level: ListeningLevel;
  data: GenerateResponse | null;
  answers: string[];
  result: SubmitListeningResponse | null;
  explanation: string;
  explaining: boolean;
  error: string;
  currentAudio: number;
  playing: boolean;
  startedAt: number | null;
}

export interface IntensiveState {
  phase: IntensivePhase;
  level: ListeningLevel;
  contentType: ContentType;
  data: GenerateIntensiveResponse | null;
  currentLine: number;
  userTexts: string[];
  result: SubmitIntensiveResponse | null;
  error: string;
  submitting: boolean;
  startedAt: number | null;
}

const INITIAL: ListeningState = {
  phase: "idle",
  mode: "quiz",
  level: "A2",
  data: null,
  answers: [],
  result: null,
  explanation: "",
  explaining: false,
  error: "",
  currentAudio: 0,
  playing: false,
  startedAt: null,
};

const INITIAL_INTENSIVE: IntensiveState = {
  phase: "idle",
  level: "A2",
  contentType: "dialogue",
  data: null,
  currentLine: 0,
  userTexts: [],
  result: null,
  error: "",
  submitting: false,
  startedAt: null,
};

interface Ctx {
  state: ListeningState;
  set: Dispatch<SetStateAction<ListeningState>>;
  reset: () => void;
  intensive: IntensiveState;
  setIntensive: Dispatch<SetStateAction<IntensiveState>>;
  resetIntensive: () => void;
}

const ListeningCtx = createContext<Ctx>(null!);

export function ListeningProvider({ children }: { children: ReactNode }) {
  const [state, set] = useState(INITIAL);
  const [intensive, setIntensive] = useState(INITIAL_INTENSIVE);
  const reset = () => set(INITIAL);
  const resetIntensive = () => setIntensive(INITIAL_INTENSIVE);
  return (
    <ListeningCtx.Provider value={{ state, set, reset, intensive, setIntensive, resetIntensive }}>
      {children}
    </ListeningCtx.Provider>
  );
}

export function useListeningState() {
  return useContext(ListeningCtx);
}

export function isListeningActive(state: ListeningState) {
  return state.phase !== "idle";
}
