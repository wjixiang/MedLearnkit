import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { QuizPractice } from "@/lib/types";
import { Check, X } from "lucide-react";
import { useQuizLogic } from "./hooks/useQuizLogic";
import { OptionItem } from "./components/OptionItem";
import { AnswerSection } from "./components/AnswerSection";

interface QuizProps {
  quiz: QuizPractice;
  currentQuizIndex: number;
  thisQuizIndex: number;
  onStateChange?: (quizId: string, state: { submitted: boolean; isCorrect: boolean }) => void;
}

export function Quiz({
  quiz,
  currentQuizIndex,
  thisQuizIndex,
  onStateChange,
}: QuizProps) {
  const {
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
  } = useQuizLogic({ quiz, currentQuizIndex, thisQuizIndex });

  useEffect(() => {
    if (submitted && onStateChange) {
      onStateChange(quiz.id, { submitted, isCorrect });
    }
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

      if (isBType) {
        if (event.key === "ArrowDown" && currentSubIndex < subQuestions.length - 1) {
          event.preventDefault();
          setCurrentSubIndex(currentSubIndex + 1);
        } else if (event.key === "ArrowUp" && currentSubIndex > 0) {
          event.preventDefault();
          setCurrentSubIndex(currentSubIndex - 1);
        } else if (event.key >= "1" && event.key <= "5") {
          const optionIndex = parseInt(event.key) - 1;
          const shuffled = getShuffledOptions(quiz.options);
          if (shuffled[optionIndex]) {
            handleOptionSelect(shuffled[optionIndex].oid);
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
  }, [currentQuizIndex, thisQuizIndex, submitted, quiz.options, isBType, subQuestions, currentSubIndex, getShuffledOptions, handleOptionSelect, handleSubmit, setCurrentSubIndex]);

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

        <div className="space-y-6 max-w-2xl">
          {subQuestions.map((sq, idx) => {
            const isActive = idx === currentSubIndex && !submitted;
            const userAns = subAnswers[sq.question_id];
            const isSubCorrect = userAns === sq.answer;

            return (
              <div key={sq.question_id} className="space-y-2">
                <div
                  className={`flex items-start gap-2 p-3 rounded-lg border transition-colors cursor-pointer ${
                    isActive
                      ? "border-primary bg-primary/5"
                      : submitted
                        ? isSubCorrect
                          ? "border-green-300 bg-green-50 dark:bg-green-950/30"
                          : "border-red-300 bg-red-50 dark:bg-red-950/30"
                        : userAns
                          ? "border-border bg-muted/30"
                          : "border-transparent hover:bg-muted/30"
                  }`}
                  onClick={() => !submitted && setCurrentSubIndex(idx)}
                >
                  <span className="text-sm font-medium text-muted-foreground shrink-0 mt-0.5">
                    {idx + 1}.
                  </span>
                  <p className="text-sm leading-relaxed">{sq.question_text}</p>
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
                  <div className="space-y-1 ml-4">
                    {getShuffledOptions(quiz.options).map((opt, optIdx) => {
                      const isSelected = userAns === opt.oid;
                      return (
                        <OptionItem
                          key={opt.oid}
                          selected={isSelected}
                          correct={sq.answer === opt.oid}
                          submitted={submitted}
                          onClick={() => handleOptionSelect(opt.oid)}
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
          </div>
        )}

        <div className="mt-4">
          <p className="text-xs text-muted-foreground">{quiz.unit}</p>
        </div>
      </div>
    );
  }

  const isA3 = quiz.type === "A3";
  const questionText = isA3 ? quiz.main_question : quiz.question;
  const optionsMap = quiz.options_map;
  const subKeys = optionsMap ? Object.keys(optionsMap).sort() : [];

  if (isA3 && subKeys.length > 0) {
    return (
      <div className="w-full p-2 md:p-4 h-full overflow-y-auto">
        {renderBadges()}

        <p className="text-lg mb-6 leading-relaxed">{questionText}</p>

        <div className="space-y-6 max-w-2xl">
          {subKeys.map((key) => (
            <div key={key} className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">第 {parseInt(key) + 1} 题</p>
              <div className="space-y-1">
                {(optionsMap![key] ?? []).map((opt, optIdx) => {
                  const isSelected = selected === opt.oid;
                  const isCorrectAnswer = quiz.answer === opt.oid;
                  return (
                    <OptionItem
                      key={`${key}-${opt.oid}`}
                      selected={isSelected}
                      correct={isCorrectAnswer}
                      submitted={submitted}
                      onClick={() => handleOptionSelect(opt.oid)}
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
            </div>
          ))}
        </div>

        {renderSubmitButtons()}

        {submitted && (
          <div className="mt-6 max-w-2xl">
            <AnswerSection
              quiz={quiz}
              submitted={submitted}
              isCorrect={isCorrect}
            />
          </div>
        )}

        <div className="mt-4">
          <p className="text-xs text-muted-foreground">{quiz.unit}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full p-2 md:p-4 h-full overflow-y-auto">
      {renderBadges()}

      <p className="text-lg mb-6 leading-relaxed">{questionText}</p>

      <div className="space-y-1 max-w-2xl">
        {getShuffledOptions(quiz.options).map((opt, index) => {
          const isSelected = selected === opt.oid;
          const isCorrectAnswer = quiz.answer === opt.oid;

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
          />
        </div>
      )}

      <div className="mt-4">
        <p className="text-xs text-muted-foreground">{quiz.unit}</p>
      </div>
    </div>
  );
}
