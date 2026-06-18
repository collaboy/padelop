"use client";

import React, { useState, useRef } from "react";

const WARMUP_CUES: { from: number; text: string }[] = [
  { from: 0,     text: "take a breath if you're listening to this" },
  { from: 2.4,   text: "chances are your match is about 10 or 15 minutes away" },
  { from: 5.7,   text: "and right now whether you realize it or not" },
  { from: 8.4,   text: "your brain is already playing padel" },
  { from: 10.4,  text: "it's thinking about opponents" },
  { from: 12.1,  text: "it's remembering the last match" },
  { from: 13.8,  text: "it's replaying mistakes" },
  { from: 15.1,  text: "it's imagining great points that haven't happened yet" },
  { from: 17.9,  text: "the funny thing is" },
  { from: 18.8,  text: "that the actual match hasn't even started" },
  { from: 21.3,  text: "you're still in the car and that's where we'll begin" },
  { from: 24.0,  text: "because one of the most useful skills in padel" },
  { from: 26.2,  text: "has nothing to do with technique" },
  { from: 28.0,  text: "it's the ability to arrive mentally" },
  { from: 29.9,  text: "where your feet already are" },
  { from: 31.4,  text: "right now you're not playing a match" },
  { from: 33.2,  text: "you're driving to one" },
  { from: 34.5,  text: "so let the future stay in the future" },
  { from: 36.3,  text: "for a few more minutes let's do a quick check" },
  { from: 38.9,  text: "how's your hydration nothing fancy here" },
  { from: 41.5,  text: "if you've brought water good" },
  { from: 43.4,  text: "if you have electrolytes that you normally use fine" },
  { from: 46.2,  text: "if not that's fine too" },
  { from: 47.6,  text: "the goal isn't perfection" },
  { from: 49.2,  text: "the goal is simply not showing up dehydrated" },
  { from: 51.8,  text: "hydration isn't about gaining an advantage" },
  { from: 54.1,  text: "it's about avoiding an unnecessary disadvantage simple" },
  { from: 57.6,  text: "now let's talk about expectations" },
  { from: 59.8,  text: "many players arrive at the court" },
  { from: 61.4,  text: "carrying invisible luggage" },
  { from: 63.2,  text: "maybe it's their ranking maybe it's their partner" },
  { from: 65.8,  text: "maybe it's a previous loss" },
  { from: 67.4,  text: "maybe it's the belief that they should win" },
  { from: 69.4,  text: "but Padel doesn't care the court doesn't care" },
  { from: 72.0,  text: "the glass doesn't care the ball certainly doesn't care" },
  { from: 75.3,  text: "the match begins at 0 zero" },
  { from: 77.1,  text: "every single time" },
  { from: 78.5,  text: "and that's one of the most beautiful things about sport" },
  { from: 81.3,  text: "nobody owes you anything everything starts fresh" },
  { from: 83.8,  text: "now let's talk tactics not complicated tactics" },
  { from: 86.7,  text: "just useful reminders first" },
  { from: 89.1,  text: "respect the net at most club levels" },
  { from: 91.0,  text: "the team controlling the net usually controls the match" },
  { from: 93.7,  text: "that doesn't mean rushing the net recklessly" },
  { from: 96.3,  text: "it means understanding its value" },
  { from: 98.0,  text: "if you're at the back" },
  { from: 99.0,  text: "and your opponents are comfortable at the net" },
  { from: 101.4, text: "your mission isn't necessarily to hit a winner" },
  { from: 104.0, text: "your mission is often much simpler" },
  { from: 105.9, text: "create an opportunity to move forward" },
  { from: 108.2, text: "maybe that's a lob maybe it's a deep ball" },
  { from: 110.7, text: "maybe it's patience the point isn't the shot" },
  { from: 113.4, text: "the point is improving your position" },
  { from: 115.6, text: "second make your opponents earn points" },
  { from: 118.2, text: "this sounds obvious" },
  { from: 119.2, text: "but many matches are lost because players donate points" },
  { from: 122.4, text: "unforced errors low percentage winners" },
  { from: 124.8, text: "hero shots the kind of shot that looks amazing once" },
  { from: 127.5, text: "and fails four times today" },
  { from: 129.7, text: "see what happens if you make your opponents hit" },
  { from: 132.0, text: "one more ball then one more" },
  { from: 134.2, text: "then one more third" },
  { from: 136.1, text: "watch the feet if you get a comfortable ball at the net" },
  { from: 139.3, text: "remember that the feet" },
  { from: 140.1, text: "are often a better target than the corners" },
  { from: 142.5, text: "a difficult volley at someone's shoes" },
  { from: 144.4, text: "can create more problems" },
  { from: 145.9, text: "than a spectacular shot aimed at the fence" },
  { from: 148.6, text: "simple beats flashy" },
  { from: 149.8, text: "more often than most players realize" },
  { from: 151.9, text: "now let's talk about the first few games" },
  { from: 153.9, text: "the beginning of a match tells a story" },
  { from: 156.0, text: "and many players try to write the ending in Chapter 1" },
  { from: 158.8, text: "don't use the first few games to gather information" },
  { from: 161.9, text: "who likes to lob who gets nervous under pressure" },
  { from: 164.7, text: "who serves well who rushes" },
  { from: 166.6, text: "who stays calm think like an observer" },
  { from: 169.1, text: "the player who learns fastest often wins" },
  { from: 171.5, text: "and finally a reminder" },
  { from: 173.1, text: "you're going to miss shots today" },
  { from: 174.8, text: "everybody does professionals do" },
  { from: 177.2, text: "beginners do everyone in between does" },
  { from: 180.0, text: "the difference isn't who misses" },
  { from: 181.9, text: "the difference is who recovers" },
  { from: 183.7, text: "can you let one bad point stay one bad point" },
  { from: 186.2, text: "can you avoid turning one mistake into three" },
  { from: 188.6, text: "can you reset" },
  { from: 189.7, text: "because matches are rarely decided by a single error" },
  { from: 192.6, text: "they're often decided" },
  { from: 193.8, text: "by the emotional reaction that follows it" },
  { from: 196.1, text: "so as you arrive at the club" },
  { from: 197.9, text: "leave a little room for curiosity" },
  { from: 200.0, text: "see what kind of match this becomes" },
  { from: 202.0, text: "compete communicate" },
  { from: 203.7, text: "move your feet stay present" },
  { from: 205.7, text: "and when the first point begins" },
  { from: 207.4, text: "remember you don't need to play perfect padel" },
  { from: 210.4, text: "you just need to make the next good decision" },
  { from: 212.5, text: "good luck see you on court" },
];

