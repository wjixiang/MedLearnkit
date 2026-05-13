import { Moon, Sun, Monitor } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useTheme } from "@/components/theme-provider"

const themes = [
  { value: "light" as const, icon: Sun, label: "浅色" },
  { value: "dark" as const, icon: Moon, label: "深色" },
  { value: "system" as const, icon: Monitor, label: "系统" },
]

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  const currentIndex = themes.findIndex((t) => t.value === theme)
  const nextIndex = (currentIndex + 1) % themes.length
  const next = themes[nextIndex]
  const Icon = next.icon

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={() => setTheme(next.value)}
      title={`切换主题（当前：${themes[currentIndex]?.label ?? "系统"}，切换至：${next.label}）`}
    >
      <Icon />
    </Button>
  )
}
