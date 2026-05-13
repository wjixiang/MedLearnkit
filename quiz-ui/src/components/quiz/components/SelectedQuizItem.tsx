import { GripVertical, X } from "lucide-react";
import type { SelectedQuiz } from "@/lib/types";
import { Badge } from "@/components/ui/badge";

interface SelectedQuizItemProps {
  quiz: SelectedQuiz;
  index: number;
  onRemove: () => void;
  onDragStart: (index: number) => void;
  onDragOver: (index: number) => void;
  onDrop: () => void;
}

export function SelectedQuizItem({
  quiz,
  index,
  onRemove,
  onDragStart,
  onDragOver,
  onDrop,
}: SelectedQuizItemProps) {
  return (
    <div
      draggable
      onDragStart={() => onDragStart(index)}
      onDragOver={(e) => {
        e.preventDefault();
        onDragOver(index);
      }}
      onDrop={onDrop}
      className="flex items-center gap-3 p-3 border rounded-lg bg-card hover:bg-muted/50 transition-colors cursor-move"
    >
      <GripVertical size={16} className="text-muted-foreground shrink-0" />
      <span className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-bold shrink-0">
        {index + 1}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex gap-2 mb-1">
          <Badge variant="secondary">{quiz.type}</Badge>
          <Badge variant="outline">{quiz.class}</Badge>
        </div>
        <p className="text-sm line-clamp-1">{quiz.question}</p>
      </div>
      <button
        onClick={onRemove}
        className="p-1 hover:bg-muted rounded-md transition-colors shrink-0"
      >
        <X size={16} />
      </button>
    </div>
  );
}
