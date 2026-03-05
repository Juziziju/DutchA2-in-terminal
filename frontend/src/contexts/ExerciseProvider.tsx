import { ReactNode } from "react";
import { ListeningProvider, useListeningState, isListeningActive } from "./ListeningContext";
import { FlashcardsProvider, useFlashcardsState, isFlashcardsActive } from "./FlashcardsContext";
import { MockExamProvider, useMockExamState, isMockExamActive } from "./MockExamContext";

export function ExerciseProvider({ children }: { children: ReactNode }) {
  return (
    <ListeningProvider>
      <FlashcardsProvider>
        <MockExamProvider>
          {children}
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
