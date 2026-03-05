import { createContext, useContext, useState, Dispatch, SetStateAction, ReactNode } from "react";
import { SessionOut } from "../api";

type Phase = "setup" | "loading" | "empty" | "front" | "back" | "done";
type Directions = "nl_en" | "en_nl" | "both";
type SpellingResult = "pending" | "correct" | "wrong" | null;

export interface FlashcardsState {
  session: SessionOut | null;
  index: number;
  phase: Phase;
  flipped: boolean;
  stats: { forget: number; blurry: number; remember: number; mastered: number };
  submitting: boolean;
  loaded: boolean;
  // Mode selection
  directions: Directions;
  spellingMode: boolean;
  spellingInput: string;
  spellingResult: SpellingResult;
}

const INITIAL: FlashcardsState = {
  session: null,
  index: 0,
  phase: "setup",
  flipped: false,
  stats: { forget: 0, blurry: 0, remember: 0, mastered: 0 },
  submitting: false,
  loaded: false,
  directions: "both",
  spellingMode: false,
  spellingInput: "",
  spellingResult: null,
};

interface Ctx {
  state: FlashcardsState;
  set: Dispatch<SetStateAction<FlashcardsState>>;
  reset: () => void;
}

const FlashcardsCtx = createContext<Ctx>(null!);

export function FlashcardsProvider({ children }: { children: ReactNode }) {
  const [state, set] = useState(INITIAL);
  const reset = () => set(INITIAL);
  return <FlashcardsCtx.Provider value={{ state, set, reset }}>{children}</FlashcardsCtx.Provider>;
}

export function useFlashcardsState() {
  return useContext(FlashcardsCtx);
}

export function isFlashcardsActive(state: FlashcardsState) {
  return state.loaded && state.phase !== "done" && state.phase !== "empty" && state.phase !== "loading" && state.phase !== "setup";
}
