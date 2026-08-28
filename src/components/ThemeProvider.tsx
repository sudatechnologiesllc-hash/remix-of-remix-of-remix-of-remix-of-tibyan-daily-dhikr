import {
  createContext,
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export type ThemeMode = "light" | "dark" | "system";
type ResolvedTheme = "light" | "dark";

interface ThemeContextValue {
  mode: ThemeMode;
  resolved: ResolvedTheme;
  isDark: boolean;
  setMode: (mode: ThemeMode) => void;
  toggle: () => void;
}

export const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = "tibyan_theme";
const THEME_COLORS: Record<ResolvedTheme, string> = {
  light: "#faf7f2",
  dark: "#0b1310",
};

function systemPrefersDark(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function resolve(mode: ThemeMode): ResolvedTheme {
  if (mode === "system") return systemPrefersDark() ? "dark" : "light";
  return mode;
}

function applyTheme(resolved: ResolvedTheme) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", resolved === "dark");
  document.documentElement.style.colorScheme = resolved;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", THEME_COLORS[resolved]);
}

/** موّفر الوضع الليلي/النهاري المشترك لكل الشاشات. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>("system");
  const [resolved, setResolved] = useState<ResolvedTheme>("light");

  // قراءة الاختيار المحفوظ بعد الترطيب
  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY) as ThemeMode | null;
    const initial: ThemeMode =
      saved === "light" || saved === "dark" || saved === "system"
        ? saved
        : "system";
    setModeState(initial);
  }, []);

  // تطبيق الوضع + متابعة تغيّر إعداد النظام
  useEffect(() => {
    const next = resolve(mode);
    setResolved(next);
    applyTheme(next);
    window.localStorage.setItem(STORAGE_KEY, mode);

    if (mode !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      const value = media.matches ? "dark" : "light";
      setResolved(value);
      applyTheme(value);
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [mode]);

  const setMode = useCallback((next: ThemeMode) => setModeState(next), []);

  const toggle = useCallback(() => {
    setModeState((current) => (resolve(current) === "dark" ? "light" : "dark"));
  }, []);

  return (
    <ThemeContext.Provider
      value={{ mode, resolved, isDark: resolved === "dark", setMode, toggle }}
    >
      {children}
    </ThemeContext.Provider>
  );
}
