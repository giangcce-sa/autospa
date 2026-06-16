"use client";

import { usePathname } from "next/navigation";

export function PageWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <main key={pathname} className="page-enter flex-1 p-5 pb-24 md:pb-6 max-w-6xl mx-auto w-full">
      {children}
    </main>
  );
}
