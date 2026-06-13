"use client";

import { useState, useRef, useEffect, useCallback } from "react";

interface Props {
  imageSrc: string;
  onSave: (croppedDataUrl: string) => void;
  onClose: () => void;
}

const CROP_SIZE = 280;
const OUTPUT_SIZE = 400;

export default function AvatarCropModal({ imageSrc, onSave, onClose }: Props) {
  const imgRef = useRef<HTMLImageElement>(null);
  // Store natural dimensions in state so they're available synchronously at render time
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null);
  const [userScale, setUserScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragStart = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  const baseScale = naturalSize
    ? Math.max(CROP_SIZE / naturalSize.w, CROP_SIZE / naturalSize.h)
    : 1;
  const ts = baseScale * userScale;

  const clampOffset = useCallback(
    (ox: number, oy: number) => {
      if (!naturalSize) return { x: ox, y: oy };
      const scale = Math.max(CROP_SIZE / naturalSize.w, CROP_SIZE / naturalSize.h) * userScale;
      const maxX = Math.max(0, (naturalSize.w * scale) / 2 - CROP_SIZE / 2);
      const maxY = Math.max(0, (naturalSize.h * scale) / 2 - CROP_SIZE / 2);
      return {
        x: Math.max(-maxX, Math.min(maxX, ox)),
        y: Math.max(-maxY, Math.min(maxY, oy)),
      };
    },
    [naturalSize, userScale],
  );

  useEffect(() => {
    setOffset(o => clampOffset(o.x, o.y));
  }, [userScale, clampOffset]);

  const handlePointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStart.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
  };
  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragStart.current) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    setOffset(clampOffset(dragStart.current.ox + dx, dragStart.current.oy + dy));
  };
  const handlePointerUp = () => { dragStart.current = null; };

  const handleSave = () => {
    const img = imgRef.current;
    if (!img || !naturalSize) return;
    const sourceX = naturalSize.w / 2 - (CROP_SIZE / 2 + offset.x) / ts;
    const sourceY = naturalSize.h / 2 - (CROP_SIZE / 2 + offset.y) / ts;
    const sourceW = CROP_SIZE / ts;
    const sourceH = CROP_SIZE / ts;

    const canvas = document.createElement("canvas");
    canvas.width = OUTPUT_SIZE;
    canvas.height = OUTPUT_SIZE;
    const ctx = canvas.getContext("2d")!;
    ctx.save();
    ctx.beginPath();
    ctx.arc(OUTPUT_SIZE / 2, OUTPUT_SIZE / 2, OUTPUT_SIZE / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(img, sourceX, sourceY, sourceW, sourceH, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
    ctx.restore();
    onSave(canvas.toDataURL("image/jpeg", 0.9));
  };

  // Rendered image dimensions and position
  const imgW = naturalSize ? naturalSize.w * ts : CROP_SIZE;
  const imgH = naturalSize ? naturalSize.h * ts : CROP_SIZE;
  const imgLeft = (CROP_SIZE - imgW) / 2 + offset.x;
  const imgTop  = (CROP_SIZE - imgH) / 2 + offset.y;

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center px-5"
      style={{ paddingTop: "calc(4rem + 24px)", paddingBottom: "calc(4rem + 24px)" }}
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-sm bg-white rounded-[28px] overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-6 pt-5 pb-3 flex items-center justify-between border-b border-[#f0f0f0]">
          <p style={{ fontSize: 17, fontWeight: 700, color: "#1a1c1c", margin: 0 }}>Adjust photo</p>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center"
            style={{ background: "#f4f4f6" }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4a5050" strokeWidth="2.5" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, padding: "24px 24px 28px" }}>
          {/* Circle crop preview */}
          <div
            style={{
              width: CROP_SIZE, height: CROP_SIZE, borderRadius: "50%",
              overflow: "hidden", background: "#f0f0f0", position: "relative",
              cursor: "grab", touchAction: "none",
              boxShadow: "0 0 0 3px #e2e2e2, 0 0 0 6px rgba(38,83,212,0.12)",
              flexShrink: 0,
            }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={imgRef}
              src={imageSrc}
              alt="crop preview"
              onLoad={e => {
                const img = e.currentTarget;
                setNaturalSize({ w: img.naturalWidth, h: img.naturalHeight });
              }}
              draggable={false}
              style={{
                position: "absolute",
                width: imgW,
                height: imgH,
                left: imgLeft,
                top: imgTop,
                userSelect: "none",
                pointerEvents: "none",
              }}
            />
          </div>

          <p style={{ fontSize: 12, color: "#9aa5b0", margin: 0 }}>Drag to reposition · pinch or slide to zoom</p>

          {/* Zoom controls */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, width: "100%" }}>
            <button
              onClick={() => setUserScale(s => Math.max(1, parseFloat((s - 0.15).toFixed(2))))}
              style={{ width: 40, height: 40, borderRadius: "50%", border: "none", background: "#f4f4f6", fontSize: 22, fontWeight: 700, color: "#1a1c1c", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
            >−</button>
            <input
              type="range" min="1" max="3" step="0.01"
              value={userScale}
              onChange={e => setUserScale(parseFloat(e.target.value))}
              style={{ flex: 1, accentColor: "#2653d4" }}
            />
            <button
              onClick={() => setUserScale(s => Math.min(3, parseFloat((s + 0.15).toFixed(2))))}
              style={{ width: 40, height: 40, borderRadius: "50%", border: "none", background: "#f4f4f6", fontSize: 22, fontWeight: 700, color: "#1a1c1c", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
            >+</button>
          </div>

          {/* Action buttons */}
          <div style={{ display: "flex", gap: 12, width: "100%" }}>
            <button
              onClick={onClose}
              style={{ flex: 1, padding: "12px 0", borderRadius: 16, border: "none", background: "#f4f4f6", fontSize: 14, fontWeight: 600, color: "#1a1c1c", cursor: "pointer" }}
            >Cancel</button>
            <button
              onClick={handleSave}
              style={{ flex: 1, padding: "12px 0", borderRadius: 16, border: "none", background: "#2653d4", fontSize: 14, fontWeight: 600, color: "#fff", cursor: "pointer" }}
            >Save photo</button>
          </div>
        </div>
      </div>
    </div>
  );
}
