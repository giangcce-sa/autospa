"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { MobileNav } from "./MobileNav";
import { PageWrapper } from "./PageWrapper";
import { CommandPalette } from "./CommandPalette";
import { APP_ROUTES, routeIsActive } from "@/config/routes";

const SHELL_FREE_ROUTES = APP_ROUTES.filter((route) => route.section === "auth" || route.section === "internal");

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hasNoShell = SHELL_FREE_ROUTES.some((route) => routeIsActive(pathname, route.path));

  if (hasNoShell) {
    return <>{children}</>;
  }

  return (
    <>
      <a href="#main-content" className="fixed left-3 top-3 z-[100] -translate-y-20 rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--accent-foreground)] shadow-[var(--shadow-md)] transition-transform focus:translate-y-0">Bỏ qua đến nội dung chính</a>
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <Header />
          <PageWrapper>{children}</PageWrapper>
        </div>
      </div>
      <MobileNav />
      <CommandPalette />
    </>
  );
}
