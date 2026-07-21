"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useSession } from "next-auth/react";

interface AdsReadiness {
  status: string;
  error: string | null;
  checkedAt: string | null;
  currency: string | null;
}

interface FbPage {
  id: string;
  pageName: string;
  fbPageId: string;
  adAccountId?: string | null;
  adsReadiness?: AdsReadiness;
}

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
  const { status } = useSession();
  const [pages, setPages] = useState<FbPage[]>([]);
  const [selectedPageId, setSelectedPageIdState] = useState("");

  useEffect(() => {
    if (status !== "authenticated") {
      setPages([]);
      setSelectedPageIdState("");
      return;
    }

    fetch("/api/facebook-pages").then((r) => r.ok ? r.json() : { data: [] }).then((res) => {
      const list: FbPage[] = res.data ?? [];
      setPages(list);
      const saved = typeof window !== "undefined" ? localStorage.getItem("activeFbPageId") : null;
      const exists = saved && list.some((p) => p.id === saved);
      setSelectedPageIdState(exists ? saved! : (list[0]?.id ?? ""));
    }).catch(() => {
      setPages([]);
      setSelectedPageIdState("");
    });
  }, [status]);

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
