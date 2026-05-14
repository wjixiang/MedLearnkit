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
        "bg-emerald-50 dark:bg-emerald-950/40 border-2 border-emerald-500 dark:border-emerald-400";
    } else if (!selected && correct) {
      conditionalClasses =
        "bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-400 dark:border-emerald-600";
    } else if (selected && !correct) {
      conditionalClasses =
        "bg-red-50 dark:bg-red-950/40 border-2 border-red-500 dark:border-red-400";
    } else {
      conditionalClasses =
        "bg-muted/30 dark:bg-muted/20 border border-border/50";
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
                className="text-emerald-600 dark:text-emerald-400 font-bold"
              />
            ) : (
              <X
                size={16}
                className="text-red-600 dark:text-red-400 font-bold"
              />
            ))}
          {!selected && correct && (
            <Check
              size={16}
              className="text-emerald-500 dark:text-emerald-500 font-bold"
            />
          )}
        </div>
      )}
    </div>
  );
}
