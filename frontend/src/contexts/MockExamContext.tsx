import { createContext, useContext, useState, ReactNode } from "react";

export interface MockExamState {
  active: boolean;
}

const INITIAL: MockExamState = { active: false };

interface Ctx {
  state: MockExamState;
  setActive: (v: boolean) => void;
}

const MockExamCtx = createContext<Ctx>(null!);

export function MockExamProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState(INITIAL);
  const setActive = (v: boolean) => setState({ active: v });
  return <MockExamCtx.Provider value={{ state, setActive }}>{children}</MockExamCtx.Provider>;
}

export function useMockExamState() {
  return useContext(MockExamCtx);
}

export function isMockExamActive(state: MockExamState) {
  return state.active;
}
