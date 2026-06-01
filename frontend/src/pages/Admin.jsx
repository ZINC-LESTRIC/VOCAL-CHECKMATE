import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { ADMIN } from "@/constants/testIds";
import { ShieldCheck, Trash, Prohibit, ArrowUUpLeft } from "@phosphor-icons/react";

export default function Admin() {
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [q, setQ] = useState("");

  const load = async () => {
    try {
      const [s, u] = await Promise.all([
        api.get("/admin/stats"),
        api.get(`/admin/users${q ? `?q=${encodeURIComponent(q)}` : ""}`),
      ]);
      setStats(s.data); setUsers(u.data);
    } catch (e) {
      toast.error("Admin only");
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [q]);

  const setBan = async (id, banned) => {
    try {
      await api.put(`/admin/users/${id}`, { banned });
      toast.success(banned ? "User banned" : "User unbanned");
      load();
    } catch (e) { toast.error("Failed"); }
  };

  const del = async (id) => {
    if (!window.confirm("Delete this user permanently?")) return;
    try {
      await api.delete(`/admin/users/${id}`);
      toast.success("User deleted");
      load();
    } catch (e) { toast.error("Failed"); }
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-12 space-y-8">
      <div className="flex items-center gap-3">
        <ShieldCheck size={36} weight="duotone" className="text-[#FCD34D]" />
        <h1 className="font-display text-5xl">Admin panel</h1>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { label: "Users", value: stats.total_users },
            { label: "Banned", value: stats.banned_users },
            { label: "Games", value: stats.total_games },
            { label: "Finished", value: stats.finished_games },
            { label: "Online", value: stats.online_now },
          ].map((s) => (
            <div key={s.label} className="glass rounded-2xl p-5">
              <div className="text-xs uppercase tracking-[0.3em] text-zinc-400">{s.label}</div>
              <div className="font-display text-4xl mt-1">{s.value}</div>
            </div>
          ))}
        </div>
      )}

      <div className="glass rounded-3xl p-6">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div className="font-display text-2xl">Users</div>
          <input
            data-testid={ADMIN.search}
            value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Search email or username"
            className="bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#FCD34D]"
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full font-mono text-sm">
            <thead>
              <tr className="text-zinc-500 uppercase text-xs tracking-widest">
                <th className="text-left py-2">User</th>
                <th className="text-left py-2">Email</th>
                <th className="text-left py-2">Role</th>
                <th className="text-left py-2">Rating</th>
                <th className="text-left py-2">Games</th>
                <th className="text-left py-2">Status</th>
                <th className="text-right py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-t border-white/5">
                  <td className="py-3">{u.username}</td>
                  <td className="py-3 text-zinc-400">{u.email}</td>
                  <td className="py-3"><span className={u.role === "admin" ? "text-[#FCD34D]" : "text-zinc-300"}>{u.role}</span></td>
                  <td className="py-3 text-[#FCD34D]">{u.rating}</td>
                  <td className="py-3 text-zinc-400">{u.stats?.games || 0}</td>
                  <td className="py-3">{u.banned ? <span className="text-red-400">banned</span> : <span className="text-emerald-400">active</span>}</td>
                  <td className="py-3 text-right">
                    <div className="inline-flex gap-2">
                      {u.banned ? (
                        <button data-testid={ADMIN.unban(u.id)} onClick={() => setBan(u.id, false)} className="px-2 py-1 rounded bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30">
                          <ArrowUUpLeft size={14} weight="bold" />
                        </button>
                      ) : (
                        <button data-testid={ADMIN.ban(u.id)} onClick={() => setBan(u.id, true)} className="px-2 py-1 rounded bg-amber-500/20 text-amber-200 hover:bg-amber-500/30">
                          <Prohibit size={14} weight="bold" />
                        </button>
                      )}
                      <button data-testid={ADMIN.del(u.id)} onClick={() => del(u.id)} className="px-2 py-1 rounded bg-red-500/20 text-red-300 hover:bg-red-500/30">
                        <Trash size={14} weight="bold" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
