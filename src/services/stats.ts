export interface DailyStat {
  date: string; // YYYY-MM-DD
  count: number;
}

const STORAGE_KEY = "tibyan_daily_stats";

function isClient(): boolean {
  return typeof window !== "undefined";
}

export function getLocalDateString(date = new Date()): string {
  const tzOffset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - tzOffset).toISOString().split("T")[0]!;
}

export function loadStats(): DailyStat[] {
  if (!isClient()) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as DailyStat[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((d) => typeof d.date === "string" && typeof d.count === "number");
  } catch {
    return [];
  }
}

function saveStats(stats: DailyStat[]) {
  if (!isClient()) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
}

export function recordTaps(amount = 1): DailyStat[] {
  if (!isClient()) return [];
  const today = getLocalDateString();
  const stats = loadStats();
  const existing = stats.find((d) => d.date === today);
  if (existing) {
    existing.count += amount;
  } else {
    stats.push({ date: today, count: amount });
  }
  saveStats(stats);
  return stats;
}

function getCountForDate(stats: DailyStat[], date: string): number {
  return stats.find((d) => d.date === date)?.count ?? 0;
}

export function getTodayCount(stats: DailyStat[] = loadStats()): number {
  return getCountForDate(stats, getLocalDateString());
}

export function getWeekHistory(stats: DailyStat[] = loadStats()): DailyStat[] {
  const result: DailyStat[] = [];
  const today = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const date = getLocalDateString(d);
    result.push({ date, count: getCountForDate(stats, date) });
  }
  return result;
}

export function computeStreak(stats: DailyStat[] = loadStats()): number {
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const count = getCountForDate(stats, getLocalDateString(d));
    if (count > 0) {
      streak += 1;
    } else {
      break;
    }
  }
  return streak;
}

export function computeBestStreak(stats: DailyStat[] = loadStats()): number {
  if (stats.length === 0) return 0;
  const sorted = [...stats].sort((a, b) => a.date.localeCompare(b.date));
  let best = 0;
  let current = 1;
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1]!.date);
    const curr = new Date(sorted[i]!.date);
    const diff = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);
    if (diff === 1) {
      current += 1;
    } else {
      best = Math.max(best, current);
      current = 1;
    }
  }
  return Math.max(best, current);
}

export function getTotalRecorded(stats: DailyStat[] = loadStats()): number {
  return stats.reduce((sum, d) => sum + d.count, 0);
}

export function formatShortDate(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("ar-SA", { weekday: "short" });
}
