"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface FbPage { id: string; pageName: string; fbPageId: string; adAccountId?: string | null; }

interface ActivePageContextValue {
  pages: FbPage[];
  selectedPageId: string;
  selectedPage: FbPage | undefined;
  setSelectedPageId: (id: string) => void;
}

const ActivePageContext = createContext<ActivePageContextValue>({
  pages: [],
  selectedPageId: "",
  selectedPage: undefined,
  setSelectedPageId: () => {},
});

export function ActivePageProvider({ children }: { children: ReactNode }) {
  const [pages, setPages] = useState<FbPage[]>([]);
  const [selectedPageId, setSelectedPageIdState] = useState("");

  useEffect(() => {
    fetch("/api/facebook-pages").then((r) => r.json()).then((res) => {
      const list: FbPage[] = res.data ?? [];
      setPages(list);
      const saved = typeof window !== "undefined" ? localStorage.getItem("activeFbPageId") : null;
      const exists = saved && list.some((p) => p.id === saved);
      setSelectedPageIdState(exists ? saved! : (list[0]?.id ?? ""));
    });
  }, []);

  const setSelectedPageId = (id: string) => {
    setSelectedPageIdState(id);
    if (typeof window !== "undefined") localStorage.setItem("activeFbPageId", id);
  };

  const selectedPage = pages.find((p) => p.id === selectedPageId);

  return (
    <ActivePageContext.Provider value={{ pages, selectedPageId, selectedPage, setSelectedPageId }}>
      {children}
    </ActivePageContext.Provider>
  );
}

export function useActivePage() {
  return useContext(ActivePageContext);
}
