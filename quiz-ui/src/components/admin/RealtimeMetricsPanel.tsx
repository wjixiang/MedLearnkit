import { useEffect, useState } from "react";
import { adminApi } from "@/lib/api";
import type { RealtimeMetrics } from "@/lib/types";

export function RealtimeMetricsPanel() {
  const [data, setData] = useState<RealtimeMetrics | null>(null);

  useEffect(() => {
    const fetch = () => {
      adminApi.getRealtimeMetrics().then(setData).catch(() => {});
    };
    fetch();
    const interval = setInterval(fetch, 10000);
    return () => clearInterval(interval);
  }, []);

  if (!data) {
    return (
      <div className="rounded-xl border bg-card p-4 animate-pulse">
        <p className="text-sm font-medium">实时指标</p>
        <div className="mt-4 h-32 bg-muted rounded" />
      </div>
    );
  }

  const errorColor =
    data.error_rate_percent > 5
      ? "text-destructive"
      : data.error_rate_percent > 1
        ? "text-yellow-500"
        : "text-emerald-500";

  return (
    <div className="rounded-xl border bg-card p-4 space-y-4">
      <p className="text-sm font-medium">实时指标</p>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-muted-foreground">请求速率</p>
          <p className="text-2xl font-bold">
            {data.requests_per_minute.toFixed(1)}
            <span className="text-sm font-normal text-muted-foreground">
              {" "}
              req/min
            </span>
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">错误率</p>
          <p className={`text-2xl font-bold ${errorColor}`}>
            {data.error_rate_percent.toFixed(2)}
            <span className="text-sm font-normal text-muted-foreground">
              {" "}
              %
            </span>
          </p>
        </div>
      </div>
      {data.endpoints.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">活跃端点</p>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {data.endpoints
              .sort((a, b) => b.request_count - a.request_count)
              .slice(0, 8)
              .map((ep) => (
                <div
                  key={`${ep.method}-${ep.endpoint}`}
                  className="flex items-center justify-between text-xs"
                >
                  <span className="font-mono text-muted-foreground">
                    {ep.method} {ep.endpoint}
                  </span>
                  <span>
                    {ep.request_count}{" "}
                    <span className="text-muted-foreground">
                      ({ep.avg_duration_ms.toFixed(1)}ms)
                    </span>
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
