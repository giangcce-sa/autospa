export function PageWrapper({ children }: { children: React.ReactNode }) {
  return (
    <main id="main-content" className="mx-auto w-full max-w-[86rem] flex-1 p-4 pb-24 sm:p-7 md:pb-10 lg:px-10" tabIndex={-1}>
      {children}
    </main>
  );
}
