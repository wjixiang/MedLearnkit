import { useState, useEffect, useCallback } from "react";
import { BookOpen, Filter } from "lucide-react";
import { quizApi } from "@/lib/api";
import type { QuizFilter, QuizFilterMeta, QuizPractice } from "@/lib/types";
import { FilterPanel } from "./FilterPanel";
import { QuizSelectCard } from "./components/QuizSelectCard";
import { SelectToolbar } from "./components/SelectToolbar";
import { PaperPreview } from "./components/PaperPreview";
import { QuizPaper } from "./QuizPaper";
import { TabLayout } from "./components/TabLayout";
import { PaperTab } from "./PaperTab";
import { Button } from "@/components/ui/button";
import { useQuizPaper } from "./contexts/QuizPaperContext";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserDropdown } from "@/components/UserDropdown";

type BrowserView = "select" | "preview" | "practice";
type MainTab = "filter" | "paper";

const TABS = [
  { id: "filter", label: "筛选做题", icon: <Filter size={16} /> },
  { id: "paper", label: "试卷抽题", icon: <BookOpen size={16} /> },
];

export function QuizBrowser() {
  return <QuizBrowserContent />;
}

function QuizBrowserContent() {
  const { state, dispatch, maxSelect, selectedCount, isSelected } = useQuizPaper();
  const [mainTab, setMainTab] = useState<MainTab>("filter");
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

  const selectedIds = new Set(state.selectedQuizzes.map((q) => q.id));

  const handleSelectAll = useCallback(() => {
    const unselected = quizList.filter((q) => !selectedIds.has(q.id));
    const toAdd = unselected.slice(0, maxSelect - selectedIds.size);
    toAdd.forEach((q) => {
      dispatch({ type: "TOGGLE_QUIZ", payload: q });
    });
  }, [quizList, selectedIds, maxSelect, dispatch]);

  const handleSelectFirstN = useCallback(
    (n: number) => {
      const unselected = quizList.filter((q) => !selectedIds.has(q.id));
      const toAdd = unselected.slice(0, Math.min(n, maxSelect - selectedIds.size));
      toAdd.forEach((q) => {
        dispatch({ type: "TOGGLE_QUIZ", payload: q });
      });
    },
    [quizList, selectedIds, maxSelect, dispatch],
  );

  const handleSelectRandomN = useCallback(
    (n: number) => {
      const unselected = quizList.filter((q) => !selectedIds.has(q.id));
      const shuffled = [...unselected].sort(() => Math.random() - 0.5);
      const toAdd = shuffled.slice(0, Math.min(n, maxSelect - selectedIds.size));
      toAdd.forEach((q) => {
        dispatch({ type: "TOGGLE_QUIZ", payload: q });
      });
    },
    [quizList, selectedIds, maxSelect, dispatch],
  );

  const handleGeneratePaper = () => {
    dispatch({ type: "TO_PREVIEW" });
    setBrowserView("preview");
  };

  const handleClearAll = () => {
    dispatch({ type: "CLEAR_ALL" });
  };

  const handleBackToSelect = () => {
    dispatch({ type: "BACK_TO_SELECT" });
    setBrowserView("select");
  };

  const handleTabChange = (tabId: string) => {
    setMainTab(tabId as MainTab);
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
    return <PaperPreview onPracticeStart={() => setBrowserView("practice")} onBack={handleBackToSelect} />;
  }

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="bg-card border-b shrink-0">
        <div className="px-4 py-3 flex items-center justify-between">
          <h1 className="text-xl font-bold">医学题库</h1>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <UserDropdown />
          </div>
        </div>
      </header>

      {/* Tab bar */}
      <TabLayout tabs={TABS} activeTab={mainTab} onTabChange={handleTabChange}>
        {mainTab === "filter" ? (
          <FilterTabContent
            meta={meta}
            filter={filter}
            loading={loading}
            totalPages={totalPages}
            totalCount={totalCount}
            quizList={quizList}
            selectedCount={selectedCount}
            maxSelect={maxSelect}
            selectedIds={selectedIds}
            isSelected={isSelected}
            onFilterChange={handleFilterChange}
            onPageChange={handlePageChange}
            onToggleQuiz={handleToggleQuiz}
            onSelectAll={handleSelectAll}
            onSelectFirstN={handleSelectFirstN}
            onSelectRandomN={handleSelectRandomN}
            onGeneratePaper={handleGeneratePaper}
            onClearAll={handleClearAll}
          />
        ) : (
          <PaperTab
            onBack={handleBackToSelect}
            onStartPractice={() => setBrowserView("practice")}
          />
        )}
      </TabLayout>
    </div>
  );
}

