interface DateRangeSelectorProps {
  days: number;
  onChange: (days: number) => void;
}

const RANGES = [7, 14, 30, 60, 90, 180, 365];

export function DateRangeSelector({ days, onChange }: DateRangeSelectorProps) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto no-scrollbar -mx-1 px-1">
      {RANGES.map((d) => (
        <button
          key={d}
          onClick={() => onChange(d)}
          className={`rounded-full px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
            days === d
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
          }`}
        >
          {d}天
        </button>
      ))}
    </div>
  );
}
