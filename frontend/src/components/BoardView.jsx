import { useMemo } from "react";
import { Chessboard } from "react-chessboard";

const LIGHT = "#E6D5B8";
const DARK = "#1E1E1E";

export default function BoardView({
  fen,
  onMove,
  orientation = "white",
  lastMove,
  selected,
  legalTargets = [],
  disabled = false,
  onSquareClick,
  inCheckSquare,
}) {
  const squareStyles = useMemo(() => {
    const s = {};
    if (lastMove) {
      s[lastMove.from] = { background: "rgba(255,255,255,0.18)" };
      s[lastMove.to] = { background: "rgba(255,255,255,0.18)" };
    }
    if (selected) {
      s[selected] = { background: "rgba(212,175,55,0.45)" };
    }
    for (const sq of legalTargets) {
      s[sq] = {
        ...(s[sq] || {}),
        background: `${(s[sq]?.background || "")}, radial-gradient(circle, rgba(212,175,55,0.55) 22%, transparent 25%)`.replace(/^, /, ""),
      };
    }
    if (inCheckSquare) {
      s[inCheckSquare] = { background: "rgba(239,68,68,0.55)" };
    }
    return s;
  }, [lastMove, selected, legalTargets, inCheckSquare]);

  return (
    <div className="chess-board-wrapper">
      <Chessboard
        options={{
          position: fen,
          boardOrientation: orientation,
          allowDragging: !disabled,
          showNotation: true,
          animationDurationInMs: 220,
          lightSquareStyle: { backgroundColor: LIGHT },
          darkSquareStyle: { backgroundColor: DARK },
          alphaNotationStyle: { color: "rgba(255,255,255,0.7)", fontWeight: 700, fontSize: 14 },
          numericNotationStyle: { color: "rgba(255,255,255,0.7)", fontWeight: 700, fontSize: 14 },
          squareStyles,
          onPieceDrop: ({ sourceSquare, targetSquare }) => {
            if (!targetSquare || disabled) return false;
            return onMove({ from: sourceSquare, to: targetSquare });
          },
          onSquareClick: ({ square }) => {
            if (disabled) return;
            onSquareClick && onSquareClick(square);
          },
        }}
      />
    </div>
  );
}
