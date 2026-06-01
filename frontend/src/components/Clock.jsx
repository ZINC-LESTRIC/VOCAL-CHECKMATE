import { formatTime } from "@/lib/useClock";

export default function Clock({ seconds, active, label, enabled = true }) {
  if (!enabled) return null;
  const low = seconds <= 15;
  return (
    <div
      className={`glass rounded-2xl px-5 py-4 transition-all ${
        active ? "border-[#FCD34D]/70 shadow-[0_0_30px_rgba(212,175,55,0.18)]" : "opacity-70"
      }`}
    >
      <div className="text-[10px] uppercase tracking-[0.3em] text-zinc-400">{label}</div>
      <div
        data-testid={`clock-${label?.toLowerCase()}`}
        className={`font-mono text-3xl sm:text-4xl mt-1 tabular-nums ${low ? "text-red-400" : "text-white"}`}
      >
        {formatTime(seconds)}
      </div>
    </div>
  );
}
