import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import BoardView from "@/components/BoardView";
import MoveList from "@/components/MoveList";
import VoiceMic from "@/components/VoiceMic";
import Clock from "@/components/Clock";
import TimeControlPicker from "@/components/TimeControlPicker";
import { useChessGame } from "@/lib/useChessGame";
import { useClock, findTimeControl } from "@/lib/useClock";
import { playMoveSound } from "@/lib/sound";
import { useAuth } from "@/context/AuthContext";
import { api, wsUrl } from "@/lib/api";
import { ONLINE, PLAY } from "@/constants/testIds";
import { Flag, PaperPlaneTilt, Hash, GlobeHemisphereWest } from "@phosphor-icons/react";

export default function PlayOnline() {
  const { user } = useAuth();
  const game = useChessGame();
  const wsRef = useRef(null);
  const lastSanRef = useRef(null);

  const [connected, setConnected] = useState(false);
  const [inQueue, setInQueue] = useState(false);
  const [inviteCode, setInviteCode] = useState("");
  const [inviteInput, setInviteInput] = useState("");
  const [opponent, setOpponent] = useState(null);
  const [color, setColor] = useState(null);
  const [roomId, setRoomId] = useState(null);
  const [chat, setChat] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [gameId, setGameId] = useState(null);
  const [ended, setEnded] = useState(false);
  const [timeControl, setTimeControl] = useState(findTimeControl("10+0"));

  const clock = useClock(timeControl);

  // Connect WS
  useEffect(() => {
    if (!user) return;
    const token = localStorage.getItem("access_token") || "";
    const ws = new WebSocket(wsUrl(token));
    wsRef.current = ws;
    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onerror = () => setConnected(false);
    ws.onmessage = (ev) => handleWs(JSON.parse(ev.data));
    return () => { try { ws.close(); } catch (e) { /* ignore */ } };
     
  }, [user]);

  const send = (obj) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj));
  };

  // Sound + clock switch on every move (own or opponent)
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

  // Timeout -> resign whichever side ran out
  useEffect(() => {
    if (!clock.timeoutColor || game.ended || !color) return;
    const loser = clock.timeoutColor === "w" ? "white" : "black";
    if (loser === color) {
      send({ type: "resign" });
    }
    game.resign(loser);
     
  }, [clock.timeoutColor]);

  const handleWs = (data) => {
    if (data.type === "queue_joined") setInQueue(true);
    if (data.type === "queue_left") setInQueue(false);
    if (data.type === "invite_created") setInviteCode(data.code);
    if (data.type === "error") toast.error(data.message);
    if (data.type === "game_start") {
      setInQueue(false);
      setInviteCode("");
      setOpponent(data.opponent);
      setColor(data.color);
      setRoomId(data.room_id);
      setEnded(false);
      lastSanRef.current = null;
      game.reset();
      // sync clock to whatever the server told us
      const tc = findTimeControl(data.time_control);
      setTimeControl(tc);
      // useEffect on timeControl will reset clock; start it on white
      setTimeout(() => clock.start("w"), 0);
      toast.success(`Game start — you are ${data.color}${data.time_control ? ` · ${data.time_control}` : ""}`);
      api.post("/games", { mode: "online", color: data.color, time_control: data.time_control || null })
        .then((r) => setGameId(r.data.id)).catch(() => {});
    }
    if (data.type === "move") {
      const result = game.move({ from: data.from, to: data.to, promotion: data.promotion });
      if (!result) game.reset(data.fen);
      // sync opponent clock (server-trusted via opponent's reported time)
      if (clock.enabled && typeof data.clock === "number" && color) {
        const opponentColor = color === "white" ? "b" : "w";
        clock.setRemaining(opponentColor, data.clock);
      }
    }
    if (data.type === "opponent_resign") {
      toast.message("Opponent resigned");
      game.resign(color === "white" ? "black" : "white");
    }
    if (data.type === "opponent_disconnect") toast.warning("Opponent disconnected");
    if (data.type === "chat") setChat((c) => [...c, { from: data.from, message: data.message }]);
  };

  const onUserMove = (m) => {
    if (!color || game.ended) return false;
    const myColor = color === "white" ? "w" : "b";
    if (game.turn !== myColor) return false;
    const result = game.move(m);
    if (result) {
      const myRemaining = clock.enabled ? (myColor === "w" ? clock.white : clock.black) : null;
      send({
        type: "move", from: result.from, to: result.to,
        promotion: result.promotion, san: result.san,
        fen: game.chessRef.current.fen(),
        clock: myRemaining,
      });
    }
    return Boolean(result);
  };

  // Finish online game on server when ended
  useEffect(() => {
    if (!game.ended || !gameId || ended) return;
    setEnded(true);
    clock.stop();
    api.post(`/games/${gameId}/finish`, {
      pgn: game.chessRef.current.pgn(),
      moves: game.history,
      final_fen: game.fen,
      result: game.result,
      termination: game.termination,
    }).catch(() => {});
     
  }, [game.ended]);

  const userTurn = color && game.turn === (color === "white" ? "w" : "b") && !game.ended;

  if (!roomId) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-12">
        <div className="text-xs uppercase tracking-[0.3em] text-[#FCD34D] mb-2">Online play</div>
        <h1 className="font-display text-5xl mb-2">{connected ? "Find an opponent" : "Connecting…"}</h1>
        <p className="text-zinc-400 mb-8">Matchmaking or share an invite code with a friend.</p>

        <div className="mb-8">
          <TimeControlPicker value={timeControl} onChange={setTimeControl} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="glass rounded-3xl p-8">
            <GlobeHemisphereWest size={32} weight="duotone" className="text-[#FCD34D] mb-3" />
            <div className="font-display text-2xl mb-2">Matchmaking</div>
            <p className="text-zinc-400 mb-6">Join the queue. We&apos;ll pair you with the next available player on this time control.</p>
            {!inQueue ? (
              <button
                data-testid={ONLINE.queueJoin}
                disabled={!connected}
                onClick={() => send({ type: "queue_join", time_control: timeControl?.label || "10+0" })}
                className="btn-gold w-full"
              >
                Join queue
              </button>
            ) : (
              <button data-testid={ONLINE.queueLeave} onClick={() => send({ type: "queue_leave" })} className="btn-ghost w-full">
                Searching… cancel
              </button>
            )}
          </div>

          <div className="glass rounded-3xl p-8">
            <Hash size={32} weight="duotone" className="text-[#FCD34D] mb-3" />
            <div className="font-display text-2xl mb-2">Play a friend</div>
            <p className="text-zinc-400 mb-6">Create a code and share it. Or enter one from a friend.</p>
            {inviteCode ? (
              <div data-testid={ONLINE.inviteCode} className="font-mono text-3xl text-[#FCD34D] tracking-widest mb-4">{inviteCode}</div>
            ) : (
              <button
                data-testid={ONLINE.inviteCreate}
                disabled={!connected}
                onClick={() => send({ type: "invite_create", time_control: timeControl?.label || "10+0" })}
                className="btn-ghost w-full mb-4"
              >
                Create invite
              </button>
            )}
            <div className="flex gap-2">
              <input
                data-testid={ONLINE.inviteInput}
                placeholder="ENTER CODE"
                value={inviteInput}
                onChange={(e) => setInviteInput(e.target.value.toUpperCase())}
                className="flex-1 bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 font-mono tracking-widest outline-none focus:border-[#FCD34D]"
              />
              <button
                data-testid={ONLINE.inviteAccept}
                disabled={!connected || !inviteInput}
                onClick={() => send({ type: "invite_accept", code: inviteInput })}
                className="btn-gold !px-5 !py-3"
              >Join</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const topClockSide = color === "white" ? "b" : "w";
  const bottomClockSide = color === "white" ? "w" : "b";

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-8 py-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-3 order-2 lg:order-1 flex flex-col gap-4">
          <div className="glass rounded-2xl p-5">
            <div className="text-xs uppercase tracking-[0.3em] text-zinc-400">Opponent</div>
            <div className="font-display text-2xl">{opponent?.username || "Anonymous"}</div>
            <div className="font-mono text-[#FCD34D]">{opponent?.rating}</div>
            {timeControl && <div className="font-mono text-xs text-zinc-500 mt-1">{timeControl.label}</div>}
          </div>
          <MoveList moves={game.history} />
        </div>
        <div className="lg:col-span-6 order-1 lg:order-2 flex flex-col items-center gap-4">
          {clock.enabled && (
            <Clock
              seconds={topClockSide === "w" ? clock.white : clock.black}
              active={clock.active === topClockSide && !game.ended}
              label="Opponent"
            />
          )}
          <div className="w-full max-w-[80vh]">
            <BoardView
              fen={game.fen}
              onMove={onUserMove}
              orientation={color || "white"}
              lastMove={game.lastMove}
              selected={game.selected}
              legalTargets={game.legalTargets}
              onSquareClick={(sq) => userTurn && game.onSquareClick(sq)}
              disabled={!userTurn}
              inCheckSquare={game.inCheckSquare}
            />
          </div>
          {clock.enabled && (
            <Clock
              seconds={bottomClockSide === "w" ? clock.white : clock.black}
              active={clock.active === bottomClockSide && !game.ended}
              label="You"
            />
          )}
          <VoiceMic
            chessRef={game.chessRef}
            onMove={(m) => onUserMove({ from: m.from, to: m.to, promotion: m.promotion })}
            disabled={!userTurn}
            hint={userTurn ? "Your turn — speak" : "Waiting on opponent"}
          />
        </div>
        <div className="lg:col-span-3 order-3 flex flex-col gap-3">
          <button data-testid={PLAY.resign} onClick={() => { send({ type: "resign" }); game.resign(color); }} disabled={game.ended} className="btn-ghost !py-3 inline-flex items-center justify-center gap-2 disabled:opacity-40">
            <Flag size={18} /> Resign
          </button>
          <div className="glass rounded-2xl p-4 flex flex-col flex-1 min-h-[200px]">
            <div className="text-xs uppercase tracking-[0.3em] text-zinc-400 mb-2">Chat</div>
            <div className="flex-1 overflow-y-auto space-y-1 text-sm font-mono">
              {chat.map((m, i) => (
                <div key={i}><span className="text-[#FCD34D]">{m.from}:</span> <span className="text-zinc-300">{m.message}</span></div>
              ))}
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (chatInput.trim()) {
                  send({ type: "chat", message: chatInput });
                  setChat((c) => [...c, { from: user?.username || "Me", message: chatInput }]);
                  setChatInput("");
                }
              }}
              className="flex gap-2 mt-2"
            >
              <input
                data-testid={ONLINE.chatInput}
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Say something…"
                className="flex-1 bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#FCD34D]"
              />
              <button data-testid={ONLINE.chatSend} className="bg-[#FCD34D] text-black px-3 rounded-lg"><PaperPlaneTilt size={16} weight="fill" /></button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
