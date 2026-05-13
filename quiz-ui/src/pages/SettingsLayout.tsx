import { useNavigate, Outlet, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { User, Shield, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UserDropdown } from "@/components/UserDropdown";
import { ThemeToggle } from "@/components/theme-toggle";

const SETTINGS_TABS = [
  { id: "profile", label: "个人设置", icon: User, path: "/settings/profile" },
  { id: "account", label: "账户管理", icon: Shield, path: "/settings/account" },
];

export function SettingsLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div className="h-screen flex flex-col bg-background">
      <header className="bg-card border-b shrink-0">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => navigate("/")}
            >
              <ArrowLeft />
            </Button>
            <h1 className="text-xl font-bold">设置</h1>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <UserDropdown />
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-hidden flex">
        <nav className="w-52 shrink-0 border-r bg-card p-3">
          <ul className="space-y-1">
            {SETTINGS_TABS.map((tab) => {
              const Icon = tab.icon;
              const active = location.pathname === tab.path;
              return (
                <li key={tab.id}>
                  <button
                    onClick={() => navigate(tab.path)}
                    className={cn(
                      "w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      active
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    <Icon size={16} />
                    {tab.label}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
