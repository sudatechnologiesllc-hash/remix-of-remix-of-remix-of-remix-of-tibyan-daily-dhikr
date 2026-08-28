import { useEffect, useState } from "react";
import { AppFooter } from "@/components/AppFooter";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  type DailyStat,
  computeBestStreak,
  computeStreak,
  formatShortDate,
  getLocalDateString,
  getTodayCount,
  getTotalRecorded,
  getWeekHistory,
  loadStats,
} from "@/services/stats";
import { Flame, Calendar, Target, Trophy, TrendingUp } from "lucide-react";

export function StatsScreen() {
  const [stats, setStats] = useState<DailyStat[]>([]);

  useEffect(() => {
    setStats(loadStats());
  }, []);

  const week = getWeekHistory(stats);
  const todayCount = getTodayCount(stats);
  const streak = computeStreak(stats);
  const bestStreak = computeBestStreak(stats);
  const totalRecorded = getTotalRecorded(stats);
  const maxWeekCount = Math.max(1, ...week.map((d) => d.count));

  return (
    <div className="app-screen px-safe pb-app mx-auto max-w-lg pt-12">
      <div className="mb-2 flex justify-end">
        <ThemeToggle />
      </div>
      <header className="mb-8 text-center">
        <h1 className="font-amiri text-3xl text-tibyan-green-600 dark:text-tibyan-green-emerald">
          إحْصَائِيَاتُ الذِّكْر
        </h1>
        <p className="mt-2 text-xs text-tibyan-subtle-light dark:text-tibyan-subtle-dark">
          تتبّع مداوَمتك اليومية على الصلاة على النبي ﷺ
        </p>
      </header>

      <section className="mb-4 grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-tibyan-border-light bg-tibyan-surface-light p-4 shadow-tactile dark:border-tibyan-border-dark dark:bg-tibyan-surface-dark dark:shadow-tactile-dark">
          <div className="mb-2 flex items-center gap-2 text-tibyan-gold">
            <Target className="h-4 w-4" />
            <span className="text-[11px] font-semibold">اليوم</span>
          </div>
          <p className="font-sans text-3xl font-light text-tibyan-ink-light dark:text-tibyan-ink-dark">
            {todayCount}
          </p>
          <p className="text-[10px] text-tibyan-subtle-light dark:text-tibyan-subtle-dark">صلاة على النبي ﷺ</p>
        </div>

        <div className="rounded-2xl border border-tibyan-border-light bg-tibyan-surface-light p-4 shadow-tactile dark:border-tibyan-border-dark dark:bg-tibyan-surface-dark dark:shadow-tactile-dark">
          <div className="mb-2 flex items-center gap-2 text-tibyan-green-600 dark:text-tibyan-green-emerald">
            <Flame className="h-4 w-4" />
            <span className="text-[11px] font-semibold">السلسلة الحالية</span>
          </div>
          <p className="font-sans text-3xl font-light text-tibyan-ink-light dark:text-tibyan-ink-dark">{streak}</p>
          <p className="text-[10px] text-tibyan-subtle-light dark:text-tibyan-subtle-dark">أيام متتالية</p>
        </div>

        <div className="rounded-2xl border border-tibyan-border-light bg-tibyan-surface-light p-4 shadow-tactile dark:border-tibyan-border-dark dark:bg-tibyan-surface-dark dark:shadow-tactile-dark">
          <div className="mb-2 flex items-center gap-2 text-tibyan-subtle-light dark:text-tibyan-subtle-dark">
            <Trophy className="h-4 w-4" />
            <span className="text-[11px] font-semibold">أفضل سلسلة</span>
          </div>
          <p className="font-sans text-3xl font-light text-tibyan-ink-light dark:text-tibyan-ink-dark">{bestStreak}</p>
          <p className="text-[10px] text-tibyan-subtle-light dark:text-tibyan-subtle-dark">أيام متتالية</p>
        </div>

        <div className="rounded-2xl border border-tibyan-border-light bg-tibyan-surface-light p-4 shadow-tactile dark:border-tibyan-border-dark dark:bg-tibyan-surface-dark dark:shadow-tactile-dark">
          <div className="mb-2 flex items-center gap-2 text-tibyan-subtle-light dark:text-tibyan-subtle-dark">
            <TrendingUp className="h-4 w-4" />
            <span className="text-[11px] font-semibold">المجموع الكلي</span>
          </div>
          <p className="font-sans text-3xl font-light text-tibyan-ink-light dark:text-tibyan-ink-dark">
            {totalRecorded}
          </p>
          <p className="text-[10px] text-tibyan-subtle-light dark:text-tibyan-subtle-dark">منذ بدء التتبع</p>
        </div>
      </section>

      <section className="mb-4 rounded-2xl border border-tibyan-border-light bg-tibyan-surface-light p-5 shadow-tactile dark:border-tibyan-border-dark dark:bg-tibyan-surface-dark dark:shadow-tactile-dark">
        <div className="mb-5 flex items-center gap-2 text-xs font-semibold text-tibyan-subtle-light dark:text-tibyan-subtle-dark">
          <Calendar className="h-3.5 w-3.5" />
          آخر 7 أيام
        </div>

        <div className="flex items-end justify-between gap-2">
          {week.map((day) => {
            const height = Math.max(8, (day.count / maxWeekCount) * 100);
            const isToday = day.date === getLocalDateString();
            return (
              <div key={day.date} className="flex flex-1 flex-col items-center gap-2">
                <div className="relative flex w-full justify-center" style={{ height: "6rem" }}>
                  <div
                    className={`w-full max-w-[1.25rem] rounded-t-md transition-all ${
                      isToday
                        ? "bg-tibyan-green-600 dark:bg-tibyan-green-emerald"
                        : day.count > 0
                          ? "bg-tibyan-gold/80"
                          : "bg-tibyan-border-light dark:bg-tibyan-border-dark"
                    }`}
                    style={{ height: `${height}%`, minHeight: day.count > 0 ? "12%" : "8px" }}
                  />
                </div>
                <span className="text-[10px] text-tibyan-subtle-light dark:text-tibyan-subtle-dark">
                  {formatShortDate(day.date)}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      <p className="mt-2 text-center text-[10px] leading-relaxed text-tibyan-subtle-light/80 dark:text-tibyan-subtle-dark/80">
        تُحفظ الإحصائيات محلياً في جهازك وتعمل دون اتصال بالإنترنت.
      </p>

      <AppFooter />
    </div>
  );
}
