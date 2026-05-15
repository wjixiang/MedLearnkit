import type { UserStatsSnapshot } from "@/lib/types";

export function UserStatsPanel({ stats }: { stats?: UserStatsSnapshot }) {
  if (!stats) return null;

  return (
    <div className="rounded-xl border bg-card p-4 space-y-4">
      <p className="text-sm font-medium">用户统计</p>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-muted/50 p-3">
          <p className="text-xs text-muted-foreground">总用户</p>
          <p className="text-xl font-bold">{stats.total_users}</p>
        </div>
        <div className="rounded-lg bg-muted/50 p-3">
          <p className="text-xs text-muted-foreground">今日新增</p>
          <p className="text-xl font-bold">{stats.new_users_today}</p>
        </div>
        <div className="rounded-lg bg-muted/50 p-3">
          <p className="text-xs text-muted-foreground">DAU / WAU / MAU</p>
          <p className="text-lg font-bold">
            {stats.dau}{" "}
            <span className="text-muted-foreground">/</span> {stats.wau}{" "}
            <span className="text-muted-foreground">/</span> {stats.mau}
          </p>
        </div>
        <div className="rounded-lg bg-muted/50 p-3">
          <p className="text-xs text-muted-foreground">本月新增</p>
          <p className="text-xl font-bold">{stats.new_users_this_month}</p>
        </div>
      </div>
      {stats.user_growth.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">注册趋势 (近30天)</p>
          <div className="flex items-end gap-px h-16">
            {stats.user_growth.map((d) => {
              const max = Math.max(...stats.user_growth.map((x) => x.count), 1);
              const height = Math.max((d.count / max) * 100, 2);
              return (
                <div
                  key={d.date}
                  className="flex-1 bg-primary/60 rounded-t-sm min-w-1"
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
