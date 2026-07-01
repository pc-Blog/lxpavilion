"use client";
import { createContext, useContext, useEffect, useCallback, useSyncExternalStore } from "react";

const ThemeContext = createContext({ isDark: true, toggleTheme: () => {} });

function subscribe(callback: () => void) {
  window.addEventListener("theme-changed", callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener("theme-changed", callback);
    window.removeEventListener("storage", callback);
  };
}

/** 从 cookie 读取主题 (跨子域共享) */
function getCookieTheme(): string | null {
  if (typeof window === "undefined") return null;
  const m = document.cookie.match('(?:^|;)\\s*blog-theme=([^;]+)');
  return m ? decodeURIComponent(m[1]) : null;
}

function getSnapshot(): string | null {
  if (typeof window === "undefined") return null;
  // 优先读 cookie (跨子域同步)，其次 localStorage
  return getCookieTheme() || window.localStorage.getItem("blog-theme");
}

function getServerSnapshot() {
  return null;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const stored = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  // Derive isDark directly from stored snapshot to avoid SSR/hydration mismatch
  const isDark = stored === null ? true : stored !== "light";

  // Sync isDark to <html> classList on mount and on every change
  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [isDark]);

  const toggleTheme = useCallback(() => {
    const next = !isDark;
    const root = document.documentElement;
    if (next) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    window.localStorage.setItem("blog-theme", next ? "dark" : "light");
    // 写入跨子域 cookie，与 hotspot.lxpavilion.top 同步主题
    document.cookie = "blog-theme=" + (next ? "dark" : "light") +
      "; domain=.lxpavilion.top; path=/; max-age=" + (365 * 24 * 3600) + "; SameSite=Lax";
    // Force re-render by dispatching a custom event that subscribe picks up
    window.dispatchEvent(new Event("theme-changed"));
  }, [isDark]);

  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
