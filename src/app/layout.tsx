import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/layout/ThemeProvider";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { MobileNav } from "@/components/layout/MobileNav";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "AutoSpa - Marketing Tool",
  description: "Công cụ marketing tự động cho spa",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className={`${geistSans.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <div className="flex min-h-screen">
            <Sidebar />
            <div
              className="flex-1 flex flex-col min-w-0"
              style={{ marginLeft: "var(--sidebar-width)" }}
            >
              <Header />
              <main className="flex-1 p-5 pb-24 md:pb-6 max-w-6xl mx-auto w-full">
                {children}
              </main>
            </div>
          </div>
          <MobileNav />
        </ThemeProvider>
      </body>
    </html>
  );
}
