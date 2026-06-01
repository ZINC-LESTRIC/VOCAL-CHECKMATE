import { PLAY } from "@/constants/testIds";

export default function MoveList({ moves }) {
  const rows = [];
  for (let i = 0; i < moves.length; i += 2) {
    rows.push({ n: i / 2 + 1, w: moves[i], b: moves[i + 1] });
  }
  return (
    <div className="glass rounded-2xl p-4 h-full overflow-hidden flex flex-col">
      <div className="text-xs uppercase tracking-[0.3em] text-zinc-400 mb-3 font-mono">Move List</div>
      <div data-testid={PLAY.moveList} className="font-mono text-sm overflow-y-auto pr-1 flex-1">
        {rows.length === 0 && <div className="text-zinc-500 italic">No moves yet</div>}
        {rows.map((r) => (
          <div key={r.n} className="grid grid-cols-12 gap-1 py-1 border-b border-white/5">
            <div className="col-span-2 text-zinc-500">{r.n}.</div>
            <div className="col-span-5 text-white">{r.w}</div>
            <div className="col-span-5 text-zinc-300">{r.b || ""}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
