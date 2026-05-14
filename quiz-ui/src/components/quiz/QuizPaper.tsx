import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import type { QuizPractice, SelectedQuiz, PaperAnswer } from "@/lib/types";
import { Quiz } from "./Quiz";
import { QuizPreview } from "./components/QuizPreview";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Grid, CheckCircle, XCircle, ArrowLeft } from "lucide-react";
import { quizApi } from "@/lib/api";
import { useQuizPaper } from "./contexts/QuizPaperContext";

interface QuizPaperProps {
  quizzes: SelectedQuiz[];
  onBack: () => void;
}

interface QuizState {
  submitted: boolean;
  isCorrect: boolean;
}

export function QuizPaper({ quizzes: quizSet, onBack }: QuizPaperProps) {
  const { state: paperState } = useQuizPaper();
  const paperId = paperState.currentPaper?.id;
  const [view, setView] = useState<"grid" | "practice">("grid");
  const [currentIndex, setCurrentIndex] = useState(0);
  const quizStateMapRef = useRef<Map<string, QuizState>>(new Map());
  const [updateTrigger, setUpdateTrigger] = useState(0);
  const paperRecordIdRef = useRef<string | null>(null);
  const orderIndexRef = useRef<Map<string, number>>(
    new Map(quizSet.map((q, i) => [q.id, i]))
  );
  const [restoring, setRestoring] = useState(true);
  const restoredAnswersRef = useRef<Map<string, PaperAnswer>>(new Map());

  // On mount: try to resume an existing in_progress paper_record
  useEffect(() => {
    if (!paperId || quizSet.length === 0) return;
    let cancelled = false;

    async function restoreOrInit() {
      try {
        // Fetch existing records for this paper
        const records = await quizApi.getPaperRecords(paperId!);
        const inProgress = records.find((r) => r.status === "in_progress");

        if (inProgress) {
          // Resume existing session
          paperRecordIdRef.current = inProgress.id;

          // Load saved answers
          const answers = await quizApi.getPaperAnswers(inProgress.id);

          // Restore quiz states from saved answers
          const restoredMap = new Map<string, QuizState>();
          const answerMap = new Map<string, PaperAnswer>();
          for (const ans of answers) {
            restoredMap.set(ans.quiz_id, {
              submitted: true,
              isCorrect: ans.is_correct,
            });
            answerMap.set(ans.quiz_id, ans);
          }
          if (!cancelled) {
            quizStateMapRef.current = restoredMap;
            restoredAnswersRef.current = answerMap;
            setUpdateTrigger((prev) => prev + 1);
          }
        } else {
          // No in-progress record — create a new one
          const record = await quizApi.createPaperRecord(paperId!, quizSet.length);
          if (!cancelled) {
            paperRecordIdRef.current = record.id;
          }
        }
      } catch (err) {
        console.error("Failed to restore paper progress:", err);
        // Fallback: create a new record
        try {
          const record = await quizApi.createPaperRecord(paperId!, quizSet.length);
          if (!cancelled) {
            paperRecordIdRef.current = record.id;
          }
        } catch (e) {
          console.error("Failed to create paper record:", e);
        }
      } finally {
        if (!cancelled) setRestoring(false);
      }
    }

    restoreOrInit();
    return () => { cancelled = true; };
  }, [paperId, quizSet.length]);

  const registerQuizState = useCallback(
    (quizId: string, state: QuizState) => {
      quizStateMapRef.current.set(quizId, state);
      setUpdateTrigger((prev) => prev + 1);

      // Check if all questions are now answered — if so, complete the paper record
      const newMap = new Map(quizStateMapRef.current);
      newMap.set(quizId, state);
      const allAnswered = quizSet.every((q) => newMap.get(q.id)?.submitted);
      if (allAnswered && paperRecordIdRef.current) {
        let correct = 0;
        newMap.forEach((s) => { if (s.isCorrect) correct++; });
        const score = quizSet.length > 0 ? (correct / quizSet.length) * 100 : 0;
        quizApi.updatePaperRecord(paperRecordIdRef.current, correct, score, "completed").catch(
          (err) => console.error("Failed to complete paper record:", err)
        );
      }
    },
    [quizSet],
  );

  const handlePaperAnswer = useCallback(
    (result: {
      quizId: string;
      quizType: string;
      quizClass: string;
      userAnswer: string | null;
      isCorrect: boolean;
      timeSpentSeconds: number;
    }) => {
      const recordId = paperRecordIdRef.current;
      if (!recordId) return;
      const orderIndex = orderIndexRef.current.get(result.quizId) ?? 0;
      quizApi.createPaperAnswer({
        paper_record_id: recordId,
        quiz_id: result.quizId,
        user_answer: result.userAnswer,
        is_correct: result.isCorrect,
        time_spent_seconds: result.timeSpentSeconds,
        order_index: orderIndex,
      }).catch((err) => console.error("Failed to save paper answer:", err));
    },
    [],
  );

  const getQuizState = useCallback(
    (quiz: QuizPractice): QuizState => {
      return quizStateMapRef.current.get(quiz.id) ?? {
        submitted: false,
        isCorrect: false,
      };
    },
    [],
  );

  const stats = useMemo(() => {
    let submittedCount = 0;
    let correctCount = 0;
    quizSet.forEach((quiz) => {
      const state = getQuizState(quiz);
      if (state.submitted) {
        submittedCount++;
        if (state.isCorrect) correctCount++;
      }
    });
    return {
      total: quizSet.length,
      submittedCount,
      correctCount,
      completionRate:
        quizSet.length > 0
          ? ((submittedCount / quizSet.length) * 100).toFixed(1)
          : "0",
      accuracyRate:
        submittedCount > 0
          ? ((correctCount / submittedCount) * 100).toFixed(1)
          : "0",
    };
  }, [quizSet, getQuizState, updateTrigger]);

  const [filterMode, setFilterMode] = useState<"all" | "correct" | "incorrect">(
    "all",
  );

  const filteredQuizzes = useMemo(() => {
    return quizSet.filter((quiz) => {
      const state = getQuizState(quiz);
      if (filterMode === "all") return true;
      if (!state.submitted) return false;
      return filterMode === "correct" ? state.isCorrect : !state.isCorrect;
    });
  }, [quizSet, getQuizState, filterMode, updateTrigger]);

  const handleSelectQuiz = (originalIndex: number) => {
    setCurrentIndex(originalIndex);
    setView("practice");
  };

  const handleBackToGrid = useCallback(() => {
    setView("grid");
  }, []);

  const back = useCallback(() => {
    setCurrentIndex((prev) => Math.max(0, prev - 1));
  }, []);

  const forward = useCallback(() => {
    setCurrentIndex((prev) => Math.min(quizSet.length - 1, prev + 1));
  }, [quizSet.length]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (view !== "practice") return;
      if (
        e.target instanceof HTMLElement &&
        (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")
      ) {
        return;
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        back();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        forward();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [view, back, forward]);

  if (quizSet.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        暂无试题
      </div>
    );
  }

  if (restoring) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        正在恢复练习进度...
      </div>
    );
  }

  if (view === "grid") {
    return (
      <div className="flex flex-col h-full">
        <div className="p-3 px-4 flex flex-col sm:flex-row sm:flex-wrap justify-between items-start sm:items-center gap-2 sm:gap-3 border-b">
          <div className="flex items-center gap-3 sm:gap-4 text-sm">
            <button
              onClick={onBack}
              className="hover:bg-muted p-1.5 rounded-md transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <span className="font-semibold">完成进度: </span>
              <span className="font-medium">{stats.completionRate}%</span>
              <span className="text-muted-foreground ml-1">
                ({stats.submittedCount}/{stats.total})
              </span>
            </div>
            <div>
              <span className="font-semibold">正确率: </span>
              <span className="font-medium">{stats.accuracyRate}%</span>
              <span className="text-muted-foreground ml-1">
                ({stats.correctCount}/{stats.submittedCount})
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">筛选:</span>
            <div className="flex items-center rounded-lg border bg-muted/50 p-0.5">
              {(
                [
                  { key: "all", label: "全部" },
                  { key: "correct", label: "正确" },
                  { key: "incorrect", label: "错误" },
                ] as const
              ).map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setFilterMode(key)}
                  className={`px-3 py-1 text-xs rounded-md transition-colors ${
                    filterMode === key
                      ? "bg-background shadow-sm font-medium"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 sm:p-5">
          <div className="grid grid-cols-[repeat(auto-fill,minmax(42px,1fr))] sm:grid-cols-[repeat(auto-fill,minmax(48px,1fr))] gap-2 sm:gap-3">
            {filteredQuizzes.map((quiz) => {
              const originalIndex = quizSet.indexOf(quiz);
              const state = getQuizState(quiz);
              const status: "todo" | "correct" | "wrong" = state.submitted
                ? state.isCorrect
                  ? "correct"
                  : "wrong"
                : "todo";

              return (
                <QuizPreview
                  key={quiz.id}
                  index={originalIndex}
                  status={status}
                  isActive={false}
                  onClick={() => handleSelectQuiz(originalIndex)}
                />
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-2 sm:p-3 bg-background border-b">
        <div className="flex items-center gap-2 sm:gap-3">
          <button onClick={handleBackToGrid} className="hover:bg-muted p-1.5 rounded-md transition-colors">
            <Grid size={18} />
          </button>
          <span className="text-sm sm:text-base font-medium">
            {currentIndex + 1} / {quizSet.length}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-1.5 mr-3">
            <CheckCircle size={14} className="text-green-500" />
            <span className="text-xs text-muted-foreground">
              {stats.correctCount}
            </span>
            <XCircle size={14} className="text-destructive ml-2" />
            <span className="text-xs text-muted-foreground">
              {stats.submittedCount - stats.correctCount}
            </span>
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={back}
            disabled={currentIndex <= 0}
            className="h-8 w-8"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={forward}
            disabled={currentIndex >= quizSet.length - 1}
            className="h-8 w-8"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <Quiz
          key={quizSet[currentIndex].id}
          quiz={quizSet[currentIndex]}
          currentQuizIndex={currentIndex}
          thisQuizIndex={currentIndex}
          onStateChange={registerQuizState}
          onPaperAnswer={handlePaperAnswer}
          initialState={
            restoredAnswersRef.current.has(quizSet[currentIndex].id)
              ? (() => {
                  const ans = restoredAnswersRef.current.get(quizSet[currentIndex].id)!;
                  return { submitted: true, isCorrect: ans.is_correct, userAnswer: ans.user_answer };
                })()
              : undefined
          }
        />
      </div>
    </div>
  );
}
