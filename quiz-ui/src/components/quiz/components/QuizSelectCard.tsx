import { Check } from "lucide-react";
import type { QuizPractice } from "@/lib/types";
import { Badge } from "@/components/ui/badge";

interface QuizSelectCardProps {
  quiz: QuizPractice;
  index: number;
  isSelected: boolean;
  onToggle: () => void;
  disabled?: boolean;
}

export function QuizSelectCard({
  quiz,
  index,
  isSelected,
  onToggle,
  disabled,
}: QuizSelectCardProps) {
  return (
    <div
      className={`
        group flex items-center gap-3 px-4 py-3 transition-colors cursor-pointer border-b last:border-b-0
        ${isSelected ? "bg-primary/5" : "hover:bg-muted/50"}
        ${disabled && !isSelected ? "opacity-50 cursor-not-allowed" : ""}
      `}
      onClick={() => !disabled && onToggle()}
    >
      {/* Index number */}
      <span className="w-6 text-center text-xs text-muted-foreground shrink-0">
        {index}
      </span>

      {/* Checkbox */}
      <div
        className={`
          shrink-0 w-4 h-4 rounded border-2 flex items-center justify-center transition-all
          ${isSelected
            ? "bg-primary border-primary"
            : "border-muted-foreground/30 group-hover:border-primary/50"}
        `}
      >
        {isSelected && <Check size={10} className="text-primary-foreground" />}
      </div>

      {/* Badges */}
      <div className="flex items-center gap-1.5 shrink-0">
        <Badge variant="secondary" className="text-xs px-1.5 py-0">
          {quiz.type}
        </Badge>
        <Badge variant="outline" className="text-xs px-1.5 py-0">
          {quiz.class}
        </Badge>
      </div>

      {/* Question */}
      <p className="flex-1 min-w-0 text-sm truncate text-foreground/90">
        {quiz.question}
      </p>

      {/* Meta */}
      <div className="flex items-center gap-2 shrink-0 text-xs text-muted-foreground">
        <span className="truncate max-w-32">{quiz.unit}</span>
        {quiz.extracted_year && (
          <span>{quiz.extracted_year}</span>
        )}
      </div>
    </div>
  );
}
