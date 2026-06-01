import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { api, formatApiErrorDetail } from "@/lib/api";
import { FRIENDS } from "@/constants/testIds";
import { UserPlus, UserMinus, CheckCircle, XCircle, GameController } from "@phosphor-icons/react";

function Avatar({ user, size = 40 }) {
  if (user.avatar) {
    return <img src={user.avatar} alt="" style={{ width: size, height: size }} className="rounded-full object-cover border border-white/10" />;
  }
  return (
    <div
      className="rounded-full bg-zinc-800 border border-white/10 flex items-center justify-center text-[#FCD34D]"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {user.username?.[0]?.toUpperCase() || "?"}
    </div>
  );
}

function FriendRow({ user, online, right }) {
  return (
    <div data-testid={FRIENDS.item(user.id)} className="flex items-center justify-between py-3">
      <div className="flex items-center gap-3">
        <div className="relative">
          <Avatar user={user} />
          <span
            className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-zinc-950 ${
              online ? "bg-emerald-400" : "bg-zinc-600"
            }`}
            title={online ? "Online" : "Offline"}
          />
        </div>
        <div>
          <div className="font-medium">{user.username}</div>
          <div className="text-xs font-mono text-[#FCD34D]">{user.rating}</div>
        </div>
      </div>
      <div className="flex items-center gap-2">{right}</div>
    </div>
  );
}

export default function Friends() {
  const [friends, setFriends] = useState([]);
  const [incoming, setIncoming] = useState([]);
  const [outgoing, setOutgoing] = useState([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const [a, b] = await Promise.all([api.get("/friends"), api.get("/friends/requests")]);
      setFriends(a.data);
      setIncoming(b.data.incoming);
      setOutgoing(b.data.outgoing);
    } catch (e) { /* ignore */ }
  };

  useEffect(() => { load(); }, []);

  const sendRequest = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    setBusy(true);
    try {
      const { data } = await api.post("/friends/request", { username: input.trim() });
      toast.success(data.status === "accepted" ? "You're now friends!" : "Friend request sent");
      setInput("");
      load();
    } catch (err) {
      toast.error(formatApiErrorDetail(err?.response?.data?.detail) || "Failed");
    } finally { setBusy(false); }
  };

  const accept = async (id) => {
    try { await api.post(`/friends/${id}/accept`); toast.success("Friend added"); load(); }
    catch (e) { toast.error("Failed"); }
  };
  const decline = async (id) => {
    try { await api.post(`/friends/${id}/decline`); load(); }
    catch (e) { toast.error("Failed"); }
  };
  const remove = async (id) => {
    if (!window.confirm("Remove this friend?")) return;
    try { await api.delete(`/friends/${id}`); load(); }
    catch (e) { toast.error("Failed"); }
  };

  return (
    <div className="max-w-4xl mx-auto px-6 py-12 space-y-8">
      <h1 className="font-display text-5xl">Friends</h1>

      <form onSubmit={sendRequest} className="glass rounded-3xl p-6 flex gap-3 items-center">
        <UserPlus size={28} weight="duotone" className="text-[#FCD34D]" />
        <input
          data-testid={FRIENDS.addInput}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Add by username"
          className="flex-1 bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-[#FCD34D]"
        />
        <button data-testid={FRIENDS.addBtn} disabled={busy} className="btn-gold !py-3">Send request</button>
      </form>

      {(incoming.length > 0 || outgoing.length > 0) && (
        <div className="glass rounded-3xl p-6">
          <div className="font-display text-2xl mb-3">Pending requests</div>
          {incoming.length > 0 && (
            <div className="mb-4">
              <div className="text-xs uppercase tracking-[0.3em] text-zinc-400 mb-2">Incoming</div>
              <div className="divide-y divide-white/5">
                {incoming.map((u) => (
                  <FriendRow
                    key={u.id} user={u} online={u.online}
                    right={(
                      <>
                        <button data-testid={FRIENDS.accept(u.friendship_id)} onClick={() => accept(u.friendship_id)} className="px-2 py-1 rounded bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30">
                          <CheckCircle size={16} weight="fill" />
                        </button>
                        <button data-testid={FRIENDS.decline(u.friendship_id)} onClick={() => decline(u.friendship_id)} className="px-2 py-1 rounded bg-red-500/20 text-red-300 hover:bg-red-500/30">
                          <XCircle size={16} weight="fill" />
                        </button>
                      </>
                    )}
                  />
                ))}
              </div>
            </div>
          )}
          {outgoing.length > 0 && (
            <div>
              <div className="text-xs uppercase tracking-[0.3em] text-zinc-400 mb-2">Sent</div>
              <div className="divide-y divide-white/5">
                {outgoing.map((u) => (
                  <FriendRow
                    key={u.id} user={u} online={u.online}
                    right={(
                      <button data-testid={FRIENDS.decline(u.friendship_id)} onClick={() => decline(u.friendship_id)} className="text-xs uppercase tracking-widest text-zinc-400 hover:text-white">
                        Cancel
                      </button>
                    )}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="glass rounded-3xl p-6">
        <div className="flex items-center justify-between mb-3">
          <div className="font-display text-2xl">Your friends</div>
          <div className="text-xs font-mono text-zinc-400">{friends.length}</div>
        </div>
        {friends.length === 0 ? (
          <div className="text-zinc-500 italic py-4">No friends yet — add someone by username above.</div>
        ) : (
          <div className="divide-y divide-white/5">
            {friends.map((u) => (
              <FriendRow
                key={u.id} user={u} online={u.online}
                right={(
                  <>
                    <Link to="/play/online" className="text-xs uppercase tracking-widest text-[#FCD34D] hover:underline inline-flex items-center gap-1">
                      <GameController size={14} weight="duotone" /> Invite
                    </Link>
                    <button data-testid={FRIENDS.remove(u.friendship_id)} onClick={() => remove(u.friendship_id)} className="px-2 py-1 rounded bg-zinc-800 text-zinc-300 hover:bg-red-500/20 hover:text-red-300">
                      <UserMinus size={16} weight="duotone" />
                    </button>
                  </>
                )}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
