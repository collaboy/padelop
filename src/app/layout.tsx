import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { Hanken_Grotesk } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import Nav from "@/components/nav";
import BottomNav from "@/components/bottom-nav";
import SwipeNav from "@/components/swipe-nav";
import WeekPlanModal from "@/components/week-plan-modal";
import Fab from "@/components/fab";

const geist = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const hanken = Hanken_Grotesk({ variable: "--font-hanken", subsets: ["latin"], weight: ["400", "500", "600", "700"] });

export const metadata: Metadata = {
  title: "padla",
  description: "Padel performance tracker — fitness, match prep, and growth",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "padla",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geist.variable} ${hanken.variable} h-full`}>
      <head>
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta name="theme-color" content="#2653d4" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
      </head>
      <body className="flex flex-col min-h-full bg-[var(--bg)]" suppressHydrationWarning>
        <Nav />
        <SwipeNav>
          <main className="vt-page-content flex-1 pt-16 pb-24">
            <div className="mx-auto w-full max-w-[640px]">{children}</div>
          </main>
        </SwipeNav>
        <BottomNav />
        <Fab />
        <WeekPlanModal />
        <Analytics />
      </body>
    </html>
  );
}
