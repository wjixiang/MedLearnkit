import { useState, useRef, useEffect } from "react";
import { ChevronDown, Shuffle, ListOrdered, CheckSquare } from "lucide-react";
import type { QuizPractice } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface AdvancedSelectMenuProps {
  quizList: QuizPractice[];
  selectedIds: Set<string>;
  maxSelect: number;
  onSelectAll: () => void;
  onSelectFirstN: (n: number) => void;
  onSelectRandomN: (n: number) => void;
  disabled?: boolean;
}

export function AdvancedSelectMenu({
  quizList,
  selectedIds,
  maxSelect,
  onSelectAll,
  onSelectFirstN,
  onSelectRandomN,
  disabled,
}: AdvancedSelectMenuProps) {
  const [open, setOpen] = useState(false);
  const [selectN, setSelectN] = useState("");
  const [mode, setMode] = useState<"first" | "random">("first");
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const handleSelectN = () => {
    const n = parseInt(selectN, 10);
    if (isNaN(n) || n <= 0) return;
    if (mode === "first") {
      onSelectFirstN(n);
    } else {
      onSelectRandomN(n);
    }
    setSelectN("");
    setOpen(false);
  };

  const remainingSlots = maxSelect - selectedIds.size;
  const canSelectMore = selectedIds.size < maxSelect;

  return (
    <div ref={menuRef} className="relative">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(!open)}
        disabled={disabled}
        className="gap-1.5"
      >
        <ChevronDown size={16} />
        <span>高级选择</span>
      </Button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-64 bg-popover border rounded-lg shadow-lg z-50 p-3 space-y-3">
          {/* Select All */}
          <button
            className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={() => {
              onSelectAll();
              setOpen(false);
            }}
            disabled={!canSelectMore || quizList.length === 0}
          >
            <CheckSquare size={16} className="shrink-0" />
            <span>全选当前页</span>
            <span className="ml-auto text-xs text-muted-foreground">
              {quizList.length} 题
            </span>
          </button>

          <div className="border-t" />

          {/* Select First N */}
          <div className="space-y-2">
            <button
              className={`w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors ${
                mode === "first"
                  ? "bg-primary/10 text-primary"
                  : "hover:bg-muted"
              }`}
              onClick={() => setMode("first")}
            >
              <ListOrdered size={16} className="shrink-0" />
              <span>选择前 n 条</span>
            </button>
            {mode === "first" && (
              <div className="flex gap-2 pl-8">
                <Input
                  type="number"
                  min="1"
                  max={Math.min(quizList.length, remainingSlots)}
                  placeholder="数量"
                  value={selectN}
                  onChange={(e) => setSelectN(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSelectN()}
                  className="h-7 w-20 text-sm"
                />
                <Button size="sm" variant="outline" onClick={handleSelectN}>
                  确定
                </Button>
              </div>
            )}
          </div>

          {/* Select Random N */}
          <div className="space-y-2">
            <button
              className={`w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors ${
                mode === "random"
                  ? "bg-primary/10 text-primary"
                  : "hover:bg-muted"
              }`}
              onClick={() => setMode("random")}
            >
              <Shuffle size={16} className="shrink-0" />
              <span>随机选择 n 条</span>
            </button>
            {mode === "random" && (
              <div className="flex gap-2 pl-8">
                <Input
                  type="number"
                  min="1"
                  max={Math.min(quizList.length, remainingSlots)}
                  placeholder="数量"
                  value={selectN}
                  onChange={(e) => setSelectN(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSelectN()}
                  className="h-7 w-20 text-sm"
                />
                <Button size="sm" variant="outline" onClick={handleSelectN}>
                  确定
                </Button>
              </div>
            )}
          </div>

          <div className="border-t pt-2">
            <p className="text-xs text-muted-foreground px-3">
              还可选择 {remainingSlots} / {maxSelect} 题
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
