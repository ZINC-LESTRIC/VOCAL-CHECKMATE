import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { Robot, Users, GlobeHemisphereWest, Trophy, ChartLineUp } from "@phosphor-icons/react";

function StatTile({ label, value }) {
  return (
    <div className="glass rounded-2xl p-5">
      <div className="text-xs uppercase tracking-[0.3em] text-zinc-400">{label}</div>
      <div className="font-display text-4xl mt-1 text-white">{value}</div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [recent, setRecent] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);

  useEffect(() => {
    api.get("/games/me").then((r) => setRecent(r.data.slice(0, 5))).catch(() => {});
    api.get("/users/leaderboard?limit=10").then((r) => setLeaderboard(r.data)).catch(() => {});
  }, []);

  const stats = user?.stats || { wins: 0, losses: 0, draws: 0, games: 0 };

  return (
    <div className="max-w-7xl mx-auto px-6 sm:px-10 py-10 space-y-10">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="text-xs uppercase tracking-[0.3em] text-[#FCD34D] mb-2">Welcome</div>
          <h1 className="font-display text-5xl sm:text-6xl">{user?.username}</h1>
        </div>
        <div className="flex gap-4">
          <Link to="/play/ai" className="btn-gold inline-flex items-center gap-2"><Robot size={20} weight="duotone" /> Play Engine</Link>
          <Link to="/play/online" className="btn-ghost inline-flex items-center gap-2"><GlobeHemisphereWest size={20} weight="duotone" /> Online</Link>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatTile label="Rating" value={user?.rating ?? 1200} />
        <StatTile label="Wins" value={stats.wins} />
        <StatTile label="Losses" value={stats.losses} />
        <StatTile label="Draws" value={stats.draws} />
        <StatTile label="Games" value={stats.games} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link to="/play/ai" className="glass rounded-3xl p-8 hover:border-[#FCD34D]/60 transition-all">
          <Robot size={40} weight="duotone" className="text-[#FCD34D] mb-3" />
          <div className="font-display text-2xl">Play vs Engine</div>
          <p className="text-zinc-400 mt-2">8 levels • 400–3200 Elo • Voice control</p>
        </Link>
        <Link to="/play/local" className="glass rounded-3xl p-8 hover:border-[#FCD34D]/60 transition-all">
          <Users size={40} weight="duotone" className="text-[#FCD34D] mb-3" />
          <div className="font-display text-2xl">Pass &amp; Play</div>
          <p className="text-zinc-400 mt-2">Two players, one device, auto-flipping board</p>
        </Link>
        <Link to="/play/online" className="glass rounded-3xl p-8 hover:border-[#FCD34D]/60 transition-all">
          <GlobeHemisphereWest size={40} weight="duotone" className="text-[#FCD34D] mb-3" />
          <div className="font-display text-2xl">Online Play</div>
          <p className="text-zinc-400 mt-2">Matchmaking and invite-code rooms</p>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass rounded-3xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <ChartLineUp size={22} weight="duotone" className="text-[#FCD34D]" />
            <div className="font-display text-2xl">Recent games</div>
          </div>
          {recent.length === 0 && <div className="text-zinc-500 italic">No games yet — start one above.</div>}
          <div className="divide-y divide-white/5">
            {recent.map((g) => (
              <Link key={g.id} to={`/game/${g.id}`} className="py-3 flex items-center justify-between text-sm hover:bg-white/[0.02] -mx-3 px-3 rounded-lg transition-colors">
                <div>
                  <div className="font-medium uppercase tracking-widest">{g.mode}{g.engine_level ? ` · L${g.engine_level}` : ""}</div>
                  <div className="text-zinc-500 font-mono">{new Date(g.created_at).toLocaleString()}</div>
                </div>
                <div className="flex items-center gap-3 font-mono">
                  <span className={
                    g.result === g.color ? "text-emerald-400" :
                    g.result === "draw" ? "text-zinc-300" :
                    g.result ? "text-red-400" : "text-zinc-500"
                  }>{g.result || "—"}</span>
                  <span className={(g.rating_change || 0) > 0 ? "text-emerald-400" : (g.rating_change || 0) < 0 ? "text-red-400" : "text-zinc-500"}>
                    {(g.rating_change || 0) > 0 ? "+" : ""}{g.rating_change || 0}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>

        <div className="glass rounded-3xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Trophy size={22} weight="duotone" className="text-[#FCD34D]" />
            <div className="font-display text-2xl">Leaderboard</div>
          </div>
          <div className="divide-y divide-white/5">
            {leaderboard.map((u, i) => (
              <div key={u.id} className="py-3 flex items-center justify-between text-sm">
                <div className="flex items-center gap-3">
                  <div className="w-6 text-zinc-500 font-mono">{i + 1}</div>
                  {u.avatar ? (
                    <img src={u.avatar} className="h-7 w-7 rounded-full object-cover" alt="" />
                  ) : (
                    <div className="h-7 w-7 rounded-full bg-zinc-800 flex items-center justify-center text-xs">{u.username?.[0]?.toUpperCase()}</div>
                  )}
                  <div>{u.username}</div>
                </div>
                <div className="font-mono text-[#FCD34D]">{u.rating}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
