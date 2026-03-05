import { createContext, useContext, useState, Dispatch, SetStateAction, ReactNode } from "react";
import { ExamQuestion, ExamResultOut, ExamSessionOut, GradedItem, SectionInfo } from "../api";

type Phase = "menu" | "section" | "section_review" | "results";

export interface MockExamState {
  examData: ExamSessionOut | null;
  scores: Record<string, number | null>;
  phase: Phase;
  activeSection: SectionInfo | null;
  timerExpired: boolean;
  finalResult: ExamResultOut | null;
  submitting: boolean;
  mode: "full" | "single";
  sectionQueue: SectionInfo[];
  loaded: boolean;
  // Question state
  questions: ExamQuestion[];
  questionIndex: number;
  answers: Record<string, string>;  // question_id -> answer
  gradedItems: GradedItem[];
  sectionScore: number | null;
  loadingQuestions: boolean;
}

const INITIAL: MockExamState = {
  examData: null,
  scores: {},
  phase: "menu",
  activeSection: null,
  timerExpired: false,
  finalResult: null,
  submitting: false,
  mode: "full",
  sectionQueue: [],
  loaded: false,
  questions: [],
  questionIndex: 0,
  answers: {},
  gradedItems: [],
  sectionScore: null,
  loadingQuestions: false,
};

interface Ctx {
  state: MockExamState;
  set: Dispatch<SetStateAction<MockExamState>>;
  reset: () => void;
}

const MockExamCtx = createContext<Ctx>(null!);

export function MockExamProvider({ children }: { children: ReactNode }) {
  const [state, set] = useState(INITIAL);
  const reset = () => set(INITIAL);
  return <MockExamCtx.Provider value={{ state, set, reset }}>{children}</MockExamCtx.Provider>;
}

export function useMockExamState() {
  return useContext(MockExamCtx);
}

export function isMockExamActive(state: MockExamState) {
  return state.phase !== "menu";
}
