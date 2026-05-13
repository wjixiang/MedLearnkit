import type { QuizAnalysis as QuizAnalysisType } from "@/lib/types";

interface QuizAnalysisProps {
  analysis: QuizAnalysisType | null;
}

export function QuizAnalysis({ analysis }: QuizAnalysisProps) {
  if (!analysis) return null;

  return (
    <div className="space-y-3 mt-4 pt-4 border-t">
      {analysis.point && (
        <div className="space-y-1">
          <h4 className="text-sm font-medium text-muted-foreground">要点</h4>
          <p className="text-sm text-foreground whitespace-pre-wrap">
            {analysis.point}
          </p>
        </div>
      )}

      {analysis.discuss && (
        <div className="space-y-1">
          <h4 className="text-sm font-medium text-muted-foreground">解析</h4>
          <p className="text-sm text-foreground whitespace-pre-wrap">
            {analysis.discuss}
          </p>
        </div>
      )}
    </div>
  );
}
