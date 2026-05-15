import type { ContentStatsSnapshot } from "@/lib/types";

export function ContentStatsPanel({
  stats,
}: {
  stats?: ContentStatsSnapshot;
}) {
  if (!stats) return null;

  const items = [
    { label: "题库总数", value: stats.total_quizzes, today: null },
    {
      label: "今日练习",
      value: stats.quizzes_practiced_today,
      today: null,
    },
    {
      label: "本周练习",
      value: stats.quizzes_practiced_this_week,
      today: null,
    },
    {
      label: "用户试卷",
      value: stats.total_papers,
      today: stats.papers_created_today,
    },
    { label: "公共试卷", value: stats.total_public_papers, today: null },
    {
      label: "讨论总数",
      value: stats.total_discussions,
      today: stats.discussions_today,
    },
  ];

  return (
    <div className="rounded-xl border bg-card p-4 space-y-4">
      <p className="text-sm font-medium">内容统计</p>
      <div className="space-y-2">
        {items.map((item) => (
          <div
            key={item.label}
            className="flex items-center justify-between text-sm"
          >
            <span className="text-muted-foreground">{item.label}</span>
            <span className="font-medium">
              {item.value.toLocaleString()}
              {item.today !== null && item.today > 0 && (
                <span className="ml-1 text-xs text-emerald-500">
                  +{item.today} 今日
                </span>
              )}
            </span>
          </div>
        ))}
      </div>
      {stats.practice_trend.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">练习趋势 (近30天)</p>
          <div className="flex items-end gap-px h-16">
            {stats.practice_trend.map((d) => {
              const max = Math.max(
                ...stats.practice_trend.map((x) => x.count),
                1,
              );
              const height = Math.max((d.count / max) * 100, 2);
              return (
                <div
                  key={d.date}
                  className="flex-1 bg-blue-500/50 rounded-t-sm min-w-1"
                  style={{ height: `${height}%` }}
                  title={`${d.date}: ${d.count}`}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
