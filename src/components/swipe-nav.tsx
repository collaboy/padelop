"use client";

import { usePathname, useRouter } from "next/navigation";
import { useRef } from "react";

const NAV_ORDER = ["/", "/wellbeing", "/training", "/recovery", "/optimizer", "/profile"];

type VTDocument = Document & {
  startViewTransition: (cb: () => void) => { finished: Promise<void> };
};

export default function SwipeNav({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);

  function navigate(to: string, dir: 1 | -1) {
    const html = document.documentElement;
    html.classList.toggle("nav-forward", dir === 1);
    html.classList.toggle("nav-backward", dir === -1);
    const cleanup = () => html.classList.remove("nav-forward", "nav-backward");

    if ("startViewTransition" in document) {
      const vt = (document as VTDocument).startViewTransition(() => router.push(to));
      vt.finished.then(cleanup).catch(cleanup);
    } else {
      router.push(to);
      setTimeout(cleanup, 400);
    }
  }

  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  }

  function onTouchEnd(e: React.TouchEvent) {
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    if (Math.abs(dx) < 80 || Math.abs(dy) > Math.abs(dx)) return;

    const idx = NAV_ORDER.indexOf(pathname);
    const cur = idx === -1 ? 0 : idx;

    if (dx < 0) {
      navigate(NAV_ORDER[(cur + 1) % NAV_ORDER.length], 1);
    } else {
      navigate(NAV_ORDER[(cur - 1 + NAV_ORDER.length) % NAV_ORDER.length], -1);
    }
  }

  return (
    <div onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} style={{ minHeight: "100%" }}>
      {children}
    </div>
  );
}
