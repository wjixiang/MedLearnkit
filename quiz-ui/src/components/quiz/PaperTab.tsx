import { useState, useEffect, useCallback, useRef } from "react";
import { BookOpen, Plus, Trash2, Loader2, Pencil, Check, X, RotateCcw } from "lucide-react";
import { quizApi } from "@/lib/api";
import type { PublicPaper, UserPaper, PaperRecord } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { useQuizPaper } from "./contexts/QuizPaperContext";

interface PaperTabProps {
  onBack: () => void;
  onStartPractice: () => void;
}

type PaperCategory = "public" | "my";

type PaperStatusInfo = {
  status: "not_started" | "in_progress" | "completed";
  score: number | null;
  completedAt: string | null;
  correctCount: number;
  answeredCount: number;
  totalQuestions: number;
};

function getLatestRecordStatus(records: PaperRecord[]): PaperStatusInfo {
  if (records.length === 0) {
    return { status: "not_started", score: null, completedAt: null, correctCount: 0, answeredCount: 0, totalQuestions: 0 };
  }
  const latest = records[records.length - 1];
  if (latest.status === "completed") {
    return {
      status: "completed",
      score: latest.score,
      completedAt: latest.completed_at,
      correctCount: latest.correct_count,
      answeredCount: latest.answered_count,
      totalQuestions: latest.total_questions,
    };
  }
  return {
    status: "in_progress",
    score: null,
    completedAt: null,
    correctCount: latest.correct_count,
    answeredCount: latest.answered_count,
    totalQuestions: latest.total_questions,
  };
}

function StatusBadge({ info }: { info: PaperStatusInfo }) {
  if (info.status === "not_started") {
    return (
      <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
        未练习
      </span>
    );
  }
  if (info.status === "in_progress") {
    return (
      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
        进行中 ({info.answeredCount}/{info.totalQuestions})
      </span>
    );
  }
  return (
    <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
      已完成 {info.score !== null ? `${info.score}分` : `${info.correctCount}/${info.totalQuestions}`}
    </span>
  );
}

function InlineEdit({
  value,
  onSave,
  className = "",
}: {
  value: string;
  onSave: (v: string) => void;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  if (!editing) {
    return (
      <span
        className={`group/title inline-flex items-center gap-1 cursor-pointer ${className}`}
        onClick={() => { setDraft(value); setEditing(true); }}
      >
        <span className="truncate">{value}</span>
        <Pencil size={12} className="shrink-0 opacity-0 group-hover/title:opacity-50 transition-opacity" />
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1">
      <input
        ref={inputRef}
        className="text-sm border rounded px-1.5 py-0.5 bg-background w-48 focus:outline-none focus:ring-1 focus:ring-primary"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") { onSave(draft.trim()); setEditing(false); }
          if (e.key === "Escape") setEditing(false);
        }}
      />
      <button
        className="p-0.5 text-green-600 hover:text-green-700"
        onClick={() => { onSave(draft.trim()); setEditing(false); }}
      >
        <Check size={14} />
      </button>
      <button
        className="p-0.5 text-muted-foreground hover:text-foreground"
        onClick={() => setEditing(false)}
      >
        <X size={14} />
      </button>
    </span>
  );
}

