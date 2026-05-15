import { useEffect, useState } from "react";
import { adminApi } from "@/lib/api";
import type { AdminUserItem } from "@/lib/types";

export function UserManagementTable() {
  const [users, setUsers] = useState<AdminUserItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    adminApi
      .getUsers(page, 20, search || undefined)
      .then((res) => {
        setUsers(res.users);
        setTotal(res.total);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page, search]);

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="rounded-xl border bg-card p-4 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">
          用户管理{" "}
          <span className="text-muted-foreground">({total} 人)</span>
        </p>
        <input
          type="text"
          placeholder="搜索用户..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="rounded-md border bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary/20"
        />
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-12 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="pb-2 pr-4">邮箱</th>
                  <th className="pb-2 pr-4">用户名</th>
                  <th className="pb-2 pr-4">练习数</th>
                  <th className="pb-2 pr-4">最后活跃</th>
                  <th className="pb-2 pr-4">注册时间</th>
                  <th className="pb-2">角色</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b last:border-0">
                    <td className="py-2.5 pr-4 font-mono text-xs">
                      {u.email}
                    </td>
                    <td className="py-2.5 pr-4">
                      {u.username || "—"}
                    </td>
                    <td className="py-2.5 pr-4">{u.total_practices}</td>
                    <td className="py-2.5 pr-4 text-xs text-muted-foreground">
                      {u.last_active_at
                        ? new Date(u.last_active_at).toLocaleDateString()
                        : "—"}
                    </td>
                    <td className="py-2.5 pr-4 text-xs text-muted-foreground">
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-2.5">
                      {u.is_admin ? (
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                          管理员
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          用户
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 text-sm">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="rounded-md border px-3 py-1 disabled:opacity-50"
              >
                上一页
              </button>
              <span className="text-muted-foreground">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="rounded-md border px-3 py-1 disabled:opacity-50"
              >
                下一页
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
