import { Trash2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { QuizPractice } from "@/lib/types";
import { AdvancedSelectMenu } from "./AdvancedSelectMenu";

interface SelectToolbarProps {
  selectedCount: number;
  maxSelect: number;
  onGeneratePaper: () => void;
  onClearAll: () => void;
  quizList: QuizPractice[];
  selectedIds: Set<string>;
  onSelectAll: () => void;
  onSelectFirstN: (n: number) => void;
  onSelectRandomN: (n: number) => void;
}

export function SelectToolbar({
  selectedCount,
  maxSelect,
  onGeneratePaper,
  onClearAll,
  quizList,
  selectedIds,
  onSelectAll,
  onSelectFirstN,
  onSelectRandomN,
}: SelectToolbarProps) {
  const isAtLimit = selectedCount >= maxSelect;

  return (
    <div className="bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b shrink-0">
      <div className="px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Badge variant={isAtLimit ? "destructive" : "secondary"}>
            已选 {selectedCount}/{maxSelect}
          </Badge>
          {isAtLimit && (
            <span className="text-xs text-muted-foreground">已达上限</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <AdvancedSelectMenu
            quizList={quizList}
            selectedIds={selectedIds}
            maxSelect={maxSelect}
            onSelectAll={onSelectAll}
            onSelectFirstN={onSelectFirstN}
            onSelectRandomN={onSelectRandomN}
            disabled={selectedCount >= maxSelect}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={onClearAll}
            disabled={selectedCount === 0}
          >
            <Trash2 size={16} />
            <span className="ml-2">清空</span>
          </Button>
          <Button
            size="sm"
            onClick={onGeneratePaper}
            disabled={selectedCount === 0}
          >
            <Check size={16} />
            <span className="ml-2">生成试卷</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
