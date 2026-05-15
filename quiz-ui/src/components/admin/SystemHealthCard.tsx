import type { SystemHealthSnapshot } from "@/lib/types";

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}天 ${hours}小时`;
  if (hours > 0) return `${hours}小时 ${minutes}分钟`;
  return `${minutes}分钟`;
}

export function SystemHealthCard({
  system,
}: {
  system?: SystemHealthSnapshot;
}) {
  if (!system) return null;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <div className="rounded-xl border bg-card p-4">
        <p className="text-xs text-muted-foreground">运行时间</p>
        <p className="mt-1 text-lg font-semibold">
          {formatUptime(system.uptime_seconds)}
        </p>
      </div>
      <div className="rounded-xl border bg-card p-4">
        <p className="text-xs text-muted-foreground">总请求数</p>
        <p className="mt-1 text-lg font-semibold">
          {system.total_requests.toLocaleString()}
        </p>
      </div>
      <div className="rounded-xl border bg-card p-4">
        <p className="text-xs text-muted-foreground">总错误数</p>
        <p className="mt-1 text-lg font-semibold text-destructive">
          {system.total_errors.toLocaleString()}
        </p>
      </div>
      <div className="rounded-xl border bg-card p-4">
        <p className="text-xs text-muted-foreground">今日平均响应</p>
        <p className="mt-1 text-lg font-semibold">
          {system.avg_response_ms_today > 0
            ? `${system.avg_response_ms_today.toFixed(1)}ms`
            : "—"}
        </p>
      </div>
    </div>
  );
}
