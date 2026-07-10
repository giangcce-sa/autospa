"use client";

import { createContext, useContext, useEffect, useState } from "react";

export type ExperienceMode = "simple" | "advanced";

interface ExperienceModeContextValue {
  mode: ExperienceMode;
  setMode: (mode: ExperienceMode) => void;
}

const STORAGE_KEY = "autospa-experience-mode";
const ExperienceModeContext = createContext<ExperienceModeContextValue | null>(null);

export function ExperienceModeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ExperienceMode>("simple");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "advanced") setModeState("advanced");
    } catch {
      // Local storage can be unavailable in private browsing contexts.
    }
  }, []);

  const setMode = (next: ExperienceMode) => {
    setModeState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Keep the in-memory preference when persistence is unavailable.
    }
  };

  return (
    <ExperienceModeContext.Provider value={{ mode, setMode }}>
      {children}
    </ExperienceModeContext.Provider>
  );
}

export function useExperienceMode() {
  const value = useContext(ExperienceModeContext);
  if (!value) throw new Error("useExperienceMode must be used inside ExperienceModeProvider");
  return value;
}
