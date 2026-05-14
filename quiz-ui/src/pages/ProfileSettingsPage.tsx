import { useState, type FormEvent } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { authApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel, FieldDescription } from "@/components/ui/field";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Camera } from "lucide-react";

export function ProfileSettingsPage() {
  const { user, updateUser } = useAuth();
  const [username, setUsername] = useState(user?.username ?? "");
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url ?? "");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fallback = user?.username
    ? user.username.slice(0, 2).toUpperCase()
    : user?.email
      ? user.email[0].toUpperCase()
      : "U";

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setIsLoading(true);

    try {
      const updated = await authApi.updateProfile({
        username: username || undefined,
        avatar_url: avatarUrl || undefined,
      });
      updateUser(updated);
      setMessage({ type: "success", text: "个人资料已更新" });
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "更新失败",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-5 sm:space-y-6">
      <div>
        <h2 className="text-lg font-semibold">个人设置</h2>
        <p className="text-sm text-muted-foreground">管理你的个人资料和头像</p>
      </div>

      <Separator />

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-6">
          <div className="relative group">
            <Avatar size="lg">
              <AvatarImage src={avatarUrl || undefined} alt={username || "用户"} />
              <AvatarFallback className="text-lg">{fallback}</AvatarFallback>
            </Avatar>
            <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
              <Camera size={18} className="text-white" />
            </div>
          </div>
          <div className="flex-1">
            <Field>
              <FieldLabel>头像链接</FieldLabel>
              <Input
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                placeholder="输入头像图片 URL"
                disabled={isLoading}
              />
              <FieldDescription>支持 JPG、PNG 格式的图片链接</FieldDescription>
            </Field>
          </div>
        </div>

        <Field>
          <FieldLabel>用户名</FieldLabel>
          <Input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="输入用户名"
            disabled={isLoading}
          />
          <FieldDescription>这将作为你的公开展示名称</FieldDescription>
        </Field>

        <Field>
          <FieldLabel>邮箱</FieldLabel>
          <Input value={user?.email ?? ""} disabled />
          <FieldDescription>邮箱不可更改，如需修改请联系管理员</FieldDescription>
        </Field>

        {message && (
          <div
            className={`rounded-md p-3 text-sm ${
              message.type === "success"
                ? "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400"
                : "bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400"
            }`}
          >
            {message.text}
          </div>
        )}

        <div className="flex justify-end">
          <Button type="submit" disabled={isLoading}>
            {isLoading ? "保存中..." : "保存更改"}
          </Button>
        </div>
      </form>
    </div>
  );
}
