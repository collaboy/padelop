import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { Hanken_Grotesk } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import SwipeNav from "@/components/swipe-nav";
import WeekPlanModal from "@/components/week-plan-modal";
import NavLoader from "@/components/nav-loader";
import PlusOne from "@/components/plus-one";

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
        {/* Instant, JS-free loading indicator — paints on first frame, before the
            page's own client bundle downloads/hydrates, so there's never a blank
            white flash. Any real page content (opaque bg, higher z-index) covers it. */}
        <div style={{ position: "fixed", inset: 0, zIndex: -1, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <style>{`@keyframes root-spin { to { transform: rotate(360deg); } }`}</style>
          <div style={{ width: 36, height: 36, borderRadius: "50%", border: "3px solid rgba(0,160,60,0.2)", borderTopColor: "#00A83C", animation: "root-spin 0.8s linear infinite" }} />
        </div>
        <div className="hidden min-[481px]:flex fixed inset-0 z-[9999] bg-white items-center justify-center flex-col gap-4 text-center px-8">
          <div style={{ fontSize: 48 }}>📱</div>
          <p style={{ fontSize: 22, fontWeight: 700, color: "#1a1c1c" }}>Open on your phone</p>
          <p style={{ fontSize: 15, color: "#6b7480", lineHeight: 1.6 }}>padla is designed for mobile.<br />Scan the QR code or visit on your phone.</p>
        </div>
        <div className="mx-auto w-full max-w-[480px] flex flex-col min-h-full">
          <SwipeNav>
            <main className="vt-page-content flex-1">
              {children}
            </main>
          </SwipeNav>
          <NavLoader />
          <PlusOne />
          <WeekPlanModal />
          <Analytics />
        </div>
      </body>
    </html>
  );
}
