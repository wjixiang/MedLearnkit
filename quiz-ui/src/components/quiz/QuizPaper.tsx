import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import type { QuizPractice, SelectedQuiz, PaperAnswer } from "@/lib/types";
import { Quiz } from "./Quiz";
import { QuizPreview } from "./components/QuizPreview";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Grid, CheckCircle, XCircle, ArrowLeft } from "lucide-react";
import { quizApi } from "@/lib/api";
import { useQuizPaper } from "./contexts/QuizPaperContext";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@/components/ui/carousel";

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
  const [quizStateMap, setQuizStateMap] = useState<Map<string, QuizState>>(new Map());
  const paperRecordIdRef = useRef<string | null>(null);
  const orderIndexRef = useRef<Map<string, number>>(
    new Map(quizSet.map((q, i) => [q.id, i]))
  );
  const [restoring, setRestoring] = useState(true);
  const [restoredAnswers, setRestoredAnswers] = useState<Map<string, PaperAnswer>>(new Map());

  // Carousel API
  const [api, setApi] = useState<CarouselApi>();
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);

  // Fixed start index for carousel opts — must NOT change during carousel lifetime,
  // otherwise embla-carousel-react calls reInit() which kills the snap animation.
  const [carouselStart, setCarouselStart] = useState(0);

  // settledIndex: the index after snap animation completes.
  // -1 means no carousel has settled yet (use currentIndex as fallback).
  const [settledIndex, setSettledIndex] = useState(-1);

  // Mount Quiz only for slides around the settled position.
  // Uses settledIndex exclusively so no DOM changes happen during animation.
  const visibleIndices = useMemo(() => {
    const base = settledIndex >= 0 ? settledIndex : currentIndex;
    const indices = new Set<number>();
    if (base > 0) indices.add(base - 1);
    indices.add(base);
    if (base < quizSet.length - 1) indices.add(base + 1);
    return indices;
  }, [settledIndex, currentIndex, quizSet.length]);

  // Sync carousel state: select updates UI instantly, settle updates Quiz mounting
  useEffect(() => {
    if (!api) return;

    const onSelect = () => {
      setCanScrollPrev(api.canScrollPrev());
      setCanScrollNext(api.canScrollNext());
      setCurrentIndex(api.selectedScrollSnap());
    };
    const onSettle = () => {
      setSettledIndex(api.selectedScrollSnap());
    };

    // Initialize on mount — defer to avoid synchronous setState in effect
    requestAnimationFrame(() => {
      const idx = api.selectedScrollSnap();
      setCurrentIndex(idx);
      setSettledIndex(idx);
      setCanScrollPrev(api.canScrollPrev());
      setCanScrollNext(api.canScrollNext());
    });

    api.on("select", onSelect);
    api.on("settle", onSettle);
    return () => {
      api.off("select", onSelect);
      api.off("settle", onSettle);
    };
  }, [api]);

  // On mount: try to resume an existing in_progress paper_record
  useEffect(() => {
    if (!paperId || quizSet.length === 0) return;
    let cancelled = false;

    async function restoreOrInit() {
      try {
        const records = await quizApi.getPaperRecords(paperId!);
        const inProgress = records.find((r) => r.status === "in_progress");

        if (inProgress) {
          paperRecordIdRef.current = inProgress.id;
          const answers = await quizApi.getPaperAnswers(inProgress.id);
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
            setQuizStateMap(restoredMap);
            setRestoredAnswers(answerMap);
          }
        } else {
          const record = await quizApi.createPaperRecord(paperId!, quizSet.length);
          if (!cancelled) {
            paperRecordIdRef.current = record.id;
          }
        }
      } catch (err) {
        console.error("Failed to restore paper progress:", err);
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
      setQuizStateMap((prev) => {
        const next = new Map(prev);
        next.set(quizId, state);
        const allAnswered = quizSet.every((q) => next.get(q.id)?.submitted);
        if (allAnswered && paperRecordIdRef.current) {
          let correct = 0;
          next.forEach((s) => { if (s.isCorrect) correct++; });
          const score = quizSet.length > 0 ? (correct / quizSet.length) * 100 : 0;
          quizApi.updatePaperRecord(paperRecordIdRef.current, correct, score, "completed").catch(
            (err) => console.error("Failed to complete paper record:", err)
          );
        }
        return next;
      });
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
      return quizStateMap.get(quiz.id) ?? {
        submitted: false,
        isCorrect: false,
      };
    },
    [quizStateMap],
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
  }, [quizSet, getQuizState]);

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
  }, [quizSet, getQuizState, filterMode]);

  const handleSelectQuiz = (originalIndex: number) => {
    setCurrentIndex(originalIndex);
    setCarouselStart(originalIndex);
    setView("practice");
  };

  const handleBackToGrid = useCallback(() => {
    setView("grid");
  }, []);

  // Global keyboard navigation (supplements Carousel's built-in focus-based handling)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (view !== "practice") return;
      if (e.defaultPrevented) return;
      if (
        e.target instanceof HTMLElement &&
        (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")
      ) {
        return;
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        api?.scrollPrev();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        api?.scrollNext();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [view, api]);

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
            onClick={() => api?.scrollPrev()}
            disabled={!canScrollPrev}
            className="h-8 w-8"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => api?.scrollNext()}
            disabled={!canScrollNext}
            className="h-8 w-8"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Carousel
        opts={{ startIndex: carouselStart }}
        setApi={setApi}
        className="flex-1 min-h-0"
      >
        <CarouselContent className="-ml-0 h-full">
          {quizSet.map((quiz, index) => (
            <CarouselItem key={quiz.id} className="pl-0">
              {visibleIndices.has(index) ? (
                <div className="h-full overflow-y-auto">
                  <Quiz
                    quiz={quiz}
                    currentQuizIndex={currentIndex}
                    thisQuizIndex={index}
                    onStateChange={registerQuizState}
                    onPaperAnswer={handlePaperAnswer}
                    initialState={
                      restoredAnswers.has(quiz.id)
                        ? (() => {
                            const ans = restoredAnswers.get(quiz.id)!;
                            return { submitted: true, isCorrect: ans.is_correct, userAnswer: ans.user_answer };
                          })()
                        : undefined
                    }
                  />
                </div>
              ) : null}
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>
    </div>
  );
}
