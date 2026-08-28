import { useContext } from "react";
import { ThemeContext } from "@/components/ThemeProvider";

export type { ThemeMode } from "@/components/ThemeProvider";

/** يقرأ/يُبدّل الوضع الليلي/النهاري من الحالة المشتركة عبر كل الشاشات. */
export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return ctx;
}
