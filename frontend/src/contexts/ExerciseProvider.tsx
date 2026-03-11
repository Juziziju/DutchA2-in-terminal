import { createContext, ReactNode, useContext, useState } from "react";
import { ListeningProvider, useListeningState, isListeningActive } from "./ListeningContext";
import { FlashcardsProvider, useFlashcardsState, isFlashcardsActive } from "./FlashcardsContext";
import { MockExamProvider, useMockExamState, isMockExamActive } from "./MockExamContext";

// Spreken exam guard context
const SprekenExamContext = createContext<{
  sprekenExamActive: boolean;
  setSprekenExamActive: (v: boolean) => void;
}>({ sprekenExamActive: false, setSprekenExamActive: () => {} });

export function useSprekenExamGuard() {
  return useContext(SprekenExamContext);
}

function SprekenExamProvider({ children }: { children: ReactNode }) {
  const [sprekenExamActive, setSprekenExamActive] = useState(false);
  return (
    <SprekenExamContext.Provider value={{ sprekenExamActive, setSprekenExamActive }}>
      {children}
    </SprekenExamContext.Provider>
  );
}

export function ExerciseProvider({ children }: { children: ReactNode }) {
  return (
    <ListeningProvider>
      <FlashcardsProvider>
        <MockExamProvider>
          <SprekenExamProvider>
            {children}
          </SprekenExamProvider>
        </MockExamProvider>
      </FlashcardsProvider>
    </ListeningProvider>
  );
}

export function useActiveExercises() {
  const { state: listening } = useListeningState();
  const { state: flashcards } = useFlashcardsState();
  const { state: mockExam } = useMockExamState();

  return {
    listening: isListeningActive(listening),
    flashcards: isFlashcardsActive(flashcards),
    mockExam: isMockExamActive(mockExam),
  };
}
