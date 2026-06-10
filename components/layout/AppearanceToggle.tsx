"use client";

import { useEffect, useState } from "react";

export function AppearanceToggle() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const syncTheme = () => {
      const saved = localStorage.getItem("ms-theme");
      const nextDark = saved === "dark" ? true : saved === "light" ? false : media.matches;
      setIsDark(nextDark);
      const root = document.documentElement;
      root.setAttribute("data-theme", nextDark ? "dark" : "light");
    };
    syncTheme();
    media.addEventListener("change", syncTheme);
    return () => media.removeEventListener("change", syncTheme);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-theme", isDark ? "dark" : "light");
    localStorage.setItem("ms-theme", isDark ? "dark" : "light");
  }, [isDark]);

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-semibold text-slate-500">Appearance</span>
      <button
        type="button"
        onClick={() => setIsDark((value) => !value)}
        aria-label="Toggle appearance"
        aria-pressed={isDark}
        className={`relative h-6 w-11 rounded-full border transition-colors ${
          isDark ? "border-slate-700 bg-slate-900" : "border-slate-300 bg-slate-100"
        }`}
      >
        <span
          className={`absolute top-0.5 h-4.5 w-4.5 rounded-full bg-white shadow transition-all ${
            isDark ? "left-6" : "left-1"
          }`}
        />
      </button>
    </div>
  );
}
