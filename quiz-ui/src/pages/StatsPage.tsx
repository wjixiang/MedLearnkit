import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UserDropdown } from "@/components/UserDropdown";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  StatsOverview,
  DailyPracticeChart,
  CalendarHeatmap,
  SubjectPieChart,
  DateRangeSelector,
} from "@/components/stats";
import { statsApi } from "@/lib/api";
import type {
  PracticeSummary,
  DailyPracticeStats,
  SubjectPracticeStats,
  CalendarDayData,
} from "@/lib/types";

export function StatsPage() {
  const navigate = useNavigate();
  const [days, setDays] = useState(30);
  const [summary, setSummary] = useState<PracticeSummary | null>(null);
  const [dailyStats, setDailyStats] = useState<DailyPracticeStats[]>([]);
  const [subjectStats, setSubjectStats] = useState<SubjectPracticeStats[]>([]);
  const [calendarData, setCalendarData] = useState<CalendarDayData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const currentYear = new Date().getFullYear();

  const fetchData = useCallback(
    async (d: number) => {
      setLoading(true);
      setError(null);
      try {
        const [summaryRes, dailyRes, subjectRes, calendarRes] =
          await Promise.all([
            statsApi.getSummary(d),
            statsApi.getDailyStats(d),
            statsApi.getSubjectStats(d),
            statsApi.getCalendar(currentYear),
          ]);
        setSummary(summaryRes);
        setDailyStats(dailyRes);
        setSubjectStats(subjectRes);
        setCalendarData(calendarRes);
      } catch (e) {
        setError(e instanceof Error ? e.message : "加载统计数据失败");
      } finally {
        setLoading(false);
      }
    },
    [currentYear],
  );

  useEffect(() => {
    fetchData(days);
  }, [days, fetchData]);

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
            <h1 className="text-xl font-bold">练习统计</h1>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <UserDropdown />
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-4xl space-y-3 sm:space-y-4 p-3 sm:p-4">
          {/* Date range selector */}
          <div className="flex items-center justify-between">
            <DateRangeSelector days={days} onChange={setDays} />
          </div>

          {loading ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-24 animate-pulse rounded-xl bg-muted"
                  />
                ))}
              </div>
              <div className="h-80 animate-pulse rounded-xl bg-muted" />
              <div className="h-52 animate-pulse rounded-xl bg-muted" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center gap-3 py-12">
              <p className="text-sm text-destructive">{error}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchData(days)}
              >
                重试
              </Button>
            </div>
          ) : summary && summary.total_practiced === 0 ? (
            <div className="flex flex-col items-center gap-3 py-20">
              <p className="text-muted-foreground">暂无练习记录</p>
              <Button variant="outline" onClick={() => navigate("/")}>
                去做题
              </Button>
            </div>
          ) : (
            <>
              {summary && <StatsOverview summary={summary} />}
              <DailyPracticeChart data={dailyStats} />
              <CalendarHeatmap data={calendarData} year={currentYear} />
              <SubjectPieChart data={subjectStats} />
            </>
          )}
        </div>
      </main>
    </div>
  );
}
