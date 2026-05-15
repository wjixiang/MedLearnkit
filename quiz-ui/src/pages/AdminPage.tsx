import { useEffect, useState } from "react";
import { useNavigate, Outlet, useLocation } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UserDropdown } from "@/components/UserDropdown";
import { ThemeToggle } from "@/components/theme-toggle";
import { AdminGuard } from "@/components/admin";
import { SystemHealthCard } from "@/components/admin/SystemHealthCard";
import { RealtimeMetricsPanel } from "@/components/admin/RealtimeMetricsPanel";
import { UserStatsPanel } from "@/components/admin/UserStatsPanel";
import { ContentStatsPanel } from "@/components/admin/ContentStatsPanel";
import { UserManagementTable } from "@/components/admin/UserManagementTable";
import { adminApi } from "@/lib/api";
import type { AdminDashboardResponse } from "@/lib/types";

function AdminOverview() {
  const [data, setData] = useState<AdminDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi
      .getDashboard()
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-20 animate-pulse rounded-xl bg-muted"
            />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="h-64 animate-pulse rounded-xl bg-muted" />
          <div className="h-64 animate-pulse rounded-xl bg-muted" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center gap-3 py-20">
        <p className="text-sm text-destructive">加载仪表盘数据失败</p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => window.location.reload()}
        >
          重试
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <SystemHealthCard system={data.system} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <RealtimeMetricsPanel />
        <UserStatsPanel stats={data.user_stats} />
      </div>
      <ContentStatsPanel stats={data.content_stats} />
    </div>
  );
}

function AdminMetrics() {
  return (
    <div className="space-y-4">
      <RealtimeMetricsPanel />
      <div className="rounded-xl border bg-card p-4">
        <p className="text-sm font-medium mb-2">
          请求指标详情请查看 Swagger UI
        </p>
        <p className="text-xs text-muted-foreground">
          /api/admin/metrics/requests 端点提供按小时粒度的请求指标数据
        </p>
      </div>
    </div>
  );
}

const tabs = [
  { path: "/admin", label: "概览" },
  { path: "/admin/users", label: "用户" },
  { path: "/admin/metrics", label: "指标" },
];

export function AdminPage() {
  return (
    <AdminGuard>
      <AdminLayout />
    </AdminGuard>
  );
}

function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const isActive = (path: string) => location.pathname === path;

  const renderContent = () => {
    if (location.pathname === "/admin/users") return <UserManagementTable />;
    if (location.pathname === "/admin/metrics") return <AdminMetrics />;
    return <AdminOverview />;
  };

  return (
    <div className="flex h-screen flex-col bg-background">
      <header className="shrink-0 border-b bg-card">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => navigate("/")}
            >
              <ArrowLeft />
            </Button>
            <h1 className="text-xl font-bold">管理后台</h1>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <UserDropdown />
          </div>
        </div>
        <div className="flex gap-1 px-4 pb-2">
          {tabs.map((tab) => (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                isActive(tab.path)
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl space-y-4 p-4">
          {renderContent()}
        </div>
      </main>
      <Outlet />
    </div>
  );
}
