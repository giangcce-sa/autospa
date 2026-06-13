"use client";

import { useTheme } from "next-themes";
import { Sun, Moon } from "@phosphor-icons/react";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  if (!mounted) return <div className="w-8 h-8" />;

  return (
    <button
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors duration-200 hover:bg-[var(--bg-subtle)] text-[var(--text-secondary)] hover:text-[var(--text)]"
      title="Đổi giao diện"
    >
      {theme === "dark" ? <Sun size={16} weight="duotone" /> : <Moon size={16} weight="duotone" />}
    </button>
  );
}
