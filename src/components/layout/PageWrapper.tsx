"use client";

import { usePathname } from "next/navigation";

export function PageWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <main key={pathname} className="page-enter mx-auto w-full max-w-[86rem] flex-1 p-4 pb-24 sm:p-7 md:pb-10 lg:px-10">
      {children}
    </main>
  );
}
