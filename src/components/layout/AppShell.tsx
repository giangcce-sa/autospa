"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { MobileNav } from "./MobileNav";
import { PageWrapper } from "./PageWrapper";
import { CommandPalette } from "./CommandPalette";
import { QuickCompose } from "./QuickCompose";

const AUTH_ROUTES = ["/login", "/setup"];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthPage = AUTH_ROUTES.some((r) => pathname.startsWith(r));

  if (isAuthPage) {
    return <>{children}</>;
  }

  return (
    <>
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <Header />
          <PageWrapper>{children}</PageWrapper>
        </div>
      </div>
      <MobileNav />
      <CommandPalette />
      <QuickCompose />
    </>
  );
}
