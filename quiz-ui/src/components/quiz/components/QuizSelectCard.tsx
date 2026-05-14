import { Check } from "lucide-react";
import type { QuizPractice } from "@/lib/types";

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
    <>
      {/* Mobile card layout */}
      <div
        className={`
          md:hidden p-3.5 transition-colors cursor-pointer border-b
          ${isSelected ? "bg-primary/5" : "hover:bg-muted/50"}
          ${disabled && !isSelected ? "opacity-50 cursor-not-allowed" : ""}
        `}
        onClick={() => !disabled && onToggle()}
      >
        <div className="flex items-start gap-3">
          <div
            className={`
              shrink-0 w-4 h-4 mt-0.5 rounded border-2 flex items-center justify-center transition-all
              ${isSelected
                ? "bg-primary border-primary"
                : "border-muted-foreground/30"}
            `}
          >
            {isSelected && <Check size={10} className="text-primary-foreground" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-foreground/90 leading-relaxed line-clamp-3">
              {quiz.question}
            </p>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className="text-[11px] font-medium px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                {quiz.type}型
              </span>
              <span className="text-[11px] text-muted-foreground">
                {quiz.class}
              </span>
              {quiz.unit && (
                <span className="text-[11px] text-muted-foreground truncate max-w-[120px]">
                  {quiz.unit}
                </span>
              )}
              {quiz.extracted_year && (
                <span className="text-[11px] text-muted-foreground">
                  {quiz.extracted_year}
                </span>
              )}
            </div>
          </div>
          <span className="text-[11px] text-muted-foreground/60 shrink-0">
            {index}
          </span>
        </div>
      </div>

      {/* Desktop table row layout */}
      <div
        className={`
          hidden md:flex group items-center gap-3 px-4 py-3 transition-colors cursor-pointer border-b last:border-b-0
          ${isSelected ? "bg-primary/5" : "hover:bg-muted/50"}
          ${disabled && !isSelected ? "opacity-50 cursor-not-allowed" : ""}
        `}
        onClick={() => !disabled && onToggle()}
      >
        <span className="w-6 text-center text-xs text-muted-foreground shrink-0">
          {index}
        </span>

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

        <span className="w-12 text-center text-xs font-medium text-muted-foreground shrink-0">
          {quiz.type}型
        </span>

        <span className="w-14 text-center text-xs text-muted-foreground shrink-0 truncate">
          {quiz.class}
        </span>

        <p className="flex-1 min-w-0 text-sm truncate text-foreground/90">
          {quiz.question}
        </p>

        <span className="w-28 shrink-0 text-xs text-muted-foreground truncate">
          {quiz.unit}
        </span>

        <span className="w-12 text-center text-xs text-muted-foreground shrink-0">
          {quiz.extracted_year || ""}
        </span>
      </div>
    </>
  );
}
