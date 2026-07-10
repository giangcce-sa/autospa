"use client";

import { usePathname } from "next/navigation";

export function PageWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <main key={pathname} className="page-enter flex-1 p-4 sm:p-6 pb-24 md:pb-8 max-w-7xl mx-auto w-full">
      {children}
    </main>
  );
}
