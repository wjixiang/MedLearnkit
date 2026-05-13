import { useNavigate } from "react-router-dom";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/AuthContext";
import { User, LogOut, Shield, BarChart3 } from "lucide-react";

export function UserDropdown() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const fallback = user?.username
    ? user.username.slice(0, 2).toUpperCase()
    : user?.email
      ? user.email[0].toUpperCase()
      : "U";

  const displayName = user?.username || user?.email || "用户";

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-2 rounded-lg px-2 py-1 outline-none hover:bg-muted transition-colors">
          <Avatar size="sm">
            <AvatarImage src={user?.avatar_url ?? undefined} alt={displayName} />
            <AvatarFallback>{fallback}</AvatarFallback>
          </Avatar>
          <span className="text-sm font-medium max-w-24 truncate hidden sm:inline">
            {displayName}
          </span>
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex items-center gap-2">
          <Avatar size="sm">
            <AvatarImage src={user?.avatar_url ?? undefined} alt={displayName} />
            <AvatarFallback>{fallback}</AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <span className="text-sm font-medium text-foreground">{displayName}</span>
            <span className="text-xs text-muted-foreground truncate max-w-36">
              {user?.email}
            </span>
          </div>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        <DropdownMenuGroup>
          <DropdownMenuItem onClick={() => navigate("/stats")}>
            <BarChart3 />
            练习统计
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => navigate("/settings/profile")}>
            <User />
            个人设置
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => navigate("/settings/account")}>
            <Shield />
            账户管理
          </DropdownMenuItem>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        <DropdownMenuItem variant="destructive" onClick={handleLogout}>
          <LogOut />
          退出登录
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
