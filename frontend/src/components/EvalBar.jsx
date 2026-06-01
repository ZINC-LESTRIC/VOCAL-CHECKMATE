/**
 * Vertical evaluation bar.
 *
 * Props:
 *  - cp: centipawns from white's perspective (positive = white advantage)
 *  - mate: mate-in-N from white's perspective (overrides cp)
 *  - orientation: which side is at the bottom of the board ("white" | "black")
 */
export default function EvalBar({ cp, mate, orientation = "white" }) {
  let whitePct = 50;
  let label = "0.0";

  if (mate != null) {
    whitePct = mate > 0 ? 100 : 0;
    label = `M${Math.abs(mate)}`;
  } else if (cp != null) {
    // squash with a smooth function, clamp to [-1000, 1000]
    const clamped = Math.max(-1000, Math.min(1000, cp));
    // map cp to advantage in pawns then to %
    const pawns = clamped / 100;
    const adv = 1 / (1 + Math.exp(-pawns / 2.5));
    whitePct = adv * 100;
    label = `${pawns >= 0 ? "+" : ""}${pawns.toFixed(1)}`;
  } else {
    label = "…";
  }

  const whiteSide = orientation === "white" ? "bottom" : "top";
  const isMate = mate != null;

  return (
    <div
      data-testid="eval-bar"
      className="relative h-full w-6 rounded-md overflow-hidden border border-white/10 bg-zinc-900"
      style={{ minHeight: "80vh" }}
    >
      <div
        className="absolute left-0 right-0 transition-all duration-300"
        style={{
          [whiteSide]: 0,
          height: `${whiteSide === "bottom" ? whitePct : 100 - whitePct}%`,
          background: isMate
            ? (mate > 0 ? "#FCD34D" : "#1f1f1f")
            : "linear-gradient(0deg, #f1efe7 0%, #e9e3cf 100%)",
        }}
      />
      <div
        className="absolute inset-x-0 flex items-center justify-center text-[10px] font-mono font-bold uppercase tracking-widest pointer-events-none"
        style={{
          top: "50%",
          transform: "translateY(-50%)",
          color: whitePct > 50 ? "#000" : "#fff",
          textShadow: whitePct > 50 ? "0 1px 0 rgba(255,255,255,0.3)" : "0 1px 2px rgba(0,0,0,0.6)",
        }}
        data-testid="eval-bar-label"
      >
        {label}
      </div>
    </div>
  );
}
