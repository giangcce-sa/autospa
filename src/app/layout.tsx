import type { Metadata } from "next";
import { Geist, Geist_Mono, Manrope } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/layout/ThemeProvider";
import { ActivePageProvider } from "@/contexts/ActivePageContext";
import { SessionProviderWrapper } from "@/components/layout/SessionProviderWrapper";
import { AppShell } from "@/components/layout/AppShell";
import { ExperienceModeProvider } from "@/contexts/ExperienceModeContext";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const manrope = Manrope({ variable: "--font-display", subsets: ["latin", "vietnamese"], weight: ["500", "600", "700", "800"] });

export const metadata: Metadata = {
  title: {
    default: "AutoSpa — Trợ lý vận hành spa",
    template: "%s — AutoSpa",
  },
  description: "Trợ lý nội dung, khách hàng và tăng trưởng dành cho spa.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className={`${geistSans.variable} ${geistMono.variable} ${manrope.variable}`} data-scroll-behavior="smooth" suppressHydrationWarning>
      <body>
        <SessionProviderWrapper>
          <ThemeProvider>
            <ActivePageProvider>
              <ExperienceModeProvider>
                <AppShell>{children}</AppShell>
              </ExperienceModeProvider>
            </ActivePageProvider>
          </ThemeProvider>
        </SessionProviderWrapper>
      </body>
    </html>
  );
}
