"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good Morning";
  if (h < 18) return "Good Afternoon";
  return "Good Evening";
}

function matchLabel(date: string, time: string): string {
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 864e5).toISOString().slice(0, 10);
  const day = date === today ? "Today" : date === tomorrow ? "Tomorrow" : date;
  return `Match ${day} at ${time}`;
}

const S: React.CSSProperties = {
  fontFamily: "Menlo, Monaco, 'Courier New', monospace",
  fontSize: 16,
  fontWeight: 300,
  color: "#111",
  lineHeight: 1.5,
};

const fieldS: React.CSSProperties = {
  fontFamily: "Menlo, Monaco, 'Courier New', monospace",
  fontSize: 14,
  fontWeight: 300,
  color: "#111",
  border: "1px solid #ddd",
  borderRadius: 8,
  padding: "8px 10px",
  width: "100%",
  background: "#fafafa",
  boxSizing: "border-box",
  outline: "none",
};

const labelS: React.CSSProperties = {
  fontFamily: "Menlo, Monaco, 'Courier New', monospace",
  fontSize: 11,
  fontWeight: 300,
  color: "#888",
  display: "block",
  marginBottom: 4,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
};

type Step = "pick" | "upload" | "form";

export default function Home4() {
  const [done, setDone] = useState(false);
  const [match, setMatch] = useState<{ date: string; time: string } | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [step, setStep] = useState<Step>("pick");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [form, setForm] = useState({ date: "", time: "", venue: "", player1: "", player2: "", player3: "", player4: "" });
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("padelop:next-match");
      if (raw) {
        const m = JSON.parse(raw);
        if (m.date && m.time) {
          const matchMs = new Date(`${m.date}T${m.time}`).getTime();
          if (matchMs > Date.now()) setMatch({ date: m.date, time: m.time });
        }
      }
    } catch {}
  }, []);

  function saveMatch() {
    if (!form.date || !form.time) return;
    const data = {
      date: form.date, time: form.time,
      club: form.venue,
      player_1: form.player1, player_2: form.player2,
      player_3: form.player3, player_4: form.player4,
    };
    localStorage.setItem("padelop:next-match", JSON.stringify(data));
    window.dispatchEvent(new Event("storage"));
    setMatch({ date: form.date, time: form.time });
    closeModal();
  }

  function closeModal() {
    setAddOpen(false);
    setStep("pick");
    setUploading(false);
    setUploadError(null);
    setForm({ date: "", time: "", venue: "", player1: "", player2: "", player3: "", player4: "" });
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    if (file.size > 4 * 1024 * 1024) { setUploadError("Image too large (max 4 MB)."); return; }
    setUploadError(null);
    setUploading(true);
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = (reader.result as string).split(",")[1];
      try {
        const res = await fetch("/api/extract-match", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: base64, mediaType: file.type }),
        });
        const data = await res.json();
        if (data.error) { setUploadError(data.message || "Couldn't read screenshot."); setUploading(false); return; }
        setForm({
          date: data.date ?? "", time: data.time ?? "", venue: data.club ?? "",
          player1: data.player_1 ?? "", player2: data.player_2 ?? "",
          player3: data.player_3 ?? "", player4: data.player_4 ?? "",
        });
        setStep("form");
        setUploading(false);
      } catch { setUploadError("Network error. Try again."); setUploading(false); }
    };
    reader.readAsDataURL(file);
  }

  return (
    <main style={{ ...S, padding: "40px 28px", minHeight: "100vh", background: "#f9f9f9", fontWeight: 300 }}>

      <p style={{ margin: "0 0 24px" }}>{greeting()} Eddie</p>

      {match ? (
        <p style={{ margin: "0 0 32px" }}>{matchLabel(match.date, match.time)}</p>
      ) : (
        <div style={{ margin: "0 0 32px", display: "flex", alignItems: "baseline", gap: 8 }}>
          <p style={{ margin: 0 }}>Next Match:</p>
          <button onClick={() => setAddOpen(true)} style={{ ...S, background: "none", border: "none", padding: 0, cursor: "pointer" }}>
            + Add a match
          </button>
        </div>
      )}

      <hr style={{ width: 160, margin: "0 0 32px", border: "none", borderTop: "1.5px solid #111" }} />

      <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "0 0 24px" }}>
        <div className="w-2 h-2 rounded-full animate-breathe flex-shrink-0" style={{ background: "#f59e0b", ["--glow" as string]: "#f59e0b" }} />
        <p style={{ margin: 0 }}>DO THIS NOW</p>
      </div>
      <p style={{ margin: "0 0 24px" }}>Drink 500ml water</p>
      <button onClick={() => setDone(d => !d)} style={{ ...S, background: "none", border: "none", padding: 0, cursor: "pointer", margin: "0 0 32px", display: "block" }}>
        {done ? "[✓ Done]" : "[Done]"}
      </button>

      <hr style={{ width: 160, margin: "0 0 32px", border: "none", borderTop: "1.5px solid #111" }} />

      <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
        <Link href="/insights2a" style={{ ...S, textDecoration: "none", display: "block", marginBottom: 4 }}>View Insights</Link>
        <Link href="/track2a" style={{ ...S, textDecoration: "none", display: "block", marginBottom: 4 }}>Track Something</Link>
        <Link href="/matches2a" style={{ ...S, textDecoration: "none", display: "block" }}>Upcoming Matches</Link>
      </div>

      {/* Add Match modal */}
      {addOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center px-5" style={{ background: "rgba(0,0,0,0.45)" }} onClick={closeModal}>
          <div style={{ background: "#fff", borderRadius: 20, width: "100%", maxWidth: 420, maxHeight: "88vh", overflowY: "auto" }} onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div style={{ padding: "22px 22px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <p style={{ ...S, fontSize: 17 }}>Add a match</p>
              <button onClick={closeModal} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            <div style={{ padding: "18px 22px 24px" }}>

              {/* Step 1: pick method */}
              {step === "pick" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <button
                    onClick={() => setStep("upload")}
                    style={{ ...S, fontSize: 14, background: "#f4f4f4", border: "none", borderRadius: 12, padding: "14px 16px", cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 12 }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21,15 16,10 5,21"/></svg>
                    <div>
                      <div style={{ fontWeight: 400 }}>Upload screenshot</div>
                      <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>Booking confirmation or chat — autofilled</div>
                    </div>
                  </button>
                  <button
                    onClick={() => setStep("form")}
                    style={{ ...S, fontSize: 14, background: "#f4f4f4", border: "none", borderRadius: 12, padding: "14px 16px", cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 12 }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
                    <div>
                      <div style={{ fontWeight: 400 }}>Enter manually</div>
                      <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>Date, time, venue, players</div>
                    </div>
                  </button>
                </div>
              )}

              {/* Step 2: upload */}
              {step === "upload" && (
                <div>
                  {uploading ? (
                    <div style={{ textAlign: "center", padding: "40px 0" }}>
                      <p style={{ ...S, fontSize: 14, color: "#888" }}>Analysing screenshot…</p>
                    </div>
                  ) : (
                    <>
                      <label style={{ display: "block", border: "2px dashed #ddd", borderRadius: 14, padding: "36px 20px", textAlign: "center", cursor: "pointer" }}>
                        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: "none" }} onChange={handleFile} />
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#aaa" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: "0 auto 10px" }}><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21,15 16,10 5,21"/></svg>
                        <p style={{ ...S, fontSize: 14, color: "#555" }}>Choose screenshot</p>
                        <p style={{ ...S, fontSize: 12, color: "#aaa", marginTop: 4 }}>Booking confirmation or WhatsApp</p>
                      </label>
                      {uploadError && <p style={{ ...S, fontSize: 13, color: "#dc2626", marginTop: 10 }}>{uploadError}</p>}
                      <button onClick={() => setStep("pick")} style={{ ...S, fontSize: 13, color: "#888", background: "none", border: "none", cursor: "pointer", marginTop: 14, padding: 0 }}>← Back</button>
                    </>
                  )}
                </div>
              )}

              {/* Step 3: form (manual or autofilled) */}
              {step === "form" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <div style={{ display: "flex", gap: 10 }}>
                    <div style={{ flex: 1 }}>
                      <label style={labelS}>Date</label>
                      <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} style={fieldS} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={labelS}>Time</label>
                      <input type="time" value={form.time} onChange={e => setForm(f => ({ ...f, time: e.target.value }))} style={fieldS} />
                    </div>
                  </div>
                  <div>
                    <label style={labelS}>Venue</label>
                    <input type="text" value={form.venue} placeholder="Club / court" onChange={e => setForm(f => ({ ...f, venue: e.target.value }))} style={fieldS} />
                  </div>
                  <div>
                    <label style={labelS}>Players</label>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {(["player1","player2","player3","player4"] as const).map((k, i) => (
                        <input key={k} type="text" value={form[k]} placeholder={i === 0 ? "You" : `Player ${i + 1}`} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} style={fieldS} />
                      ))}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                    <button onClick={() => setStep("pick")} style={{ ...S, flex: 1, fontSize: 14, padding: "10px 0", border: "1px solid #ddd", borderRadius: 10, cursor: "pointer", background: "#fff" }}>Back</button>
                    <button onClick={saveMatch} style={{ ...S, flex: 2, fontSize: 14, padding: "10px 0", border: "none", borderRadius: 10, cursor: "pointer", background: "#111", color: "#fff" }}>Save match</button>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      )}

    </main>
  );
}
