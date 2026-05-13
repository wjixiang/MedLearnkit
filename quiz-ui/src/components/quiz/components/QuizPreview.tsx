import { useEffect, useState } from "react";

type Status = "todo" | "correct" | "wrong";

interface QuizPreviewProps {
  index: number;
  status: Status;
  isActive: boolean;
  onClick: () => void;
}

export function QuizPreview({
  index,
  status,
  isActive,
  onClick,
}: QuizPreviewProps) {
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    if (status !== "todo") {
      setAnimating(true);
      const timer = setTimeout(() => setAnimating(false), 500);
      return () => clearTimeout(timer);
    }
  }, [status]);

  return (
    <button
      onClick={onClick}
      className={`
        w-11 h-11 rounded-lg flex items-center justify-center text-sm font-bold
        transition-all duration-200 hover:scale-105 shrink-0
        ${animating ? "scale-110" : ""}
        ${
          isActive
            ? "border-2 border-primary ring-2 ring-primary/20"
            : status === "correct"
              ? "border-2 border-green-500 bg-green-500 text-white shadow-sm"
              : status === "wrong"
                ? "border-2 border-destructive bg-destructive text-white shadow-sm"
                : "border border-border bg-card hover:bg-muted text-muted-foreground"
        }
      `}
    >
      {index + 1}
    </button>
  );
}
