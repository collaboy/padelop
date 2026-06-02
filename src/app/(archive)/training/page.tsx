export default function TrainingPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 pt-8 pb-8">
      <h1 className="text-2xl font-bold tracking-tight mb-1">Training</h1>
      <p className="text-sm text-[var(--muted)] mb-8">Sessions, drills, and match results</p>

      {/* Drill of the Day */}
      <div className="bg-[#1c1f23] rounded-[24px] overflow-hidden border border-[#2c3038]" style={{ boxShadow: "0px 4px 20px rgba(0,0,0,0.04)" }}>
        <div className="relative h-40">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            alt="A focused padel player executing a precise overhead smash"
            className="w-full h-full object-cover"
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuDwmJ-BrAQ_7S7rouu9kF2tN6wJ7EpzZwpeOuLcxyPGhLVOxP5kEWvoyhxW9GW6-gZ4HuT6sipLgujMAPGlF9yGslIOFzLD6cXR4fx4BP-h3t3B9tpwTVeS7vi5OGKQm289x4UK1h_E8XQXIvPakDsn865BvMnH5zEQ1-3adsxQMLGj-xSuMQi2qAsdz_eIWSG0ofeZwcQQc1o0NnoWv_fg7Et6vK7f3ghGB2mXXJOC22lXoNG68ltMnFNvrl6YQzunHuqHABHJuiU"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-6">
            <span className="text-[11px] font-semibold text-white bg-[#1c1f23]/20 backdrop-blur-md px-3 py-1 rounded-full border border-white/20">
              Skill: Tactics
            </span>
          </div>
        </div>
        <div className="p-6">
          <h3 className="text-[20px] font-semibold text-[#e4e6e9] mb-1">Defensive Lob Mastery</h3>
          <p className="text-[15px] text-[#9aa0a8] mb-4">Master the depth and height to reset the point under pressure.</p>
          <button className="w-full h-12 bg-black text-white text-[13px] font-semibold rounded-xl active:scale-[0.98] transition-transform">
            Start Guided Session
          </button>
        </div>
      </div>
    </div>
  );
}
