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
        {/* iOS launch screens — shown natively while the app cold-starts, before any of our JS runs */}
        <link rel="apple-touch-startup-image" href="/splash/splash-750x1334.png" media="(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" />
        <link rel="apple-touch-startup-image" href="/splash/splash-1125x2436.png" media="(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" />
        <link rel="apple-touch-startup-image" href="/splash/splash-828x1792.png" media="(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" />
        <link rel="apple-touch-startup-image" href="/splash/splash-1242x2688.png" media="(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" />
        <link rel="apple-touch-startup-image" href="/splash/splash-1170x2532.png" media="(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" />
        <link rel="apple-touch-startup-image" href="/splash/splash-1284x2778.png" media="(device-width: 428px) and (device-height: 926px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" />
        <link rel="apple-touch-startup-image" href="/splash/splash-1179x2556.png" media="(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" />
        <link rel="apple-touch-startup-image" href="/splash/splash-1290x2796.png" media="(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" />
        <link rel="apple-touch-startup-image" href="/splash/splash-1206x2622.png" media="(device-width: 402px) and (device-height: 874px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" />
        <link rel="apple-touch-startup-image" href="/splash/splash-1320x2868.png" media="(device-width: 440px) and (device-height: 956px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" />
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
