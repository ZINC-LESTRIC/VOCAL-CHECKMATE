/**
 * Shared chess game state hook: wraps chess.js + tracks moves, last move,
 * selected square, legal targets, ended/result, and resign helpers.
 */
import { Chess } from "chess.js";
import { useCallback, useMemo, useRef, useState } from "react";

export function useChessGame(initialFen) {
  const ref = useRef(new Chess(initialFen || undefined));
  const [fen, setFen] = useState(ref.current.fen());
  const [history, setHistory] = useState([]); // list of SAN
  const [lastMove, setLastMove] = useState(null);
  const [selected, setSelected] = useState(null);
  const [legalTargets, setLegalTargets] = useState([]);
  const [ended, setEnded] = useState(false);
  const [result, setResult] = useState(null); // 'white' | 'black' | 'draw'
  const [termination, setTermination] = useState(null);

  const sync = useCallback(() => {
    setFen(ref.current.fen());
    setHistory(ref.current.history({ verbose: true }).map((m) => m.san));
    if (ref.current.isGameOver()) {
      setEnded(true);
      if (ref.current.isCheckmate()) {
        // The side to move was checkmated -> the other side wins.
        setResult(ref.current.turn() === "w" ? "black" : "white");
        setTermination("checkmate");
      } else if (ref.current.isStalemate()) {
        setResult("draw"); setTermination("stalemate");
      } else if (ref.current.isThreefoldRepetition()) {
        setResult("draw"); setTermination("threefold");
      } else if (ref.current.isInsufficientMaterial()) {
        setResult("draw"); setTermination("insufficient");
      } else if (ref.current.isDraw()) {
        setResult("draw"); setTermination("fifty-move");
      }
    }
  }, []);

  const move = useCallback((m) => {
    try {
      const piece = ref.current.get(m.from);
      const moveObj = { from: m.from, to: m.to };
      if (piece && piece.type === "p" && (m.to[1] === "8" || m.to[1] === "1")) {
        moveObj.promotion = m.promotion || "q";
      } else if (m.promotion) {
        moveObj.promotion = m.promotion;
      }
      const result = ref.current.move(moveObj);
      if (!result) return null;
      setLastMove({ from: result.from, to: result.to, san: result.san });
      setSelected(null); setLegalTargets([]);
      sync();
      return result;
    } catch (e) {
      return null;
    }
  }, [sync]);

  const onSquareClick = useCallback((sq) => {
    if (ended) return;
    if (selected && sq === selected) {
      setSelected(null); setLegalTargets([]); return;
    }
    if (selected) {
      const ok = move({ from: selected, to: sq });
      if (ok) return;
    }
    const piece = ref.current.get(sq);
    if (piece && piece.color === ref.current.turn()) {
      const moves = ref.current.moves({ square: sq, verbose: true });
      setSelected(sq);
      setLegalTargets(moves.map((m) => m.to));
    } else {
      setSelected(null); setLegalTargets([]);
    }
  }, [selected, move, ended]);

  const reset = useCallback((fenStr) => {
    ref.current = new Chess(fenStr || undefined);
    setHistory([]); setLastMove(null); setSelected(null); setLegalTargets([]);
    setEnded(false); setResult(null); setTermination(null);
    setFen(ref.current.fen());
  }, []);

  const resign = useCallback((color) => {
    setEnded(true);
    setResult(color === "white" ? "black" : "white");
    setTermination("resign");
  }, []);

  const inCheckSquare = useMemo(() => {
    if (!ref.current.inCheck()) return null;
    const turn = ref.current.turn();
    const board = ref.current.board();
    for (let r = 0; r < 8; r += 1) {
      for (let c = 0; c < 8; c += 1) {
        const p = board[r][c];
        if (p && p.type === "k" && p.color === turn) {
          const file = "abcdefgh"[c];
          const rank = 8 - r;
          return `${file}${rank}`;
        }
      }
    }
    return null;
  }, [fen]);

  return {
    chessRef: ref,
    fen,
    history,
    lastMove,
    selected,
    legalTargets,
    ended,
    result,
    termination,
    move,
    onSquareClick,
    reset,
    resign,
    inCheckSquare,
    turn: ref.current.turn(),
  };
}
