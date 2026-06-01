import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import BoardView from "@/components/BoardView";
import MoveList from "@/components/MoveList";
import VoiceMic from "@/components/VoiceMic";
import Clock from "@/components/Clock";
import TimeControlPicker from "@/components/TimeControlPicker";
import { useChessGame } from "@/lib/useChessGame";
import { useClock } from "@/lib/useClock";
import { playMoveSound } from "@/lib/sound";
import { useAuth } from "@/context/AuthContext";
import { PLAY } from "@/constants/testIds";
import { ArrowsClockwise, Flag, Plus } from "@phosphor-icons/react";

export default function PlayLocal() {
  const { user } = useAuth();
  const game = useChessGame();
  const [autoFlip, setAutoFlip] = useState(true);
  const [manualOrientation, setManualOrientation] = useState("white");
  const [timeControl, setTimeControl] = useState(null);
  const [started, setStarted] = useState(false);
  const clock = useClock(timeControl);
  const lastSanRef = useRef(null);

  const onMove = (m) => {
    const r = game.move(m);
    return Boolean(r);
  };

  // Sound + clock switch on every move
  useEffect(() => {
    if (!game.lastMove) return;
    if (lastSanRef.current === game.lastMove.san) return;
    lastSanRef.current = game.lastMove.san;
    playMoveSound(user?.sound_enabled !== false);
    if (clock.enabled && !game.ended) {
      const moverColor = game.turn === "w" ? "b" : "w";
      clock.onMove(moverColor);
    }
     
  }, [game.lastMove?.san, game.ended]);

  // Timeout
  useEffect(() => {
    if (!clock.timeoutColor || game.ended) return;
    game.resign(clock.timeoutColor === "w" ? "white" : "black");
     
  }, [clock.timeoutColor]);

  useEffect(() => {
    if (game.ended) clock.stop();
     
  }, [game.ended]);

  const startMatch = () => {
    setStarted(true);
    game.reset();
    clock.reset();
    lastSanRef.current = null;
    if (clock.enabled) clock.start("w");
  };

  const newGame = () => {
    setStarted(false);
    game.reset();
    clock.reset();
  };

  const orientation = autoFlip ? (game.turn === "w" ? "white" : "black") : manualOrientation;

  if (!started) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-12">
        <div className="text-xs uppercase tracking-[0.3em] text-[#FCD34D] mb-2">Local · Pass &amp; Play</div>
        <h1 className="font-display text-5xl mb-6">Set the match</h1>
        <div className="glass rounded-3xl p-8 space-y-6">
          <TimeControlPicker value={timeControl} onChange={setTimeControl} />
          <label className="flex items-center gap-3 cursor-pointer text-sm text-zinc-300">
            <input type="checkbox" checked={autoFlip} onChange={(e) => setAutoFlip(e.target.checked)} />
            Auto-flip board between turns
          </label>
          <button onClick={startMatch} className="btn-gold w-full">Start match</button>
        </div>
      </div>
    );
  }

  const topClockSide = orientation === "white" ? "b" : "w";
  const bottomClockSide = orientation === "white" ? "w" : "b";

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-8 py-6">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <div className="text-xs uppercase tracking-[0.3em] text-[#FCD34D]">
            Local · Pass &amp; Play{timeControl ? ` · ${timeControl.label}` : ""}
          </div>
          <h1 className="font-display text-4xl">{game.ended ? "Game over" : (game.turn === "w" ? "White to move" : "Black to move")}</h1>
        </div>
        <div className="flex items-center gap-3">
          <button data-testid={PLAY.newGame} onClick={newGame} className="btn-gold !py-3 inline-flex items-center gap-2">
            <Plus size={16} /> New
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-3 order-2 lg:order-1">
          <MoveList moves={game.history} />
        </div>
        <div className="lg:col-span-6 order-1 lg:order-2 flex flex-col items-center gap-4">
          {clock.enabled && (
            <Clock
              seconds={topClockSide === "w" ? clock.white : clock.black}
              active={clock.active === topClockSide && !game.ended}
              label={topClockSide === "w" ? "White" : "Black"}
            />
          )}
          <div className="w-full max-w-[80vh] transition-transform duration-500">
            <BoardView
              fen={game.fen}
              onMove={onMove}
              orientation={orientation}
              lastMove={game.lastMove}
              selected={game.selected}
              legalTargets={game.legalTargets}
              onSquareClick={game.onSquareClick}
              disabled={game.ended}
              inCheckSquare={game.inCheckSquare}
            />
          </div>
          {clock.enabled && (
            <Clock
              seconds={bottomClockSide === "w" ? clock.white : clock.black}
              active={clock.active === bottomClockSide && !game.ended}
              label={bottomClockSide === "w" ? "White" : "Black"}
            />
          )}
          <VoiceMic
            chessRef={game.chessRef}
            onMove={(m) => onMove({ from: m.from, to: m.to, promotion: m.promotion })}
            disabled={game.ended}
            hint={game.turn === "w" ? "White's voice" : "Black's voice"}
          />
        </div>
        <div className="lg:col-span-3 order-3 flex flex-col gap-3">
          <button data-testid={PLAY.flipBoard} onClick={() => { setAutoFlip(false); setManualOrientation((o) => o === "white" ? "black" : "white"); }} className="btn-ghost !py-3 inline-flex items-center justify-center gap-2">
            <ArrowsClockwise size={18} /> Flip board
          </button>
          <button data-testid={PLAY.resign} onClick={() => { game.resign(game.turn === "w" ? "white" : "black"); toast.message("Resigned"); }} disabled={game.ended} className="btn-ghost !py-3 inline-flex items-center justify-center gap-2 disabled:opacity-40">
            <Flag size={18} /> Resign
          </button>
          {game.ended && (
            <div className="glass rounded-2xl p-5 text-center">
              <div className="text-xs uppercase tracking-[0.3em] text-zinc-400">Result</div>
              <div className="font-display text-3xl mt-1 text-[#FCD34D]">{game.result === "draw" ? "Draw" : `${game.result} wins`}</div>
              <div className="text-xs font-mono text-zinc-500 mt-1">
                {game.termination}{clock.timeoutColor ? " · on time" : ""}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
