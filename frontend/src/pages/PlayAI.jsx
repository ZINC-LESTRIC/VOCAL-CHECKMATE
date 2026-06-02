import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import BoardView from "@/components/BoardView";
import MoveList from "@/components/MoveList";
import VoiceMic from "@/components/VoiceMic";
import Clock from "@/components/Clock";
import TimeControlPicker from "@/components/TimeControlPicker";
import { useChessGame } from "@/lib/useChessGame";
import { useClock } from "@/lib/useClock";
import { StockfishEngine, LEVELS } from "@/lib/stockfish";
import { playMoveSound } from "@/lib/sound";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { PLAY } from "@/constants/testIds";
import { ArrowsClockwise, Flag, Plus } from "@phosphor-icons/react";

const LEVEL_LABELS = {
  1: "Beginner", 2: "Casual", 3: "Club", 4: "Strong Club",
  5: "Expert", 6: "Master", 7: "GM", 8: "Super-GM",
};

export default function PlayAI() {
  const { user } = useAuth();
  const [level, setLevel] = useState(null);
  const [color, setColor] = useState("white");
  const [orientation, setOrientation] = useState("white");
  const [engineThinking, setEngineThinking] = useState(false);
  const [gameId, setGameId] = useState(null);
  const [ratingChange, setRatingChange] = useState(null);
  const [timeControl, setTimeControl] = useState(null);
  const engineRef = useRef(null);
  const lastSanRef = useRef(null);

  const game = useChessGame();
  const clock = useClock(timeControl);

  // Play sound + switch clock whenever a new move lands
  useEffect(() => {
    if (!game.lastMove) return;
    if (lastSanRef.current === game.lastMove.san) return;
    lastSanRef.current = game.lastMove.san;
    playMoveSound(user?.sound_enabled !== false);
    if (clock.enabled && !game.ended) {
      // game.turn is the side TO MOVE now -> the side that just moved is the other
      const moverColor = game.turn === "w" ? "b" : "w";
      clock.onMove(moverColor);
    }
     
  }, [game.lastMove?.san, game.ended]);

  // Clock timeout -> end the game in favor of the other side
  useEffect(() => {
    if (!clock.timeoutColor || game.ended) return;
    const loser = clock.timeoutColor === "w" ? "white" : "black";
    game.resign(loser);
     
  }, [clock.timeoutColor]);

  const startGame = async (lvl) => {
    setLevel(lvl);
    setOrientation(color);
    setRatingChange(null);
    game.reset();
    clock.reset();
    lastSanRef.current = null;
    const eng = new StockfishEngine();
    engineRef.current = eng;
    await eng.configure(lvl);
    try {
      const r = await api.post("/games", {
        mode: "ai", color, engine_level: lvl,
        time_control: timeControl?.label || null,
      });
      setGameId(r.data.id);
    } catch (e) { /* still playable */ }
    if (clock.enabled) clock.start("w");
    if (color === "black") {
      await engineMove(eng);
    }
  };

  const engineMove = async (engOverride) => {
    const eng = engOverride || engineRef.current;
    if (!eng) return;
    setEngineThinking(true);
    try {
      const mv = await eng.bestMove(game.fen);
      if (mv) {
        game.move({ from: mv.from, to: mv.to, promotion: mv.promotion });
      }
    } finally { setEngineThinking(false); }
  };

  // When it's the engine's turn, ask it for a move.
  useEffect(() => {
    if (!level || game.ended) return;
    const userColor = color === "white" ? "w" : "b";
    if (game.turn !== userColor && !engineThinking) {
      engineMove();
    }
     
  }, [game.fen, level, game.ended]);

  // Finish the game on the server when it ends.
  useEffect(() => {
    if (!game.ended || !gameId) return;
    clock.stop();
    api.post(`/games/${gameId}/finish`, {
      pgn: game.chessRef.current.pgn(),
      moves: game.history,
      final_fen: game.fen,
      result: game.result,
      termination: game.termination,
    }).then((r) => {
      setRatingChange(r.data.rating_change);
      const msg = game.result === color ? "Victory" : game.result === "draw" ? "Draw" : "Defeat";
      toast.success(`${msg} · ${r.data.rating_change >= 0 ? "+" : ""}${r.data.rating_change} rating`);
    }).catch(() => {});
     
  }, [game.ended]);

  const onUserMove = (m) => {
    if (game.ended) return false;
    const userColor = color === "white" ? "w" : "b";
    if (game.turn !== userColor) return false;
    const result = game.move(m);
    return Boolean(result);
  };

  const newGame = () => {
    if (engineRef.current) { engineRef.current.destroy(); engineRef.current = null; }
    setLevel(null);
    setGameId(null);
    clock.reset();
    game.reset();
  };

  const resign = () => {
    game.resign(color);
    toast.message("You resigned.");
  };

  if (!level) {
    return (
      <div className="max-w-7xl mx-auto px-6 sm:px-10 py-12">
        <h1 className="font-display text-5xl sm:text-6xl mb-2">Choose your engine</h1>
        <p className="text-zinc-400 mb-10">Stockfish, calibrated. Pick a level — they hit harder as you climb.</p>

        <div className="flex flex-wrap items-center gap-3 mb-6">
          <span className="text-xs uppercase tracking-[0.3em] text-zinc-400">Play as</span>
          {["white", "black", "random"].map((c) => (
            <button
              key={c}
              onClick={() => setColor(c === "random" ? (Math.random() < 0.5 ? "white" : "black") : c)}
              className={`px-4 py-2 rounded-full text-xs uppercase tracking-widest border ${
                color === c ? "border-[#FCD34D] text-[#FCD34D]" : "border-white/10 text-zinc-400 hover:border-white/30"
              }`}
            >{c}</button>
          ))}
        </div>

        <div className="mb-10">
          <TimeControlPicker value={timeControl} onChange={setTimeControl} />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {LEVELS.map((l) => (
            <button
              key={l.level}
              data-testid={PLAY.levelCard(l.level)}
              onClick={() => startGame(l.level)}
              className="group glass rounded-3xl p-6 text-left hover:border-[#FCD34D]/60 transition-all hover:-translate-y-1"
            >
              <div className="text-xs uppercase tracking-[0.3em] text-zinc-400">Level {l.level}</div>
              <div className="font-display text-4xl sm:text-5xl mt-2 text-white group-hover:text-[#FCD34D] transition-colors">
                {l.elo}
              </div>
              <div className="text-xs uppercase tracking-widest text-zinc-500 mt-1 font-mono">Elo · {LEVEL_LABELS[l.level]}</div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  const userColor = color === "white" ? "w" : "b";
  const userTurn = game.turn === userColor && !game.ended;
  const topClockSide = orientation === "white" ? "b" : "w";
  const bottomClockSide = orientation === "white" ? "w" : "b";
  const topSeconds = topClockSide === "w" ? clock.white : clock.black;
  const bottomSeconds = bottomClockSide === "w" ? clock.white : clock.black;
  const topActive = clock.active === topClockSide;
  const bottomActive = clock.active === bottomClockSide;
  const topLabel = topClockSide === userColor ? "You" : "Engine";
  const bottomLabel = bottomClockSide === userColor ? "You" : "Engine";

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-8 py-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-3 order-2 lg:order-1 flex flex-col gap-4">
          <div className="glass rounded-2xl p-5">
            <div className="text-xs uppercase tracking-[0.3em] text-zinc-400">Engine</div>
            <div className="font-display text-3xl">L{level} · {LEVELS.find((l) => l.level === level)?.elo}</div>
            <div className="text-xs uppercase font-mono text-zinc-500 mt-1">
              {LEVEL_LABELS[level]}{timeControl ? ` · ${timeControl.label}` : " · ∞"}
            </div>
            <div className="mt-4 text-sm">
              {game.ended ? (
                <span className="text-[#FCD34D]">
                  {game.result === color ? "You won" : game.result === "draw" ? "Draw" : "You lost"}
                  {game.termination === "resign" && clock.timeoutColor ? " (on time)" : ""}
                  {ratingChange !== null && (
                    <span className="ml-2 font-mono">({ratingChange >= 0 ? "+" : ""}{ratingChange})</span>
                  )}
                </span>
              ) : engineThinking ? (
                <span className="text-zinc-300 animate-pulse">Engine thinking…</span>
              ) : userTurn ? (
                <span className="text-emerald-400">Your move</span>
              ) : null}
            </div>
          </div>
          <MoveList moves={game.history} />
        </div>

        <div className="lg:col-span-6 order-1 lg:order-2 flex flex-col items-center gap-4">
          {clock.enabled && (
            <Clock seconds={topSeconds} active={topActive && !game.ended} label={topLabel} />
          )}
          <div className="w-full max-w-[80vh]">
            <BoardView
              fen={game.fen}
              onMove={onUserMove}
              orientation={orientation}
              lastMove={game.lastMove}
              selected={game.selected}
              legalTargets={game.legalTargets}
              onSquareClick={game.onSquareClick}
              disabled={!userTurn}
              inCheckSquare={game.inCheckSquare}
            />
          </div>
          {clock.enabled && (
            <Clock seconds={bottomSeconds} active={bottomActive && !game.ended} label={bottomLabel} />
          )}
          {userTurn && (
  <div className="text-xs text-zinc-500 text-center max-w-xs font-mono">
    💡 Say: <span className="text-zinc-300">"N F 3"</span> · <span className="text-zinc-300">"E 4"</span> · <span className="text-zinc-300">"O O"</span> (castle)
  </div>
)}
          <VoiceMic
            chessRef={game.chessRef}
            onMove={(m) => onUserMove({ from: m.from, to: m.to, promotion: m.promotion })}
            disabled={!userTurn}
            hint={userTurn ? "Tap to speak a move" : "Engine is thinking…"}
          />
        </div>

        <div className="lg:col-span-3 order-3 flex flex-col gap-3">
          <button data-testid={PLAY.flipBoard} onClick={() => setOrientation((o) => o === "white" ? "black" : "white")} className="btn-ghost !py-3 inline-flex items-center justify-center gap-2">
            <ArrowsClockwise size={18} weight="duotone" /> Flip board
          </button>
          <button data-testid={PLAY.resign} onClick={resign} disabled={game.ended} className="btn-ghost !py-3 inline-flex items-center justify-center gap-2 disabled:opacity-40">
            <Flag size={18} weight="duotone" /> Resign
          </button>
          <button data-testid={PLAY.newGame} onClick={newGame} className="btn-gold !py-3 inline-flex items-center justify-center gap-2">
            <Plus size={18} weight="bold" /> New game
          </button>
        </div>
      </div>
    </div>
  );
}
