import { useState } from "react";
import { quizApi } from "@/lib/api";
import { useQuizPaper } from "../contexts/QuizPaperContext";
import { SelectedQuizItem } from "./SelectedQuizItem";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Play, Save, Trash2 } from "lucide-react";

interface PaperPreviewProps {
  onConfirm: () => void;
  onBack: () => void;
}

export function PaperPreview({ onConfirm, onBack }: PaperPreviewProps) {
  const { state, dispatch } = useQuizPaper();
  const [saving, setSaving] = useState(false);
  const [paperTitle, setPaperTitle] = useState(
    `试卷 ${new Date().toLocaleDateString()}`,
  );
  const [dragFromIndex, setDragFromIndex] = useState<number | null>(null);

  const handleRemove = (quizId: string) => {
    dispatch({ type: "REMOVE_QUIZ", payload: quizId });
  };

  const handleClearAll = () => {
    dispatch({ type: "CLEAR_ALL" });
  };

  const handleDragStart = (index: number) => {
    setDragFromIndex(index);
  };

  const handleDragOver = (index: number) => {
    if (dragFromIndex === null || dragFromIndex === index) return;
    dispatch({
      type: "REORDER",
      payload: { from: dragFromIndex, to: index },
    });
    setDragFromIndex(index);
  };

  const handleDrop = () => {
    setDragFromIndex(null);
  };

  const handleSavePaper = async () => {
    if (state.selectedQuizzes.length === 0) return;
    setSaving(true);
    try {
      const paper = await quizApi.createPaper(
        paperTitle,
        state.selectedQuizzes.map((q) => q.id),
      );
      dispatch({ type: "ADD_PAPER", payload: paper });
      onConfirm();
    } catch (error) {
      console.error("Failed to save paper:", error);
    } finally {
      setSaving(false);
    }
  };

  const typeCount = state.selectedQuizzes.reduce((acc, q) => {
    acc[q.type] = (acc[q.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={onBack}>
                <ArrowLeft size={20} />
              </Button>
              <h1 className="text-xl font-bold">组卷确认</h1>
              <Badge variant="secondary">
                {state.selectedQuizzes.length} 道题
              </Badge>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearAll}
                disabled={state.selectedQuizzes.length === 0}
              >
                <Trash2 size={16} />
                <span className="ml-2">清空</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        <div className="mb-6">
          <label className="text-sm font-medium mb-2 block">试卷标题</label>
          <input
            type="text"
            value={paperTitle}
            onChange={(e) => setPaperTitle(e.target.value)}
            className="w-full p-2 border rounded-md bg-background"
          />
        </div>

        <div className="mb-6 p-4 bg-muted/50 rounded-lg">
          <h3 className="text-sm font-medium mb-2">题目分布</h3>
          <div className="flex gap-2 flex-wrap">
            {Object.entries(typeCount).map(([type, count]) => (
              <Badge key={type} variant="outline">
                {type}型题: {count}
              </Badge>
            ))}
          </div>
        </div>

        <div className="mb-4">
          <h3 className="text-sm font-medium text-muted-foreground mb-3">
            已选题目（拖拽调整顺序）
          </h3>
          <div className="space-y-2">
            {state.selectedQuizzes.map((quiz, index) => (
              <SelectedQuizItem
                key={quiz.id}
                quiz={quiz}
                index={index}
                onRemove={() => handleRemove(quiz.id)}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
              />
            ))}
          </div>
        </div>

        {state.selectedQuizzes.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            还没有选择题目
          </div>
        )}
      </main>

      <footer className="fixed bottom-0 left-0 right-0 bg-background border-t">
        <div className="max-w-4xl mx-auto px-4 py-4 flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onBack}>
            返回选题
          </Button>
          <Button
            variant="outline"
            className="flex-1"
            onClick={handleSavePaper}
            disabled={state.selectedQuizzes.length === 0 || saving}
          >
            <Save size={16} />
            <span className="ml-2">
              {saving ? "保存中..." : "保存并练习"}
            </span>
          </Button>
          <Button
            className="flex-1"
            onClick={onConfirm}
            disabled={state.selectedQuizzes.length === 0}
          >
            <Play size={16} />
            <span className="ml-2">直接练习</span>
          </Button>
        </div>
      </footer>
    </div>
  );
}
