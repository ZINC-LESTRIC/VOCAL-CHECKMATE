import { TIME_CONTROLS, UNLIMITED } from "@/lib/useClock";

export default function TimeControlPicker({ value, onChange }) {
  const all = [...TIME_CONTROLS, UNLIMITED];
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs uppercase tracking-[0.3em] text-zinc-400 mr-2">Time</span>
      {all.map((tc) => {
        const selected = (value?.label || "∞") === tc.label;
        return (
          <button
            key={tc.label}
            type="button"
            data-testid={`time-control-${tc.label}`}
            onClick={() => onChange(tc.label === "∞" ? null : tc)}
            className={`px-3 py-2 rounded-full text-xs uppercase tracking-widest border font-mono ${
              selected
                ? "border-[#FCD34D] text-[#FCD34D] bg-[#FCD34D]/10"
                : "border-white/10 text-zinc-400 hover:border-white/30"
            }`}
          >
            {tc.label}
          </button>
        );
      })}
    </div>
  );
}
