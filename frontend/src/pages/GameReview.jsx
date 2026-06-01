import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Chess } from "chess.js";
import BoardView from "@/components/BoardView";
import EvalBar from "@/components/EvalBar";
import { api } from "@/lib/api";
import { StockfishAnalyzer } from "@/lib/stockfish";
import { REVIEW } from "@/constants/testIds";
import {
  CaretDoubleLeft, CaretDoubleRight, CaretLeft, CaretRight, ArrowLeft,
} from "@phosphor-icons/react";

function buildPositions(pgn) {
  const c = new Chess();
  const fens = [c.fen()];
  const sans = [];
  if (pgn) {
    try {
      c.loadPgn(pgn);
    } catch (e) { /* ignore */ }
  }
  const verbose = c.history({ verbose: true });
  const replay = new Chess();
  for (const mv of verbose) {
    replay.move(mv);
    fens.push(replay.fen());
    sans.push(mv.san);
  }
  return { fens, sans };
}

export default function GameReview() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [game, setGame] = useState(null);
  const [error, setError] = useState("");
  const [index, setIndex] = useState(0);
  const [evalScore, setEvalScore] = useState({ cp: 0, mate: null });
  const [analyzing, setAnalyzing] = useState(false);
  const analyzerRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    api.get(`/games/${id}`)
      .then((r) => { if (!cancelled) setGame(r.data); })
      .catch(() => setError("Game not found"));
    return () => { cancelled = true; };
  }, [id]);

  const { fens, sans } = useMemo(
    () => (game ? buildPositions(game.pgn || "") : { fens: [new Chess().fen()], sans: [] }),
    [game],
  );

  // Init analyzer once
  useEffect(() => {
    const a = new StockfishAnalyzer();
    analyzerRef.current = a;
    return () => a.destroy();
  }, []);

  // Re-evaluate whenever index changes
  useEffect(() => {
    const a = analyzerRef.current;
    if (!a || !fens[index]) return;
    let cancelled = false;
    setAnalyzing(true);
    a.evaluate(fens[index], 14).then((r) => {
      if (cancelled) return;
      setEvalScore({ cp: r.cp, mate: r.mate });
      setAnalyzing(false);
    });
    return () => { cancelled = true; };
  }, [index, fens]);

  // Keyboard nav
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "ArrowLeft") setIndex((i) => Math.max(0, i - 1));
      else if (e.key === "ArrowRight") setIndex((i) => Math.min(fens.length - 1, i + 1));
      else if (e.key === "Home") setIndex(0);
      else if (e.key === "End") setIndex(fens.length - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fens.length]);

  if (error) {
    return <div className="max-w-3xl mx-auto px-6 py-20 text-zinc-400">{error}</div>;
  }
  if (!game) {
    return <div className="max-w-3xl mx-auto px-6 py-20 text-zinc-500">Loading review…</div>;
  }

  const orientation = game.color === "black" ? "black" : "white";
  const pairs = [];
  for (let i = 0; i < sans.length; i += 2) {
    pairs.push({ n: i / 2 + 1, w: sans[i], b: sans[i + 1], wi: i + 1, bi: i + 2 });
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-8 py-6">
      <button onClick={() => navigate(-1)} className="text-sm text-zinc-400 hover:text-white inline-flex items-center gap-1 mb-4">
        <ArrowLeft size={14} /> Back
      </button>

      <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
        <div>
          <div className="text-xs uppercase tracking-[0.3em] text-[#FCD34D]">Game review</div>
          <h1 className="font-display text-4xl">
            {game.mode === "ai" ? `vs Engine L${game.engine_level || "?"}` : game.mode === "online" ? "Online" : "Local"}
            {game.time_control ? ` · ${game.time_control}` : ""}
          </h1>
          <div className="text-zinc-500 font-mono text-xs mt-1">
            {game.result ? `${game.result} · ${game.termination || "—"}` : "ongoing"}
          </div>
        </div>
        <div className="text-xs font-mono text-zinc-400" data-testid="review-position-index">
          Move {index} / {fens.length - 1}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-1 order-1 flex items-stretch">
          <EvalBar cp={evalScore.cp} mate={evalScore.mate} orientation={orientation} />
        </div>

        <div className="lg:col-span-7 order-2 flex flex-col gap-4 items-center">
          <div className="w-full max-w-[80vh]">
            <BoardView
              fen={fens[index]}
              onMove={() => false}
              orientation={orientation}
              disabled
            />
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-center">
            <button data-testid={REVIEW.first} onClick={() => setIndex(0)} className="btn-ghost !py-2 !px-4"><CaretDoubleLeft size={16} /></button>
            <button data-testid={REVIEW.prev} onClick={() => setIndex((i) => Math.max(0, i - 1))} className="btn-ghost !py-2 !px-4"><CaretLeft size={16} /></button>
            <button data-testid={REVIEW.next} onClick={() => setIndex((i) => Math.min(fens.length - 1, i + 1))} className="btn-ghost !py-2 !px-4"><CaretRight size={16} /></button>
            <button data-testid={REVIEW.last} onClick={() => setIndex(fens.length - 1)} className="btn-ghost !py-2 !px-4"><CaretDoubleRight size={16} /></button>
            <span className={`ml-3 text-xs font-mono ${analyzing ? "text-zinc-400 animate-pulse" : "text-[#FCD34D]"}`}>
              {analyzing ? "analyzing…" : "eval ready"}
            </span>
          </div>
        </div>

        <div className="lg:col-span-4 order-3 glass rounded-2xl p-4 max-h-[80vh] overflow-y-auto">
          <div className="text-xs uppercase tracking-[0.3em] text-zinc-400 mb-3">PGN</div>
          <div data-testid={REVIEW.pgn} className="font-mono text-sm">
            {pairs.length === 0 && <div className="text-zinc-500 italic">No moves recorded.</div>}
            {pairs.map((p) => (
              <div key={p.n} className="grid grid-cols-12 gap-1 py-1 border-b border-white/5">
                <div className="col-span-2 text-zinc-500">{p.n}.</div>
                <button
                  data-testid={REVIEW.moveBtn(p.wi)}
                  onClick={() => setIndex(p.wi)}
                  className={`col-span-5 text-left px-2 rounded ${
                    index === p.wi ? "bg-[#FCD34D]/20 text-[#FCD34D]" : "text-white hover:bg-white/5"
                  }`}
                >{p.w}</button>
                {p.b ? (
                  <button
                    data-testid={REVIEW.moveBtn(p.bi)}
                    onClick={() => setIndex(p.bi)}
                    className={`col-span-5 text-left px-2 rounded ${
                      index === p.bi ? "bg-[#FCD34D]/20 text-[#FCD34D]" : "text-zinc-300 hover:bg-white/5"
                    }`}
                  >{p.b}</button>
                ) : <div className="col-span-5"></div>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
