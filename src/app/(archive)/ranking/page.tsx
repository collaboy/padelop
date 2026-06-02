export default function RankingPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 pt-8">
      <h1 className="text-2xl font-bold tracking-tight mb-1">Ranking</h1>
      <p className="text-sm text-[var(--muted)]">Your ELO progression</p>
      <div className="mt-8 bg-[var(--surface)] rounded-xl p-6 text-center">
        <p className="text-4xl font-bold text-[var(--green)]">1200</p>
        <p className="text-sm text-[var(--muted)] mt-1">Starting rating</p>
      </div>
    </div>
  );
}
