import { useState, useEffect, useCallback } from "react";
import { quizApi } from "@/lib/api";
import type { QuizFilter, QuizFilterMeta, QuizPractice } from "@/lib/types";
import { FilterPanel } from "./FilterPanel";
import { QuizSelectCard } from "./components/QuizSelectCard";
import { SelectToolbar } from "./components/SelectToolbar";
import { PaperPreview } from "./components/PaperPreview";
import { QuizPaper } from "./QuizPaper";
import { Button } from "@/components/ui/button";
import { useQuizPaper } from "./contexts/QuizPaperContext";

type BrowserView = "select" | "preview" | "practice" | "papers";

export function QuizBrowser() {
  return <QuizBrowserContent />;
}

function QuizBrowserContent() {
  const { state, dispatch, maxSelect, selectedCount, isSelected } = useQuizPaper();
  const [browserView, setBrowserView] = useState<BrowserView>("select");
  const [meta, setMeta] = useState<QuizFilterMeta | null>(null);
  const [filter, setFilter] = useState<QuizFilter>({ page: 1, limit: 20 });
  const [loading, setLoading] = useState(true);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [quizList, setQuizList] = useState<QuizPractice[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await quizApi.getFilterMeta();
        if (!cancelled) setMeta(data);
      } catch (error) {
        console.error("Failed to fetch filter meta:", error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const fetchQuizzes = useCallback(async (f: QuizFilter) => {
    setLoading(true);
    try {
      const data = await quizApi.getQuizzes(f);
      setTotalPages(data.total_pages);
      setTotalCount(data.total);
      return data.data;
    } catch (error) {
      console.error("Failed to fetch quizzes:", error);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const data = await fetchQuizzes(filter);
      if (!cancelled && data) {
        const detailed = await Promise.all(
          data.map((q) => quizApi.getQuizById(q.id)),
        );
        if (!cancelled) setQuizList(detailed);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [filter, fetchQuizzes]);

  const handleFilterChange = (newFilter: QuizFilter) => {
    setFilter((prev) => ({ ...prev, ...newFilter, page: 1 }));
  };

  const handlePageChange = (page: number) => {
    setFilter((prev) => ({ ...prev, page }));
  };

  const handleToggleQuiz = (quiz: QuizPractice) => {
    dispatch({ type: "TOGGLE_QUIZ", payload: quiz });
  };

  const handleGeneratePaper = () => {
    dispatch({ type: "TO_PREVIEW" });
    setBrowserView("preview");
  };

  const handleClearAll = () => {
    dispatch({ type: "CLEAR_ALL" });
  };

  const handleStartPractice = () => {
    dispatch({ type: "TO_PRACTICE" });
    setBrowserView("practice");
  };

  const handleBackToSelect = () => {
    dispatch({ type: "BACK_TO_SELECT" });
    setBrowserView("select");
  };

  const handleLoadPaper = async (paperId: string) => {
    try {
      const paper = await quizApi.getPaperById(paperId);
      const detailed = await Promise.all(
        paper.quiz_ids.map((id) => quizApi.getQuizById(id)),
      );
      const quizzesWithDetails = detailed.map((q, i) => ({
        ...q,
        selectedAt: Date.now() + i,
      }));
      dispatch({
        type: "LOAD_PAPER",
        payload: { paper, quizzes: quizzesWithDetails },
      });
      setBrowserView("practice");
    } catch (error) {
      console.error("Failed to load paper:", error);
    }
  };

  const handleDeletePaper = async (paperId: string) => {
    try {
      await quizApi.deletePaper(paperId);
      dispatch({ type: "REMOVE_PAPER", payload: paperId });
      const papers = await quizApi.getPapers();
      dispatch({ type: "SET_SAVED_PAPERS", payload: papers });
    } catch (error) {
      console.error("Failed to delete paper:", error);
    }
  };

  if (!meta) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground"></div>
      </div>
    );
  }

  if (browserView === "practice") {
    return (
      <div className="h-screen flex flex-col bg-background">
        <QuizPaper quizzes={state.selectedQuizzes} onBack={handleBackToSelect} />
      </div>
    );
  }

  if (browserView === "preview") {
    return <PaperPreview onConfirm={handleStartPractice} onBack={handleBackToSelect} />;
  }

  if (browserView === "papers") {
    return (
      <PapersView
        papers={state.savedPapers}
        onLoad={handleLoadPaper}
        onDelete={handleDeletePaper}
        onBack={() => setBrowserView("select")}
      />
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="bg-card border-b shrink-0">
        <div className="px-4 py-3 flex items-center justify-between">
          <h1 className="text-xl font-bold">医学题库</h1>
        </div>
      </header>

      {/* Select Toolbar */}
      <SelectToolbar
        selectedCount={selectedCount}
        maxSelect={maxSelect}
        onGeneratePaper={handleGeneratePaper}
        onClearAll={handleClearAll}
      />

      {/* Main content - Left sidebar + Right list */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full flex">
          {/* Left sidebar - Filter */}
          <div className="w-72 shrink-0 overflow-hidden">
            <FilterPanel
              meta={meta}
              filter={filter}
              onFilterChange={handleFilterChange}
              totalCount={totalCount}
            />
          </div>

          {/* Divider */}
          <div className="w-px bg-border" />

          {/* Right side - Quiz list */}
          <div className="flex-1 overflow-y-auto">
            <div className="border rounded-lg m-4 bg-card overflow-hidden">
              {/* List header */}
              <div className="flex items-center gap-3 px-4 py-2.5 bg-muted/30 border-b text-xs text-muted-foreground font-medium">
                <span className="w-6 text-center">#</span>
                <span className="w-4" />
                <span className="w-24">标签</span>
                <span className="flex-1">题目</span>
                <span className="max-w-40">章节 / 年份</span>
              </div>

              {loading ? (
                <div className="divide-y">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="flex items-center gap-3 px-4 py-3 animate-pulse">
                      <span className="w-6 h-3 bg-muted rounded" />
                      <span className="w-4 h-4 bg-muted rounded" />
                      <div className="flex gap-1.5">
                        <span className="h-4 bg-muted rounded w-8" />
                        <span className="h-4 bg-muted rounded w-12" />
                      </div>
                      <span className="flex-1 h-4 bg-muted rounded" />
                      <span className="w-20 h-4 bg-muted rounded" />
                    </div>
                  ))}
                </div>
              ) : quizList.length === 0 ? (
                <div className="py-16 text-center text-sm text-muted-foreground">
                  暂无匹配的题目
                </div>
              ) : (
                <>
                  <div className="divide-y">
                    {quizList.map((quiz, i) => (
                      <QuizSelectCard
                        key={quiz.id}
                        quiz={quiz}
                        index={(filter.page ?? 1 - 1) * (filter.limit ?? 20) + i + 1}
                        isSelected={isSelected(quiz.id)}
                        onToggle={() => handleToggleQuiz(quiz)}
                        disabled={
                          !isSelected(quiz.id) && selectedCount >= maxSelect
                        }
                      />
                    ))}
                  </div>

                  {totalPages > 1 && (
                    <div className="flex justify-center items-center gap-2 py-3 border-t bg-muted/20">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={(filter.page ?? 1) <= 1}
                        onClick={() => handlePageChange((filter.page ?? 1) - 1)}
                      >
                        上一页
                      </Button>
                      <span className="text-sm text-muted-foreground">
                        {(filter.page ?? 1)} / {totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={(filter.page ?? 1) >= totalPages}
                        onClick={() => handlePageChange((filter.page ?? 1) + 1)}
                      >
                        下一页
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PapersView({
  papers,
  onLoad,
  onDelete,
  onBack,
}: {
  papers: import("@/lib/types").QuizPaper[];
  onLoad: (id: string) => void;
  onDelete: (id: string) => void;
  onBack: () => void;
}) {
  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">我的试卷</h1>
            <Button variant="outline" size="sm" onClick={onBack}>
              返回选题
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        {papers.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            暂无保存的试卷
          </div>
        ) : (
          <div className="space-y-3">
            {papers.map((paper) => (
              <div
                key={paper.id}
                className="border rounded-lg p-4 bg-card hover:shadow-sm transition-shadow"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">{paper.title}</h3>
                    <p className="text-sm text-muted-foreground">
                      {paper.quiz_ids.length} 道题 ·{" "}
                      {new Date(paper.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => onLoad(paper.id)}>
                      <BookOpen size={16} />
                      <span className="ml-2">练习</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onDelete(paper.id)}
                    >
                      删除
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
