import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";

export default function Settings() {
  const { user, setUser } = useAuth();
  const [boardTheme, setBoardTheme] = useState("obsidian");
  const [pieceSet, setPieceSet] = useState("classic");
  const [sound, setSound] = useState(true);

  useEffect(() => {
    if (user) {
      setBoardTheme(user.board_theme || "obsidian");
      setPieceSet(user.piece_set || "classic");
      setSound(user.sound_enabled ?? true);
    }
  }, [user]);

  const save = async () => {
    try {
      const { data } = await api.put("/users/me", {
        board_theme: boardTheme, piece_set: pieceSet, sound_enabled: sound,
      });
      setUser(data);
      toast.success("Settings saved");
    } catch (e) { toast.error("Save failed"); }
  };

  return (
    <div className="max-w-3xl mx-auto px-6 py-12 space-y-8">
      <h1 className="font-display text-5xl">Settings</h1>

      <div className="glass rounded-3xl p-8 space-y-6">
        <Group title="Board theme">
          <div className="flex gap-3 flex-wrap">
            {["obsidian", "forest", "midnight", "ivory"].map((t) => (
              <button key={t} onClick={() => setBoardTheme(t)} className={`px-4 py-2 rounded-full uppercase tracking-widest text-xs border ${boardTheme === t ? "border-[#FCD34D] text-[#FCD34D]" : "border-white/10 text-zinc-400"}`}>{t}</button>
            ))}
          </div>
        </Group>
        <Group title="Piece set">
          <div className="flex gap-3 flex-wrap">
            {["classic", "modern", "neo"].map((t) => (
              <button key={t} onClick={() => setPieceSet(t)} className={`px-4 py-2 rounded-full uppercase tracking-widest text-xs border ${pieceSet === t ? "border-[#FCD34D] text-[#FCD34D]" : "border-white/10 text-zinc-400"}`}>{t}</button>
            ))}
          </div>
        </Group>
        <Group title="Sound effects">
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={sound} onChange={(e) => setSound(e.target.checked)} />
            <span className="text-sm text-zinc-300">Play sound on move &amp; check</span>
          </label>
        </Group>
        <button onClick={save} className="btn-gold">Save settings</button>
      </div>
    </div>
  );
}

function Group({ title, children }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-[0.3em] text-zinc-400 mb-3">{title}</div>
      {children}
    </div>
  );
}
