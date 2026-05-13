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
  const isXType = quiz.type === "X";
  const [selected, setSelected] = useState<Oid[]>(
    isXType ? [] : (quiz.userAnswer ? [quiz.userAnswer as Oid] : []),
  );
  const [submitted, setSubmitted] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [subAnswers, setSubAnswers] = useState<Record<number, Oid>>(
    quiz.subAnswers ?? {},
  );
  const [currentSubIndex, setCurrentSubIndex] = useState(0);
  const shuffledOptionsRef = useRef<QuizOption[] | null>(null);

  const isBType = quiz.type === "B" && (quiz.sub_questions?.length ?? 0) > 0;
  const isA3Type = quiz.type === "A3" && (quiz.sub_questions?.length ?? 0) > 0;
  const isMultiSub = isBType || isA3Type;
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
    (oid: Oid, questionId?: number) => {
      if (submitted || !isActive) return;
      if (isMultiSub) {
        const qId = questionId ?? currentSubIndex;
        setSubAnswers((prev) => ({ ...prev, [qId]: oid }));
      } else if (isXType) {
        setSelected((prev) =>
          prev.includes(oid) ? prev.filter((o) => o !== oid) : [...prev, oid]
        );
      } else {
        setSelected([oid]);
      }
    },
    [submitted, isActive, isMultiSub, isXType, currentSubIndex],
  );

  const handleSubmit = useCallback(
    (_isDifficult?: boolean) => {
      if (submitted || !isActive) return;

      if (isMultiSub) {
        const answeredCount = Object.keys(subAnswers).length;
        if (answeredCount < subQuestions.length) return;
        const correct = subQuestions.every(
          (sq) => subAnswers[sq.question_id] === sq.answer,
        );
        setIsCorrect(correct);
        setSubmitted(true);
      } else if (isXType) {
        if (selected.length === 0) return;
        const answerStr = quiz.answer || "";
        const answerArray = answerStr.split("").filter(Boolean) as Oid[];
        const sortedSelected = [...selected].sort();
        const sortedAnswer = [...answerArray].sort();
        const correct =
          sortedSelected.length === sortedAnswer.length &&
          sortedSelected.every((v, i) => v === sortedAnswer[i]);
        setIsCorrect(correct);
        setSubmitted(true);
      } else {
        if (selected.length === 0) return;
        const correct = selected[0] === quiz.answer;
        setIsCorrect(correct);
        setSubmitted(true);
      }
    },
    [submitted, isActive, isMultiSub, isXType, subAnswers, subQuestions, selected, quiz.answer],
  );

  const canSubmit = isMultiSub
    ? Object.keys(subAnswers).length >= subQuestions.length
    : isXType
      ? selected.length > 0
      : selected.length > 0;

  const getCurrentState = useCallback(() => {
    return {
      submitted,
      isCorrect,
      selectedOption: isXType ? selected : selected[0],
      subAnswers,
    };
  }, [submitted, isCorrect, selected, isXType, subAnswers]);

  const reset = useCallback(() => {
    setSelected(isXType ? [] : []);
    setSubmitted(false);
    setIsCorrect(false);
    setSubAnswers({});
    setCurrentSubIndex(0);
    shuffledOptionsRef.current = null;
  }, [isXType]);

  return {
    selected,
    submitted,
    isCorrect,
    subAnswers,
    currentSubIndex,
    setCurrentSubIndex,
    canSubmit,
    isBType,
    isA3Type,
    isXType,
    isMultiSub,
    subQuestions,
    getShuffledOptions,
    handleOptionSelect,
    handleSubmit,
    getCurrentState,
    reset,
  };
}
