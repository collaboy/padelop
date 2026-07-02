"use client";

import { useRouter } from "next/navigation";
import LogSheet from "@/components/log-sheet";

export default function CheckinPreview() {
  const router = useRouter();
  return (
    <>
      <div style={{ minHeight: "100dvh", background: "#f2f3f5", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ fontSize: 14, color: "#8a9096", fontWeight: 500 }}>Preview mode — no data is saved</p>
      </div>
      <LogSheet
        open={true}
        onClose={() => router.push("/home8")}
        defaultSub="checkin"
        previewMode={true}
      />
    </>
  );
}
