import { useState, useEffect, useCallback } from "react";
import { BookOpen, Plus, Trash2, Loader2 } from "lucide-react";
import { quizApi } from "@/lib/api";
import type { PublicPaper, UserPaper } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { useQuizPaper } from "./contexts/QuizPaperContext";

interface PaperTabProps {
  onBack: () => void;
  onStartPractice: () => void;
}

type PaperCategory = "public" | "my";

export function PaperTab({}: PaperTabProps) {
  const [category, setCategory] = useState<PaperCategory>("public");
  const [publicPapers, setPublicPapers] = useState<PublicPaper[]>([]);
  const [myPapers, setMyPapers] = useState<UserPaper[]>([]);
  const [loading, setLoading] = useState(true);
  const { state, dispatch } = useQuizPaper();

  const loadPapers = useCallback(async () => {
    setLoading(true);
    try {
      if (category === "public") {
        const data = await quizApi.getPublicPapers();
        setPublicPapers(data);
      } else {
        const data = await quizApi.getMyPapers();
        setMyPapers(data);
      }
    } catch (error) {
      console.error("Failed to load papers:", error);
    } finally {
      setLoading(false);
    }
  }, [category]);

  useEffect(() => {
    loadPapers();
  }, [loadPapers]);

  const handleSelectPaper = async (paper: PublicPaper | UserPaper) => {
    try {
      const quizzes = await Promise.all(
        paper.quiz_ids.map((id) => quizApi.getQuizById(id))
      );
      const quizzesWithDetails = quizzes.map((q, i) => ({
        ...q,
        selectedAt: Date.now() + i,
      }));
      dispatch({ type: "LOAD_PAPER_PREVIEW", payload: quizzesWithDetails });
    } catch (error) {
      console.error("Failed to load paper quizzes:", error);
    }
  };

  const handleDeletePaper = async (paperId: string) => {
    if (!confirm("确定要删除这个试卷吗？")) return;
    try {
      await quizApi.deleteMyPaper(paperId);
      setMyPapers((prev) => prev.filter((p) => p.id !== paperId));
    } catch (error) {
      console.error("Failed to delete paper:", error);
    }
  };

  const handleCreatePaper = async () => {
    const title = prompt("请输入试卷标题：");
    if (!title || title.trim() === "") return;

    const selectedIds = state.selectedQuizzes.map((q) => q.id);

    if (selectedIds.length === 0) {
      alert("请先选择题目");
      return;
    }

    try {
      const newPaper = await quizApi.createMyPaper(title, selectedIds);
      setMyPapers((prev) => [newPaper, ...prev]);
      dispatch({ type: "CLEAR_ALL" });
      alert("试卷创建成功！");
    } catch (error) {
      console.error("Failed to create paper:", error);
      alert("创建失败，请重试");
    }
  };

  const papers = category === "public" ? publicPapers : myPapers;

  return (
    <div className="h-full flex flex-col">
      {/* Category tabs and actions */}
      <div className="bg-card border-b px-4 py-3 flex items-center justify-between shrink-0">
        <div className="flex gap-1 bg-muted rounded-lg p-1">
          <button
            onClick={() => setCategory("public")}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
              category === "public"
                ? "bg-background shadow-sm font-medium"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            公共试卷
          </button>
          <button
            onClick={() => setCategory("my")}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
              category === "my"
                ? "bg-background shadow-sm font-medium"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            我的私人试卷
          </button>
        </div>

        {category === "my" && (
          <Button size="sm" onClick={handleCreatePaper}>
            <Plus size={16} />
            <span className="ml-1">新建试卷</span>
          </Button>
        )}
      </div>

      {/* Paper list */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : papers.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            {category === "public" ? "暂无公共试卷" : "您还没有创建私人试卷"}
          </div>
        ) : (
          <div className="space-y-3">
            {papers.map((paper) => (
              <div
                key={paper.id}
                className="border rounded-lg p-4 bg-card hover:shadow-sm transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium truncate">{paper.title}</h3>
                    {"description" in paper && paper.description && (
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                        {paper.description}
                      </p>
                    )}
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <BookOpen size={12} />
                        {paper.quiz_count} 道题
                      </span>
                      <span>
                        {new Date(paper.created_at).toLocaleDateString()}
                      </span>
                      {"source" in paper && paper.source && (
                        <span className="bg-muted px-1.5 py-0.5 rounded">
                          {paper.source}
                        </span>
                      )}
                    </div>
                    {"tags" in paper && paper.tags.length > 0 && (
                      <div className="flex gap-1 mt-2 flex-wrap">
                        {paper.tags.map((tag) => (
                          <span
                            key={tag}
                            className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 ml-4 shrink-0">
                    <Button
                      size="sm"
                      onClick={() => handleSelectPaper(paper)}
                      disabled={paper.quiz_count === 0}
                    >
                      抽取练习
                    </Button>
                    {category === "my" && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeletePaper(paper.id)}
                        >
                          <Trash2 size={14} />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer hint */}
      <div className="bg-card border-t px-4 py-3 shrink-0">
        <p className="text-xs text-muted-foreground text-center">
          选择试卷后点击「抽取练习」开始做题，系统将从试卷中随机抽取题目进行练习
        </p>
      </div>
    </div>
  );
}
