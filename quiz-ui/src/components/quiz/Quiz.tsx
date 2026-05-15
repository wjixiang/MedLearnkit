import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { QuizPractice, QuizOption } from "@/lib/types";
import { Check, X } from "lucide-react";
import { useQuizLogic } from "./hooks/useQuizLogic";
import { OptionItem } from "./components/OptionItem";
import { AnswerSection } from "./components/AnswerSection";
import { DiscussionCard } from "./components/DiscussionCard";
import { quizApi } from "@/lib/api";

interface QuizProps {
  quiz: QuizPractice;
  currentQuizIndex: number;
  thisQuizIndex: number;
  onStateChange?: (quizId: string, state: { submitted: boolean; isCorrect: boolean }) => void;
  onPaperAnswer?: (result: {
    quizId: string;
    quizType: string;
    quizClass: string;
    userAnswer: string | null;
    isCorrect: boolean;
    timeSpentSeconds: number;
  }) => void;
  initialState?: { submitted: boolean; isCorrect: boolean; userAnswer?: string | null };
}

export function Quiz({
  quiz,
  currentQuizIndex,
  thisQuizIndex,
  onStateChange,
  onPaperAnswer,
  initialState,
}: QuizProps) {
  const [startTime] = useState(() => Date.now());

  const handlePracticeRecord = useCallback(async (result: {
    quizId: string;
    quizType: string;
    quizClass: string;
    userAnswer: string | null;
    isCorrect: boolean;
    timeSpentSeconds: number;
  }) => {
    try {
      await quizApi.createPracticeRecord({
        quiz_id: result.quizId,
        quiz_type: result.quizType,
        quiz_class: result.quizClass,
        user_answer: result.userAnswer,
        is_correct: result.isCorrect,
        time_spent_seconds: result.timeSpentSeconds,
      });
    } catch (error) {
      console.error("Failed to record practice:", error);
    }
    if (onPaperAnswer) {
      onPaperAnswer(result);
    }
  }, [onPaperAnswer]);

  const {
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
  } = useQuizLogic({
    quiz,
    currentQuizIndex,
    thisQuizIndex,
    onSubmit: handlePracticeRecord,
    startTime,
    initialState,
  });

  useEffect(() => {
    if (submitted && onStateChange) {
      onStateChange(quiz.id, { submitted, isCorrect });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submitted, isCorrect]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (currentQuizIndex !== thisQuizIndex) return;
      const target = event.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      if (isMultiSub) {
        if (event.key === "ArrowDown" && currentSubIndex < subQuestions.length - 1) {
          event.preventDefault();
          setCurrentSubIndex(currentSubIndex + 1);
        } else if (event.key === "ArrowUp" && currentSubIndex > 0) {
          event.preventDefault();
          setCurrentSubIndex(currentSubIndex - 1);
        } else if (event.key >= "1" && event.key <= "5") {
          const optionIndex = parseInt(event.key) - 1;
          let targetOpts: QuizOption[] | undefined;
          let targetQid: number | undefined;

          if (isA3Type && quiz.options_map) {
            const subKeys = Object.keys(quiz.options_map).sort();
            const key = subKeys[currentSubIndex] ?? String(currentSubIndex);
            targetOpts = quiz.options_map[key];
            targetQid = subQuestions[currentSubIndex]?.question_id;
          } else {
            targetOpts = getShuffledOptions(quiz.options);
            targetQid = subQuestions[currentSubIndex]?.question_id;
          }

          if (targetOpts?.[optionIndex]) {
            handleOptionSelect(targetOpts[optionIndex].oid, targetQid);
          }
        } else if ((event.key === "Enter" || event.key === " ") && !submitted) {
          event.preventDefault();
          handleSubmit(false);
        }
      } else {
        if (event.key >= "1" && event.key <= "5") {
          const optionIndex = parseInt(event.key) - 1;
          const shuffled = getShuffledOptions(quiz.options);
          if (shuffled[optionIndex]) {
            handleOptionSelect(shuffled[optionIndex].oid);
          }
        } else if ((event.key === "Enter" || event.key === " ") && !submitted) {
          event.preventDefault();
          handleSubmit(false);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentQuizIndex, thisQuizIndex, submitted, quiz.options, quiz.options_map, isMultiSub, isA3Type, isXType, subQuestions, currentSubIndex, getShuffledOptions, handleOptionSelect, handleSubmit, setCurrentSubIndex]);

  const renderBadges = () => (
    <div className="flex items-center gap-2 flex-wrap pb-2 mb-3">
      <Badge variant="secondary">{quiz.type}型题</Badge>
      <Badge variant="outline">{quiz.class}</Badge>
      {quiz.source && <Badge variant="outline">{quiz.source}</Badge>}
      {quiz.extracted_year && (
        <Badge variant="outline">{quiz.extracted_year}</Badge>
      )}
    </div>
  );

  const renderSubmitButtons = () => {
    if (submitted) return null;
    return (
      <div className="flex w-full gap-2 mt-6 max-w-2xl">
        <Button
          onClick={() => handleSubmit(true)}
          className="flex-grow bg-red-500 hover:bg-red-600 text-white"
          disabled={!canSubmit}
        >
          困难
        </Button>
        <Button
          onClick={() => handleSubmit(false)}
          className="flex-grow bg-green-500 hover:bg-green-600 text-white"
          disabled={!canSubmit}
        >
          简单
        </Button>
      </div>
    );
  };

  if (isBType) {
    return (
      <div className="w-full p-2 md:p-4 h-full overflow-y-auto">
        {renderBadges()}

        <div className="space-y-5 max-w-2xl">
          {subQuestions.map((sq, idx) => {
            const isActive = idx === currentSubIndex && !submitted;
            const userAns = subAnswers[sq.question_id];
            const isSubCorrect = userAns === sq.answer;

            return (
              <div key={sq.question_id} className="space-y-3">
                <div
                  className="cursor-pointer group"
                  onClick={() => !submitted && setCurrentSubIndex(idx)}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold transition-colors ${
                        isActive
                          ? "bg-primary text-primary-foreground"
                          : submitted
                            ? isSubCorrect
                              ? "bg-green-500 text-white"
                              : "bg-red-500 text-white"
                            : userAns
                              ? "bg-primary/15 text-primary"
                              : "bg-muted text-muted-foreground group-hover:bg-muted/80"
                      }`}
                    >
                      {idx + 1}
                    </span>
                    <p className={`leading-relaxed pt-0.5 ${
                      isActive ? "text-base font-medium text-foreground" : "text-sm text-foreground/80"
                    }`}>
                      {sq.question_text}
                    </p>
                    {submitted && (
                      <span className="shrink-0 mt-0.5">
                        {isSubCorrect ? (
                          <Check size={16} className="text-green-600 dark:text-green-400" />
                        ) : (
                          <X size={16} className="text-red-600 dark:text-red-400" />
                        )}
                      </span>
                    )}
                  </div>
                  {isActive && (
                    <div className="mt-1.5 ml-9 h-0.5 w-12 rounded-full bg-primary" />
                  )}
                </div>

                {isActive && (
                  <div className="space-y-1 ml-9">
                    {getShuffledOptions(quiz.options).map((opt, optIdx) => {
                      const isSelected = userAns === opt.oid;
                      return (
                        <OptionItem
                          key={opt.oid}
                          selected={isSelected}
                          correct={sq.answer === opt.oid}
                          submitted={submitted}
                          onClick={() => handleOptionSelect(opt.oid, sq.question_id)}
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-mono text-muted-foreground w-5 text-center shrink-0">
                              {optIdx + 1}
                            </span>
                            <span className="text-sm">{opt.text.replace(/^[A-E]\.\s*/, "")}</span>
                          </div>
                        </OptionItem>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {renderSubmitButtons()}

        {submitted && (
          <div className="mt-6 max-w-2xl">
            <AnswerSection
              quiz={quiz}
              submitted={submitted}
              isCorrect={isCorrect}
              subAnswers={subAnswers}
            />
            <DiscussionCard quizId={quiz.id} />
          </div>
        )}

        <div className="mt-4">
          <p className="text-xs text-muted-foreground">{quiz.unit}</p>
        </div>
      </div>
    );
  }

  if (isA3Type) {
    const optionsMap = quiz.options_map;
    const subKeys = optionsMap ? Object.keys(optionsMap).sort() : [];

    return (
      <div className="w-full p-2 md:p-4 h-full overflow-y-auto">
        {renderBadges()}

        <p className="text-lg mb-6 leading-relaxed">{quiz.main_question}</p>

        <div className="space-y-5 max-w-2xl">
          {subQuestions.map((sq, idx) => {
            const isActive = idx === currentSubIndex && !submitted;
            const userAns = subAnswers[sq.question_id];
            const isSubCorrect = userAns === sq.answer;
            const key = subKeys[idx] ?? String(idx);
            const subOpts = optionsMap?.[key] ?? [];

            return (
              <div key={sq.question_id} className="space-y-3">
                <div
                  className="cursor-pointer group"
                  onClick={() => !submitted && setCurrentSubIndex(idx)}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold transition-colors ${
                        isActive
                          ? "bg-primary text-primary-foreground"
                          : submitted
                            ? isSubCorrect
                              ? "bg-green-500 text-white"
                              : "bg-red-500 text-white"
                            : userAns
                              ? "bg-primary/15 text-primary"
                              : "bg-muted text-muted-foreground group-hover:bg-muted/80"
                      }`}
                    >
                      {idx + 1}
                    </span>
                    <p className={`leading-relaxed pt-0.5 ${
                      isActive ? "text-base font-medium text-foreground" : "text-sm text-foreground/80"
                    }`}>
                      {sq.question_text}
                    </p>
                    {submitted && (
                      <span className="shrink-0 mt-0.5">
                        {isSubCorrect ? (
                          <Check size={16} className="text-green-600 dark:text-green-400" />
                        ) : (
                          <X size={16} className="text-red-600 dark:text-red-400" />
                        )}
                      </span>
                    )}
                  </div>
                  {isActive && (
                    <div className="mt-1.5 ml-9 h-0.5 w-12 rounded-full bg-primary" />
                  )}
                </div>

                {(isActive || submitted) && (
                  <div className="space-y-1 ml-9">
                    {subOpts.map((opt, optIdx) => {
                      const isSelected = userAns === opt.oid;
                      return (
                        <OptionItem
                          key={`${key}-${opt.oid}`}
                          selected={isSelected}
                          correct={sq.answer === opt.oid}
                          submitted={submitted}
                          onClick={() => handleOptionSelect(opt.oid, sq.question_id)}
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-mono text-muted-foreground w-5 text-center shrink-0">
                              {optIdx + 1}
                            </span>
                            <span className="text-sm">{opt.text.replace(/^[A-E]\.\s*/, "")}</span>
                          </div>
                        </OptionItem>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {renderSubmitButtons()}

        {submitted && (
          <div className="mt-6 max-w-2xl">
            <AnswerSection
              quiz={quiz}
              submitted={submitted}
              isCorrect={isCorrect}
              subAnswers={subAnswers}
            />
            <DiscussionCard quizId={quiz.id} />
          </div>
        )}

        <div className="mt-4">
          <p className="text-xs text-muted-foreground">{quiz.unit}</p>
        </div>
      </div>
    );
  }

  const questionText = quiz.question;

  return (
    <div className="w-full p-2 md:p-4 h-full overflow-y-auto">
      {renderBadges()}

      <p className="text-lg mb-6 leading-relaxed">{questionText}</p>

      <div className="space-y-1 max-w-2xl">
        {getShuffledOptions(quiz.options).map((opt, index) => {
          const isSelected = isXType
            ? selected.includes(opt.oid)
            : selected[0] === opt.oid;
          const isCorrectAnswer = isXType
            ? (quiz.answer || "").split("").filter((c) => "ABCDE".includes(c)).includes(opt.oid)
            : quiz.answer === opt.oid;

          return (
            <OptionItem
              key={opt.oid}
              selected={isSelected}
              correct={isCorrectAnswer}
              submitted={submitted}
              onClick={() => handleOptionSelect(opt.oid)}
            >
              <div className="flex items-center gap-3">
                <span className="text-sm font-mono text-muted-foreground w-5 text-center shrink-0">
                  {index + 1}
                </span>
                <span className="text-sm">{opt.text.replace(/^[A-E]\.\s*/, "")}</span>
              </div>
            </OptionItem>
          );
        })}
      </div>

      {renderSubmitButtons()}

      {submitted && (
        <div className="mt-6 max-w-2xl">
          <AnswerSection
            quiz={quiz}
            submitted={submitted}
            isCorrect={isCorrect}
            userAnswer={isXType ? selected : selected[0]}
          />
          <DiscussionCard quizId={quiz.id} />
        </div>
      )}

      <div className="mt-4">
        <p className="text-xs text-muted-foreground">{quiz.unit}</p>
      </div>
    </div>
  );
}