interface FilterTabContentProps {
  meta: QuizFilterMeta;
  filter: QuizFilter;
  loading: boolean;
  totalPages: number;
  totalCount: number;
  quizList: QuizPractice[];
  selectedCount: number;
  maxSelect: number;
  selectedIds: Set<string>;
  isSelected: (id: string) => boolean;
  onFilterChange: (filter: QuizFilter) => void;
  onPageChange: (page: number) => void;
  onToggleQuiz: (quiz: QuizPractice) => void;
  onSelectAll: () => void;
  onSelectFirstN: (n: number) => void;
  onSelectRandomN: (n: number) => void;
  onGeneratePaper: () => void;
  onClearAll: () => void;
}

function FilterTabContent({
  meta,
  filter,
  loading,
  totalPages,
  totalCount,
  quizList,
  selectedCount,
  maxSelect,
  selectedIds,
  isSelected,
  onFilterChange,
  onPageChange,
  onToggleQuiz,
  onSelectAll,
  onSelectFirstN,
  onSelectRandomN,
  onGeneratePaper,
  onClearAll,
}: FilterTabContentProps) {
  return (
    <>
      {/* Select Toolbar */}
      <SelectToolbar
        selectedCount={selectedCount}
        maxSelect={maxSelect}
        onGeneratePaper={onGeneratePaper}
        onClearAll={onClearAll}
        quizList={quizList}
        selectedIds={selectedIds}
        onSelectAll={onSelectAll}
        onSelectFirstN={onSelectFirstN}
        onSelectRandomN={onSelectRandomN}
      />

      {/* Main content - Left sidebar + Right list */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full flex">
          {/* Left sidebar - Filter */}
          <div className="w-72 shrink-0 overflow-hidden">
            <FilterPanel
              meta={meta}
              filter={filter}
              onFilterChange={onFilterChange}
              totalCount={totalCount}
            />
          </div>

          {/* Divider */}
          <div className="w-px bg-border" />

          {/* Right side - Quiz list */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="border rounded-lg m-4 bg-card overflow-hidden flex flex-col flex-1 min-h-0">
              {/* List header */}
              <div className="flex items-center gap-3 px-4 py-2.5 bg-muted/30 border-b text-xs text-muted-foreground font-medium shrink-0">
                <span className="w-6 text-center">#</span>
                <span className="w-4" />
                <span className="w-12 text-center">题型</span>
                <span className="w-14 text-center">科目</span>
                <span className="flex-1">题目</span>
                <span className="w-28">章节</span>
                <span className="w-12 text-center">年份</span>
              </div>

              {/* Scrollable content */}
              <div className="flex-1 overflow-y-auto min-h-0">
                {loading ? (
                  <div className="divide-y">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div key={i} className="flex items-center gap-3 px-4 py-3 animate-pulse">
                        <span className="w-6 h-3 bg-muted rounded" />
                        <span className="w-4 h-4 bg-muted rounded" />
                        <span className="w-12 h-4 bg-muted rounded" />
                        <span className="w-14 h-4 bg-muted rounded" />
                        <span className="flex-1 h-4 bg-muted rounded" />
                        <span className="w-28 h-4 bg-muted rounded" />
                        <span className="w-12 h-4 bg-muted rounded" />
                      </div>
                    ))}
                  </div>
                ) : quizList.length === 0 ? (
                  <div className="py-16 text-center text-sm text-muted-foreground">
                    暂无匹配的题目
                  </div>
                ) : (
                  <div className="divide-y">
                    {quizList.map((quiz, i) => (
                      <QuizSelectCard
                        key={quiz.id}
                        quiz={quiz}
                        index={(filter.page ?? 1 - 1) * (filter.limit ?? 20) + i + 1}
                        isSelected={isSelected(quiz.id)}
                        onToggle={() => onToggleQuiz(quiz)}
                        disabled={
                          !isSelected(quiz.id) && selectedCount >= maxSelect
                        }
                      />
                    ))}
                  </div>
                )}
              </div>

              {totalPages > 1 && (
                <div className="flex justify-center items-center gap-2 py-3 border-t bg-muted/20 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={(filter.page ?? 1) <= 1}
                    onClick={() => onPageChange((filter.page ?? 1) - 1)}
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
                    onClick={() => onPageChange((filter.page ?? 1) + 1)}
                  >
                    下一页
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
