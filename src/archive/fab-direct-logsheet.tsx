// Archived: FAB that opens LogSheet directly (before log picker tile modal)
// Was in src/app/home8/page.tsx — lines ~1343-1353

{/* FAB */}
<button
  onClick={() => setLogSheetOpen(true)}
  className="fixed z-40 flex items-center justify-center active:scale-95 transition-transform"
  style={{ bottom: "calc(1.5rem + env(safe-area-inset-bottom))", right: "1.25rem", width: 56, height: 56, borderRadius: 28, background: doItem?.color ?? "#2653d4", boxShadow: `0 4px 16px ${doItem?.color ?? "#2653d4"}55` }}
  aria-label="Log activity"
>
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round">
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
</button>
