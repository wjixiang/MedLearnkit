import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import type { QuizPractice, SelectedQuiz } from "@/lib/types";
import { Quiz } from "./Quiz";
import { QuizPreview } from "./components/QuizPreview";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Grid, CheckCircle, XCircle, ArrowLeft } from "lucide-react";

interface QuizPaperProps {
  quizzes: SelectedQuiz[];
  onBack: () => void;
}

interface QuizState {
  submitted: boolean;
  isCorrect: boolean;
}

export function QuizPaper({ quizzes: quizSet, onBack }: QuizPaperProps) {
  const [view, setView] = useState<"grid" | "practice">("grid");
  const [currentIndex, setCurrentIndex] = useState(0);
  const quizStateMapRef = useRef<Map<string, QuizState>>(new Map());
  const [updateTrigger, setUpdateTrigger] = useState(0);

  const registerQuizState = useCallback(
    (quizId: string, state: QuizState) => {
      quizStateMapRef.current.set(quizId, state);
      setUpdateTrigger((prev) => prev + 1);
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

  if (view === "grid") {
    return (
      <div className="flex flex-col h-full">
        <div className="p-3 px-4 flex flex-wrap justify-between items-center gap-3 border-b">
          <div className="flex items-center gap-4 text-sm">
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

        <div className="flex-1 overflow-y-auto p-5">
          <div className="grid grid-cols-[repeat(auto-fill,minmax(48px,1fr))] gap-3">
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
        <div className="flex items-center gap-3">
          <button onClick={handleBackToGrid} className="hover:bg-muted p-1.5 rounded-md transition-colors">
            <Grid size={20} />
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
        />
      </div>
    </div>
  );
}
