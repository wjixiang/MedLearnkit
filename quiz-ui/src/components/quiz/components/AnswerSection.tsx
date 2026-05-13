import type { QuizPractice, Oid } from "@/lib/types";
import { Check, X } from "lucide-react";
import { QuizAnalysis } from "./QuizAnalysis";

interface AnswerSectionProps {
  quiz: QuizPractice;
  submitted: boolean;
  isCorrect: boolean;
  subAnswers?: Record<number, Oid>;
  userAnswer?: Oid | Oid[];
}

function getOptionText(
  optionId: string | null,
  options: { oid: string; text: string }[],
) {
  if (!optionId) return "未作答";
  const option = options.find((opt) => opt.oid === optionId);
  return option ? option.text.replace(/^[A-E]\.\s*/, "") : optionId;
}

export function AnswerSection({
  quiz,
  submitted,
  isCorrect,
  subAnswers,
  userAnswer,
}: AnswerSectionProps) {
  if (!submitted) return null;

  const isA3 = quiz.type === "A3";
  const isB = quiz.type === "B";
  const isMultiSub = (isB || isA3) && quiz.sub_questions && quiz.sub_questions.length > 0;

  if (isMultiSub) {
    const optionsMap = quiz.options_map;
    const subKeys = optionsMap ? Object.keys(optionsMap).sort() : [];

    return (
      <div className="space-y-4">
        <div className="bg-card text-card-foreground p-4 rounded-lg border space-y-4">
          <h3 className="text-lg font-semibold">答案</h3>
          <div className="space-y-3 ml-2">
            {quiz.sub_questions!.map((sq, idx) => {
              const userAns = subAnswers?.[sq.question_id];
              const correct = userAns === sq.answer;

              let opts: { oid: string; text: string }[];
              if (isA3 && optionsMap) {
                const key = subKeys[idx] ?? String(idx);
                opts = optionsMap[key] ?? [];
              } else {
                opts = quiz.options;
              }

              return (
                <div key={sq.question_id} className="space-y-1.5">
                  <p className="text-sm text-muted-foreground">{sq.question_text}</p>
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex items-center p-1.5 rounded bg-green-50 dark:bg-green-950/50 text-sm">
                      <span className="font-medium mr-1.5">正确：</span>
                      <span>{getOptionText(sq.answer, opts)}</span>
                    </div>
                    <div className={`flex items-center p-1.5 rounded text-sm ${correct ? "bg-green-100 dark:bg-green-900/50" : "bg-red-100 dark:bg-red-900/50"}`}>
                      <span className="font-medium mr-1.5">你的：</span>
                      <span>{getOptionText(userAns ?? null, opts)}</span>
                      {correct ? (
                        <Check size={14} className="ml-1 text-green-600 dark:text-green-400" />
                      ) : (
                        <X size={14} className="ml-1 text-red-600 dark:text-red-400" />
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <QuizAnalysis analysis={quiz.analysis} />
        </div>
      </div>
    );
  }

  const effectiveUserAnswer = userAnswer ?? quiz.userAnswer;

  // X型题特殊处理：答案是多选
  if (quiz.type === "X") {
    const userAnswers = Array.isArray(effectiveUserAnswer)
      ? effectiveUserAnswer
      : effectiveUserAnswer
        ? [effectiveUserAnswer]
        : [];
    const correctAnswers = (quiz.answer || "").split("").filter((c): c is Oid => "ABCDE".includes(c));

    const userAnswerText = userAnswers.length > 0
      ? userAnswers.map((oid) => getOptionText(oid, quiz.options)).join("、")
      : "未作答";
    const correctAnswerText = correctAnswers.length > 0
      ? correctAnswers.map((oid) => getOptionText(oid, quiz.options)).join("、")
      : "未作答";

    return (
      <div className="space-y-4">
        <div className="bg-card text-card-foreground p-4 rounded-lg border space-y-4">
          <h3 className="text-lg font-semibold">答案</h3>

          <div className="space-y-2 ml-2">
            <div className="flex items-center p-2 rounded bg-green-50 dark:bg-green-950/50">
              <span className="font-medium mr-2">正确答案：</span>
              <span>{correctAnswerText}</span>
            </div>
            <div
              className={`flex items-center p-2 rounded ${
                isCorrect
                  ? "bg-green-100 dark:bg-green-900/50"
                  : "bg-red-100 dark:bg-red-900/50"
              }`}
            >
              <span className="font-medium mr-2">你的答案：</span>
              <span>{userAnswerText}</span>
              {isCorrect ? (
                <Check
                  size={16}
                  className="ml-auto text-green-600 dark:text-green-400"
                />
              ) : (
                <X
                  size={16}
                  className="ml-auto text-red-600 dark:text-red-400"
                />
              )}
            </div>
          </div>

          <QuizAnalysis analysis={quiz.analysis} />
        </div>
      </div>
    );
  }

  // 普通题型
  const singleAnswer = Array.isArray(effectiveUserAnswer)
    ? effectiveUserAnswer[0] ?? null
    : effectiveUserAnswer ?? null;
  const userAnswerText = getOptionText(singleAnswer, quiz.options);
  const correctAnswerText = getOptionText(quiz.answer, quiz.options);

  return (
    <div className="space-y-4">
      <div className="bg-card text-card-foreground p-4 rounded-lg border space-y-4">
        <h3 className="text-lg font-semibold">答案</h3>

        <div className="space-y-2 ml-2">
          <div className="flex items-center p-2 rounded bg-green-50 dark:bg-green-950/50">
            <span className="font-medium mr-2">正确答案：</span>
            <span>{correctAnswerText}</span>
          </div>
          <div
            className={`flex items-center p-2 rounded ${
              isCorrect
                ? "bg-green-100 dark:bg-green-900/50"
                : "bg-red-100 dark:bg-red-900/50"
            }`}
          >
            <span className="font-medium mr-2">你的答案：</span>
            <span>{userAnswerText}</span>
            {isCorrect ? (
              <Check
                size={16}
                className="ml-auto text-green-600 dark:text-green-400"
              />
            ) : (
              <X
                size={16}
                className="ml-auto text-red-600 dark:text-red-400"
              />
            )}
          </div>
        </div>

        <QuizAnalysis analysis={quiz.analysis} />
      </div>
    </div>
  );
}
