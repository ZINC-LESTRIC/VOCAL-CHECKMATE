import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { api, formatApiErrorDetail } from "@/lib/api";
import { PROFILE } from "@/constants/testIds";
import { Camera } from "@phosphor-icons/react";

export default function Profile() {
  const { user, setUser } = useAuth();
  const [form, setForm] = useState({ username: "", name: "", bio: "", country: "", avatar: "" });
  const [pwd, setPwd] = useState({ current_password: "", new_password: "" });
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    if (user) setForm({
      username: user.username || "",
      name: user.name || "",
      bio: user.bio || "",
      country: user.country || "",
      avatar: user.avatar || "",
    });
  }, [user]);

  const onAvatar = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1500000) {
      toast.error("Image too large (max 1.5MB).");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setForm((f) => ({ ...f, avatar: reader.result }));
    reader.readAsDataURL(file);
  };

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { data } = await api.put("/users/me", form);
      setUser(data);
      toast.success("Profile saved");
    } catch (err) {
      toast.error(formatApiErrorDetail(err?.response?.data?.detail) || "Save failed");
    } finally { setBusy(false); }
  };

  const changePwd = async (e) => {
    e.preventDefault();
    try {
      await api.post("/users/me/password", pwd);
      toast.success("Password changed");
      setPwd({ current_password: "", new_password: "" });
    } catch (err) {
      toast.error(formatApiErrorDetail(err?.response?.data?.detail) || "Failed");
    }
  };

  if (!user) return null;

  return (
    <div className="max-w-4xl mx-auto px-6 py-12 space-y-10">
      <h1 className="font-display text-5xl">Your profile</h1>

      <form onSubmit={save} className="glass rounded-3xl p-8 space-y-6">
        <div className="flex items-center gap-6">
          <div className="relative">
            {form.avatar ? (
              <img src={form.avatar} alt="avatar" className="h-24 w-24 rounded-full object-cover border border-[#FCD34D]/40" />
            ) : (
              <div className="h-24 w-24 rounded-full bg-zinc-900 border border-white/10 flex items-center justify-center text-3xl text-[#FCD34D]">
                {(form.username || "?")[0].toUpperCase()}
              </div>
            )}
            <button type="button" onClick={() => fileRef.current?.click()} className="absolute -bottom-2 -right-2 bg-[#FCD34D] text-black rounded-full p-2">
              <Camera size={18} weight="fill" />
            </button>
            <input data-testid={PROFILE.avatar} ref={fileRef} type="file" accept="image/*" hidden onChange={onAvatar} />
          </div>
          <div>
            <div className="font-display text-3xl">{user.username}</div>
            <div className="font-mono text-[#FCD34D]">Rating · {user.rating}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Username" testid={PROFILE.username} value={form.username} onChange={(v) => setForm({ ...form, username: v })} />
          <Field label="Display name" testid={PROFILE.name} value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
          <Field label="Country" testid={PROFILE.country} value={form.country} onChange={(v) => setForm({ ...form, country: v })} />
          <Field label="Email" value={user.email} disabled />
        </div>
        <div>
          <label className="block text-xs uppercase tracking-[0.3em] text-zinc-400 mb-2">Bio</label>
          <textarea
            data-testid={PROFILE.bio}
            rows={3} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })}
            className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-[#FCD34D]"
          />
        </div>
        <button data-testid={PROFILE.save} disabled={busy} className="btn-gold">{busy ? "Saving…" : "Save profile"}</button>
      </form>

      <form onSubmit={changePwd} className="glass rounded-3xl p-8 space-y-4">
        <div className="font-display text-2xl">Change password</div>
        <Field label="Current password" type="password" value={pwd.current_password} onChange={(v) => setPwd({ ...pwd, current_password: v })} />
        <Field label="New password" type="password" value={pwd.new_password} onChange={(v) => setPwd({ ...pwd, new_password: v })} />
        <button className="btn-ghost">Update password</button>
      </form>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", disabled, testid }) {
  return (
    <div>
      <label className="block text-xs uppercase tracking-[0.3em] text-zinc-400 mb-2">{label}</label>
      <input
        data-testid={testid}
        type={type} value={value} disabled={disabled}
        onChange={(e) => onChange && onChange(e.target.value)}
        className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-[#FCD34D] disabled:opacity-50"
      />
    </div>
  );
}
