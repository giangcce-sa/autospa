"use client";

import { useTheme } from "next-themes";
import { Sun, Moon } from "@phosphor-icons/react";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  if (!mounted) return <div className="w-8 h-8" />;

  const toggle = () => {
    document.documentElement.classList.add("theme-transitioning");
    setTheme(theme === "dark" ? "light" : "dark");
    setTimeout(() => document.documentElement.classList.remove("theme-transitioning"), 300);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      className="flex h-10 w-10 items-center justify-center rounded-md text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text)]"
      aria-label={theme === "dark" ? "Dùng giao diện sáng" : "Dùng giao diện tối"}
      data-theme-toggle
    >
      {theme === "dark" ? <Sun size={16} weight="duotone" /> : <Moon size={16} weight="duotone" />}
    </button>
  );
}
