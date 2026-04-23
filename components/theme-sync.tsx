"use client";

import { useEffect } from "react";
import { useThemeStore } from "@/lib/stores/theme-store";

export function ThemeSync() {
  const theme = useThemeStore((s) => s.theme);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
  }, [theme]);

  return null;
}
