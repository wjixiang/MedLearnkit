import type { PracticeSummary } from "@/lib/types";
import { Target, Flame, Clock, TrendingUp } from "lucide-react";

interface StatsOverviewProps {
  summary: PracticeSummary;
}

export function StatsOverview({ summary }: StatsOverviewProps) {
  const cards = [
    {
      label: "练习题数",
      value: summary.total_practiced.toLocaleString(),
      sub: `正确 ${summary.total_correct.toLocaleString()} 题`,
      icon: Target,
      color: "text-blue-500",
    },
    {
      label: "正确率",
      value: `${summary.overall_accuracy.toFixed(1)}%`,
      sub: "整体正确率",
      icon: TrendingUp,
      color: "text-green-500",
    },
    {
      label: "连续打卡",
      value: `${summary.current_streak}`,
      sub: `最长 ${summary.longest_streak} 天`,
      icon: Flame,
      color: "text-orange-500",
    },
    {
      label: "平均用时",
      value:
        summary.avg_time_seconds >= 60
          ? `${(summary.avg_time_seconds / 60).toFixed(1)}分`
          : `${summary.avg_time_seconds.toFixed(0)}秒`,
      sub: "每题平均耗时",
      icon: Clock,
      color: "text-purple-500",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-xl border bg-card p-3 sm:p-4 transition-shadow hover:shadow-md"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-medium text-muted-foreground">
              {card.label}
            </span>
            <card.icon className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${card.color}`} />
          </div>
          <div className="mt-1.5 sm:mt-2 text-xl sm:text-2xl font-bold tracking-tight">
            {card.value}
          </div>
          <div className="mt-0.5 sm:mt-1 text-[11px] sm:text-xs text-muted-foreground">{card.sub}</div>
        </div>
      ))}
    </div>
  );
}