export default function AdminPage() {
  const [playing, setPlaying] = useState(false);
  const [started, setStarted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const vizRef = useRef<HTMLCanvasElement | null>(null);
  const currentTimeRef = useRef(0);
  const durationRef = useRef(0);
  const isScrubbing = useRef(false);

  const ballSize = "min(calc(100vw - 40px), 340px)";

  const handleToggle = () => {
    if (!audioRef.current) {
      const a = new Audio("/warmup.mp3");
      audioRef.current = a;
      a.onended = () => { setPlaying(false); setCurrentTime(0); currentTimeRef.current = 0; if (rafRef.current) cancelAnimationFrame(rafRef.current); };
      a.ontimeupdate = () => { setCurrentTime(a.currentTime); currentTimeRef.current = a.currentTime; };
      a.onloadedmetadata = () => { setDuration(a.duration); durationRef.current = a.duration; };
    }
    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    } else {
      if (!audioCtxRef.current) {
        const ctx = new AudioContext();
        audioCtxRef.current = ctx;
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 64;
        analyser.smoothingTimeConstant = 0.85;
        analyserRef.current = analyser;
        const source = ctx.createMediaElementSource(audioRef.current!);
        sourceRef.current = source;
        source.connect(analyser);
        analyser.connect(ctx.destination);
      }
      audioCtxRef.current?.resume();
      audioRef.current.play();
      setPlaying(true);
      setStarted(true);
      const draw = () => {
        const canvas = vizRef.current;
        const analyser = analyserRef.current;
        if (!canvas || !analyser) { rafRef.current = requestAnimationFrame(draw); return; }
        const ctx2d = canvas.getContext("2d");
        if (!ctx2d) { rafRef.current = requestAnimationFrame(draw); return; }
        const W = canvas.offsetWidth || 300;
        const H = canvas.offsetHeight || 300;
        if (canvas.width !== W) canvas.width = W;
        if (canvas.height !== H) canvas.height = H;
        const bins = analyser.frequencyBinCount;
        const data = new Uint8Array(bins);
        analyser.getByteFrequencyData(data);
        ctx2d.clearRect(0, 0, W, H);
        const count = 28; const gap = 4;
        const barW = (W - gap * (count - 1)) / count;
        const centerY = H / 2;
        const raw: number[] = [];
        for (let i = 0; i < count; i++) raw.push(data[Math.floor(i * bins / count)] / 255);
        raw.sort((a, b) => b - a);
        const vals = new Array(count).fill(0);
        for (let i = 0; i < count; i++) {
          const offset = Math.floor(i / 2);
          if (i % 2 === 0) vals[Math.floor(count / 2) + offset] = raw[i];
          else vals[Math.floor(count / 2) - 1 - offset] = raw[i];
        }
        for (let i = 0; i < count; i++) {
          const v = vals[i];
          const halfH = Math.max(3, v * centerY * 0.9);
          ctx2d.fillStyle = `rgba(0,0,0,${0.06 + v * 0.16})`;
          ctx2d.fillRect(i * (barW + gap), centerY - halfH, barW, halfH * 2);
        }
        rafRef.current = requestAnimationFrame(draw);
      };
      draw();
    }
  };

  const cueIdx = [...WARMUP_CUES].map((_, i) => i).reverse().find(i => WARMUP_CUES[i].from <= currentTime) ?? 0;
  const cue = WARMUP_CUES[cueIdx];

  return (
    <div style={{ minHeight: "100dvh", background: "#f4f4f6", display: "flex", flexDirection: "column", alignItems: "center", padding: "40px 20px 60px" }}>
      <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#6b7480", marginBottom: 24 }}>Admin — Audio Preview</p>

      {/* Ball */}
      <div style={{ position: "relative", width: ballSize, height: ballSize, borderRadius: "50%", overflow: "hidden", background: "#00D455", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        {/* Texture */}
        <div style={{ position: "absolute", inset: 0, backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)' opacity='0.22'/%3E%3C/svg%3E")`, backgroundSize: "200px 200px", pointerEvents: "none", mixBlendMode: "overlay" }} />
        {/* Visualizer */}
        <canvas ref={vizRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block", opacity: playing ? 1 : 0, transition: "opacity 0.5s" }} />

        {/* Info state */}
        <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, opacity: playing ? 0 : 1, transition: "opacity 0.35s", pointerEvents: playing ? "none" : "auto" }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#000", letterSpacing: "0.05em" }}>Now</p>
          <p style={{ margin: 0, fontSize: "clamp(22px, 6vw, 30px)", fontWeight: 800, color: "#000", lineHeight: 1, textAlign: "center" }}>Warm Up</p>
          <button onClick={handleToggle} style={{ marginTop: 10, background: "#fff", border: "none", borderRadius: "50%", cursor: "pointer", width: 52, height: 52, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="18" height="18" viewBox="0 0 16 16" fill="none"><polygon points="3,1 15,8 3,15" fill="#1a1c1c"/></svg>
          </button>
        </div>

        {/* Playing state */}
        <div style={{ position: "absolute", inset: 0, zIndex: 2, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, opacity: playing ? 1 : 0, transition: "opacity 0.35s", pointerEvents: playing ? "auto" : "none" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <button onClick={() => { if (!audioRef.current) return; const t = Math.max(0, audioRef.current.currentTime - 10); audioRef.current.currentTime = t; setCurrentTime(t); currentTimeRef.current = t; }} style={{ background: "rgba(0,0,0,0.15)", border: "none", borderRadius: 20, cursor: "pointer", padding: "5px 12px", fontSize: 13, fontWeight: 800, color: "#000" }}>−10</button>
            <button onClick={handleToggle} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="37" height="37" viewBox="0 0 36 36" fill="none"><rect x="10" y="9" width="5" height="18" rx="2" fill="#000"/><rect x="21" y="9" width="5" height="18" rx="2" fill="#000"/></svg>
            </button>
            <button onClick={() => { if (!audioRef.current) return; const t = Math.min(durationRef.current, audioRef.current.currentTime + 10); audioRef.current.currentTime = t; setCurrentTime(t); currentTimeRef.current = t; }} style={{ background: "rgba(0,0,0,0.15)", border: "none", borderRadius: 20, cursor: "pointer", padding: "5px 12px", fontSize: 13, fontWeight: 800, color: "#000" }}>+10</button>
          </div>
          <span style={{ fontSize: 13, fontWeight: 700, color: "rgba(0,0,0,0.55)" }}>
            {String(Math.floor(currentTime / 60)).padStart(2, "0")}:{String(Math.floor(currentTime % 60)).padStart(2, "0")}
          </span>
        </div>
      </div>

      {/* Captions */}
      <div style={{ marginTop: 16, minHeight: 64, width: "100%", maxWidth: 340, display: "flex", alignItems: "center", justifyContent: "center", opacity: playing ? 1 : 0, transition: "opacity 0.4s" }}>
        <p style={{ margin: 0, fontSize: 17, fontWeight: 500, color: "#1a1c1c", textAlign: "center", lineHeight: 1.6 }}>
          {cue?.text ?? ""}
        </p>
      </div>

      {/* Scrubber */}
      <div
        style={{ marginTop: 20, width: "100%", maxWidth: 340, position: "relative", height: 24, cursor: "pointer", touchAction: "none" }}
        onPointerDown={e => { e.preventDefault(); (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId); isScrubbing.current = true; const r = e.currentTarget.getBoundingClientRect(); const t = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * durationRef.current; if (audioRef.current) audioRef.current.currentTime = t; setCurrentTime(t); currentTimeRef.current = t; }}
        onPointerMove={e => { if (!isScrubbing.current) return; const r = e.currentTarget.getBoundingClientRect(); const t = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * durationRef.current; if (audioRef.current) audioRef.current.currentTime = t; setCurrentTime(t); currentTimeRef.current = t; }}
        onPointerUp={() => { isScrubbing.current = false; }}
        onPointerCancel={() => { isScrubbing.current = false; }}
      >
        <div style={{ position: "absolute", top: "50%", left: 0, right: 0, height: 3, background: "rgba(0,0,0,0.12)", borderRadius: 2, transform: "translateY(-50%)" }} />
        {duration > 0 && <div style={{ position: "absolute", top: "50%", left: 0, width: `${(currentTime / duration) * 100}%`, height: 3, background: "#1a1c1c", borderRadius: 2, transform: "translateY(-50%)" }} />}
        <div style={{ position: "absolute", top: "50%", left: duration > 0 ? `${(currentTime / duration) * 100}%` : "0%", width: 14, height: 14, borderRadius: "50%", background: "#1a1c1c", transform: "translate(-50%, -50%)", boxShadow: "0 1px 4px rgba(0,0,0,0.2)" }} />
      </div>

      {/* Cue list */}
      <div style={{ marginTop: 40, width: "100%", maxWidth: 500 }}>
        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#6b7480", marginBottom: 12 }}>Cues</p>
        {WARMUP_CUES.map((c, i) => (
          <div key={i} onClick={() => { if (audioRef.current) { audioRef.current.currentTime = c.from; setCurrentTime(c.from); currentTimeRef.current = c.from; } }} style={{ display: "flex", gap: 12, padding: "6px 8px", borderRadius: 8, cursor: "pointer", background: i === cueIdx ? "#e8f0ff" : "transparent", transition: "background 0.2s" }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#6b7480", minWidth: 36, flexShrink: 0 }}>{String(Math.floor(c.from / 60)).padStart(2, "0")}:{String(Math.floor(c.from % 60)).padStart(2, "0")}</span>
            <span style={{ fontSize: 14, color: i === cueIdx ? "#2653d4" : "#1a1c1c", fontWeight: i === cueIdx ? 600 : 400 }}>{c.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
