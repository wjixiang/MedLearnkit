import { useState, useCallback, useRef } from "react";
import type { QuizPractice, Oid, QuizOption } from "@/lib/types";

interface UseQuizLogicProps {
  quiz: QuizPractice;
  currentQuizIndex: number;
  thisQuizIndex: number;
}

export function useQuizLogic({
  quiz,
  currentQuizIndex,
  thisQuizIndex,
}: UseQuizLogicProps) {
  const [selected, setSelected] = useState<Oid | undefined>(
    quiz.userAnswer as Oid | undefined,
  );
  const [submitted, setSubmitted] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [subAnswers, setSubAnswers] = useState<Record<number, Oid>>(
    quiz.subAnswers ?? {},
  );
  const [currentSubIndex, setCurrentSubIndex] = useState(0);
  const shuffledOptionsRef = useRef<QuizOption[] | null>(null);

  const isBType = quiz.type === "B" && (quiz.sub_questions?.length ?? 0) > 0;
  const subQuestions = quiz.sub_questions ?? [];

  const getShuffledOptions = useCallback(
    (options: QuizOption[]): QuizOption[] => {
      if (!shuffledOptionsRef.current) {
        shuffledOptionsRef.current = [...options].sort(
          () => Math.random() - 0.5,
        );
      }
      return shuffledOptionsRef.current;
    },
    [],
  );

  const isActive = currentQuizIndex === thisQuizIndex;

  const handleOptionSelect = useCallback(
    (oid: Oid) => {
      if (submitted || !isActive) return;
      if (isBType) {
        setSubAnswers((prev) => ({ ...prev, [currentSubIndex]: oid }));
      } else {
        setSelected(oid);
      }
    },
    [submitted, isActive, isBType, currentSubIndex],
  );

  const handleSubmit = useCallback(
    (_isDifficult?: boolean) => {
      if (submitted || !isActive) return;

      if (isBType) {
        const answeredCount = Object.keys(subAnswers).length;
        if (answeredCount < subQuestions.length) return;
        const correct = subQuestions.every(
          (sq) => subAnswers[sq.question_id] === sq.answer,
        );
        setIsCorrect(correct);
        setSubmitted(true);
      } else {
        if (!selected) return;
        const correct = selected === quiz.answer;
        setIsCorrect(correct);
        setSubmitted(true);
      }
    },
    [submitted, isActive, isBType, subAnswers, subQuestions, selected, quiz.answer],
  );

  const canSubmit = isBType
    ? Object.keys(subAnswers).length >= subQuestions.length
    : !!selected;

  const getCurrentState = useCallback(() => {
    return {
      submitted,
      isCorrect,
      selectedOption: selected,
      subAnswers,
    };
  }, [submitted, isCorrect, selected, subAnswers]);

  const reset = useCallback(() => {
    setSelected(undefined);
    setSubmitted(false);
    setIsCorrect(false);
    setSubAnswers({});
    setCurrentSubIndex(0);
    shuffledOptionsRef.current = null;
  }, []);

  return {
    selected,
    submitted,
    isCorrect,
    subAnswers,
    currentSubIndex,
    setCurrentSubIndex,
    canSubmit,
    isBType,
    subQuestions,
    getShuffledOptions,
    handleOptionSelect,
    handleSubmit,
    getCurrentState,
    reset,
  };
}
