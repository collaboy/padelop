"use client";

import { usePathname } from "next/navigation";

export default function BottomNav() {
  const pathname = usePathname();
  if (pathname === "/home8") return null;
  return null;
}
