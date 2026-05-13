import type { ReactNode } from "react";
import { Check, X } from "lucide-react";

interface OptionItemProps {
  selected: boolean;
  submitted?: boolean;
  correct?: boolean;
  onClick?: () => void;
  className?: string;
  children: ReactNode;
}

export function OptionItem({
  selected,
  submitted = false,
  correct,
  onClick,
  className = "",
  children,
}: OptionItemProps) {
  const baseClasses =
    "flex items-center justify-between p-3 border mb-1 rounded-lg cursor-pointer transition-all ";

  let conditionalClasses = "";

  if (submitted) {
    if (selected && correct) {
      conditionalClasses =
        "bg-[hsl(var(--quiz-user-correct)/0.4)] border-2 border-[hsl(var(--quiz-user-correct))]";
    } else if (!selected && correct) {
      conditionalClasses =
        "bg-[hsl(var(--quiz-missed-correct)/0.2)] border border-[hsl(var(--quiz-missed-correct))]";
    } else if (selected && !correct) {
      conditionalClasses =
        "bg-[hsl(var(--quiz-user-incorrect)/0.2)] border-2 border-[hsl(var(--quiz-user-incorrect))]";
    } else {
      conditionalClasses =
        "bg-[hsl(var(--quiz-default-incorrect)/0.15)] border border-[hsl(var(--quiz-default-incorrect)/0.5)]";
    }
  } else {
    conditionalClasses = `border-border ${selected ? "bg-primary/10 border-2 border-primary" : ""} hover:bg-muted hover:border-dashed`;
  }

  return (
    <div
      className={`${baseClasses} ${conditionalClasses} ${className}`}
      onClick={onClick}
    >
      {children}
      {submitted && (
        <div className="flex items-center ml-2 shrink-0">
          {selected &&
            (correct ? (
              <Check
                size={16}
                className="text-[hsl(var(--quiz-user-correct))] font-bold"
              />
            ) : (
              <X
                size={16}
                className="text-[hsl(var(--quiz-user-incorrect))] font-bold"
              />
            ))}
          {!selected && correct && (
            <Check
              size={16}
              className="text-[hsl(var(--quiz-missed-correct))] font-bold"
            />
          )}
        </div>
      )}
    </div>
  );
}
