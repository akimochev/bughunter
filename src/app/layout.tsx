import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import "./globals.css";
import { ProgressProvider } from "@/components/progress/progress-provider";
import { missionSummaries } from "@/content/missions";

export const metadata: Metadata = {
  title: {
    default: "BugHunter — найди ошибку, прокачай Python",
    template: "%s · BugHunter",
  },
  description:
    "Детективный тренажёр по отладке Python для школьников 8–11 классов. Исследуй код, находи ошибки и учись понимать алгоритмы. Проект в разработке.",
  applicationName: "BugHunter",
  keywords: [
    "Python",
    "отладка",
    "программирование",
    "школьники",
    "тренажёр",
    "BugHunter",
  ],
  openGraph: {
    title: "BugHunter — у каждой ошибки есть след",
    description:
      "Детективные миссии по Python для 8–11 классов. Проект в разработке.",
    locale: "ru_RU",
    type: "website",
    siteName: "BugHunter",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ru">
      <body>
        <div className="site-shell">
          <a href="#main" className="skip-link">
            Перейти к содержимому
          </a>
          <ProgressProvider missions={missionSummaries}>
            <SiteHeader />
            <main id="main" tabIndex={-1}>
              {children}
            </main>
            <SiteFooter />
          </ProgressProvider>
        </div>
      </body>
    </html>
  );
}
