"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { startNavLoad } from "@/lib/nav-events";

const STORAGE_KEY = "padelop:shopping-checked";

const SECTIONS = [
  {
    category: "Proteins",
    emoji: "🥩",
    items: [
      { name: "Chicken breast",   qty: "800g — about 4 fillets" },
      { name: "Chicken thighs",   qty: "400g — 3–4 thighs" },
      { name: "Salmon fillets",   qty: "4 fillets (~600g)" },
      { name: "Sea bass",         qty: "2 fillets (~300g)" },
      { name: "Canned tuna",      qty: "3 × 145g tins" },
      { name: "Lean beef mince",  qty: "250g" },
      { name: "Eggs",             qty: "12 — 1 box" },
      { name: "Protein powder",   qty: "4–5 scoops" },
    ],
  },
  {
    category: "Carbs & Grains",
    emoji: "🌾",
    items: [
      { name: "White rice",       qty: "500g bag" },
      { name: "Brown rice",       qty: "500g bag" },
      { name: "Pasta",            qty: "500g pack" },
      { name: "Quinoa",           qty: "250g" },
      { name: "Oats",             qty: "500g" },
      { name: "Whole grain bread",qty: "1 loaf" },
      { name: "Sourdough",        qty: "½ loaf" },
      { name: "Rice noodles",     qty: "200g" },
      { name: "Whole grain wraps",qty: "1 pack of 6" },
      { name: "Couscous",         qty: "200g" },
      { name: "Granola",          qty: "400g" },
    ],
  },
  {
    category: "Vegetables",
    emoji: "🥦",
    items: [
      { name: "Spinach",          qty: "300g bag" },
      { name: "Broccoli",         qty: "2 heads (~500g)" },
      { name: "Kale",             qty: "200g bag" },
      { name: "Courgette",        qty: "2 medium" },
      { name: "Bell peppers",     qty: "4 — mixed colours" },
      { name: "Cucumber",         qty: "2" },
      { name: "Green beans",      qty: "200g" },
      { name: "Sweet potato",     qty: "4 medium (~700g)" },
      { name: "Baking potatoes",  qty: "2 large" },
      { name: "Salad leaves",     qty: "1 bag (150g)" },
      { name: "Avocado",          qty: "3" },
      { name: "Tomatoes",         qty: "6 medium" },
      { name: "Aubergine",        qty: "1" },
    ],
  },
  {
    category: "Fruit",
    emoji: "🍌",
    items: [
      { name: "Bananas",          qty: "7 — 1 a day" },
      { name: "Mixed berries",    qty: "300g (fresh or frozen)" },
      { name: "Lemon",            qty: "2" },
    ],
  },
  {
    category: "Fridge & Dairy",
    emoji: "🥛",
    items: [
      { name: "Greek yogurt",     qty: "750g tub" },
      { name: "Feta cheese",      qty: "200g block" },
      { name: "Almond butter",    qty: "1 jar (lasts weeks)" },
      { name: "Peanut butter",    qty: "1 jar (lasts weeks)" },
      { name: "Hummus",           qty: "200g tub" },
    ],
  },
  {
    category: "Pantry",
    emoji: "🫙",
    items: [
      { name: "Chickpeas",        qty: "1 × 400g tin" },
      { name: "Lentils",          qty: "1 × 400g tin or 250g dried" },
      { name: "Tinned tomatoes",  qty: "1 × 400g tin" },
      { name: "Tahini",           qty: "1 jar (lasts weeks)" },
      { name: "Olive oil",        qty: "1 bottle (pantry staple)" },
      { name: "Honey",            qty: "1 jar (pantry staple)" },
      { name: "Olives",           qty: "1 small jar (~150g)" },
      { name: "Garlic",           qty: "1 bulb" },
    ],
  },
];

type Item = { name: string; qty: string };
const ALL_ITEMS: Item[] = SECTIONS.flatMap(s => s.items);

export default function ShoppingListPage() {
  const router = useRouter();

  const [checked, setChecked] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? new Set(JSON.parse(raw)) : new Set();
    } catch { return new Set(); }
  });

  function toggle(name: string) {
    setChecked(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify([...next])); } catch {}
      return next;
    });
  }

  function clearAll() {
    setChecked(new Set());
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
  }

  const doneCount = checked.size;
  const totalCount = ALL_ITEMS.length;

  return (
    <div className="px-4 pt-6 pb-24 max-w-lg mx-auto flex flex-col gap-6">

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <button
          onClick={() => { startNavLoad(); router.back(); }}
          style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--c-bg)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--c-text)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
        <div style={{ flex: 1 }}>
          <h1 className="t-heading" style={{ color: "var(--c-text)", margin: 0 }}>Weekly Shopping List</h1>
          <p className="t-caption" style={{ color: "var(--c-hint)", margin: "2px 0 0" }}>Quantities are calibrated for one person doing 1–2 padel sessions a week, covering all the meals the app suggests across the week.</p>
        </div>
        {doneCount > 0 && (
          <button onClick={clearAll} className="t-caption" style={{ color: "var(--c-red)", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>
            Reset
          </button>
        )}
      </div>

      {/* Progress bar */}
      <div style={{ background: "var(--c-bg)", borderRadius: "var(--r-pill)", height: 6, overflow: "hidden" }}>
        <div style={{ height: "100%", borderRadius: "var(--r-pill)", background: "var(--c-blue)", width: `${(doneCount / totalCount) * 100}%`, transition: "width 0.3s ease" }} />
      </div>
      <p className="t-caption" style={{ color: "var(--c-text-dim)", marginTop: -12 }}>
        {doneCount === 0
          ? "Tap items as you add them to your basket"
          : doneCount === totalCount
          ? "All done — you're set for the week 🎉"
          : `${doneCount} of ${totalCount} items ticked`}
      </p>

      {/* Sections */}
      {SECTIONS.map(section => (
        <section key={section.category}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
            <span style={{ fontSize: 16 }}>{section.emoji}</span>
            <p className="t-label" style={{ color: "var(--c-label)", margin: 0 }}>{section.category}</p>
          </div>
          <div style={{ background: "#fff", borderRadius: "var(--r-md)", overflow: "hidden", boxShadow: "var(--shadow-soft)", border: "1px solid var(--c-border-card)" }}>
            {section.items.map((item, i) => {
              const done = checked.has(item.name);
              return (
                <button
                  key={item.name}
                  onClick={() => toggle(item.name)}
                  style={{
                    width: "100%", padding: "14px 20px",
                    display: "flex", alignItems: "center", gap: 14,
                    background: done ? "#f9fffe" : "none",
                    border: "none",
                    borderTop: i > 0 ? "1px solid #f4f4f6" : "none",
                    cursor: "pointer", textAlign: "left",
                    transition: "background 0.15s",
                  }}
                >
                  <div style={{
                    width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                    border: done ? "none" : "2px solid #d4d8dd",
                    background: done ? "var(--c-blue)" : "transparent",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    transition: "all 0.15s",
                  }}>
                    {done && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span className="t-ui" style={{ color: done ? "var(--c-hint)" : "var(--c-text)", textDecoration: done ? "line-through" : "none", transition: "color 0.15s", display: "block" }}>
                      {item.name}
                    </span>
                    <span className="t-caption" style={{ color: done ? "var(--c-disabled)" : "var(--c-hint)", transition: "color 0.15s" }}>
                      {item.qty}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      ))}

      <p className="t-caption" style={{ textAlign: "center", color: "var(--c-disabled)" }}>
        Covers all breakfast, lunch, dinner & recovery meals
      </p>

    </div>
  );
}