function MetadataEdit({
  paper,
  onSave,
}: {
  paper: UserPaper;
  onSave: (data: { title?: string; description?: string }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [desc, setDesc] = useState(paper.description || "");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  if (!open) {
    return (
      <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => { setDesc(paper.description || ""); setOpen(true); }}>
        <Pencil size={14} />
      </Button>
    );
  }

  return (
    <div ref={ref} className="flex items-center gap-1">
      <input
        className="text-xs border rounded px-1.5 py-0.5 bg-background w-40 focus:outline-none focus:ring-1 focus:ring-primary"
        placeholder="备注/描述"
        value={desc}
        onChange={(e) => setDesc(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") { onSave({ description: desc }); setOpen(false); }
          if (e.key === "Escape") setOpen(false);
        }}
      />
      <button
        className="p-0.5 text-green-600 hover:text-green-700"
        onClick={() => { onSave({ description: desc }); setOpen(false); }}
      >
        <Check size={14} />
      </button>
      <button
        className="p-0.5 text-muted-foreground hover:text-foreground"
        onClick={() => setOpen(false)}
      >
        <X size={14} />
      </button>
    </div>
  );
}

export function PaperTab({ onStartPractice }: PaperTabProps) {
  const [category, setCategory] = useState<PaperCategory>("public");
  const [publicPapers, setPublicPapers] = useState<PublicPaper[]>([]);
  const [myPapers, setMyPapers] = useState<UserPaper[]>([]);
  const [paperStatusMap, setPaperStatusMap] = useState<Record<string, PaperStatusInfo>>({});
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

        // Load practice status for each paper
        const statusEntries = await Promise.all(
          data.map(async (paper) => {
            try {
              const records = await quizApi.getPaperRecords(paper.id);
              return [paper.id, getLatestRecordStatus(records)] as const;
            } catch {
              return [paper.id, { status: "not_started" as const, score: null, completedAt: null, correctCount: 0, answeredCount: 0, totalQuestions: 0 }] as const;
            }
          }),
        );
        setPaperStatusMap(Object.fromEntries(statusEntries));
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
        paper.quiz_ids.map((id) => quizApi.getQuizById(id)),
      );
      const quizzesWithDetails = quizzes.map((q, i) => ({
        ...q,
        selectedAt: Date.now() + i,
      }));
      dispatch({
        type: "LOAD_PAPER",
        payload: {
          paper: { id: paper.id, title: paper.title, quiz_ids: paper.quiz_ids, created_at: paper.created_at },
          quizzes: quizzesWithDetails,
        },
      });
      onStartPractice();
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

  const handleRenamePaper = async (paperId: string, newTitle: string) => {
    if (!newTitle) return;
    try {
      const updated = await quizApi.updateMyPaper(paperId, { title: newTitle });
      setMyPapers((prev) => prev.map((p) => (p.id === paperId ? updated : p)));
    } catch (error) {
      console.error("Failed to rename paper:", error);
    }
  };

  const handleUpdateMetadata = async (paperId: string, data: { title?: string; description?: string }) => {
    try {
      const updated = await quizApi.updateMyPaper(paperId, data);
      setMyPapers((prev) => prev.map((p) => (p.id === paperId ? updated : p)));
    } catch (error) {
      console.error("Failed to update paper metadata:", error);
    }
  };

  const papers = category === "public" ? publicPapers : myPapers;

  return (
    <div className="h-full flex flex-col">
      {/* Category tabs and actions */}
      <div className="bg-card border-b px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shrink-0">
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
            {papers.map((paper) => {
              const statusInfo = paperStatusMap[paper.id];
              const isMyPaper = category === "my";

              return (
                <div
                  key={paper.id}
                  className="border rounded-lg p-4 bg-card hover:shadow-sm transition-shadow"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {isMyPaper ? (
                          <InlineEdit
                            value={paper.title}
                            onSave={(v) => handleRenamePaper(paper.id, v)}
                            className="font-medium"
                          />
                        ) : (
                          <h3 className="font-medium truncate">{paper.title}</h3>
                        )}
                        {statusInfo && <StatusBadge info={statusInfo} />}
                      </div>
                      {("description" in paper) && (
                        isMyPaper ? (
                          <div className="flex items-center gap-1 mt-1">
                            {paper.description ? (
                              <p className="text-sm text-muted-foreground line-clamp-2">
                                {paper.description}
                              </p>
                            ) : (
                              <span className="text-xs text-muted-foreground/50">暂无备注</span>
                            )}
                            <MetadataEdit
                              paper={paper as UserPaper}
                              onSave={(data) => handleUpdateMetadata(paper.id, data)}
                            />
                          </div>
                        ) : paper.description ? (
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                            {paper.description}
                          </p>
                        ) : null
                      )}
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground flex-wrap">
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

                    <div className="flex gap-2 shrink-0">
                      <Button
                        size="sm"
                        onClick={() => handleSelectPaper(paper)}
                        disabled={paper.quiz_count === 0}
                        className="flex-1 sm:flex-none"
                      >
                        {statusInfo?.status === "in_progress" && (
                          <RotateCcw size={14} className="mr-1" />
                        )}
                        恢复练习
                      </Button>
                      {isMyPaper && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeletePaper(paper.id)}
                        >
                          <Trash2 size={14} />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer hint */}
      <div className="bg-card border-t px-4 py-3 shrink-0">
        <p className="text-xs text-muted-foreground text-center">
          选择试卷后点击「恢复练习」开始做题
        </p>
      </div>
    </div>
  );
}
