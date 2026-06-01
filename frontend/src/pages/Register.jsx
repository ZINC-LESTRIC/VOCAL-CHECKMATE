import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { AUTH } from "@/constants/testIds";
import { formatApiErrorDetail } from "@/lib/api";

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr("");
    try {
      await register(email, password, username);
      navigate("/dashboard");
    } catch (e) {
      setErr(formatApiErrorDetail(e?.response?.data?.detail) || e.message);
    } finally { setBusy(false); }
  };

  return (
    <div className="max-w-md mx-auto px-6 py-16">
      <h1 className="font-display text-5xl mb-2">Create account</h1>
      <p className="text-zinc-400 mb-10">Join the board. Speak your moves.</p>
      <form onSubmit={submit} className="glass rounded-3xl p-8 space-y-5">
        <div>
          <label className="block text-xs uppercase tracking-[0.3em] text-zinc-400 mb-2">Email</label>
          <input
            data-testid={AUTH.registerEmail}
            type="email" required value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 focus:border-[#FCD34D] outline-none"
          />
        </div>
        <div>
          <label className="block text-xs uppercase tracking-[0.3em] text-zinc-400 mb-2">Username</label>
          <input
            data-testid={AUTH.registerUsername}
            type="text" required minLength={3} maxLength={24} value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 focus:border-[#FCD34D] outline-none"
          />
        </div>
        <div>
          <label className="block text-xs uppercase tracking-[0.3em] text-zinc-400 mb-2">Password</label>
          <input
            data-testid={AUTH.registerPassword}
            type="password" required minLength={6} value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 focus:border-[#FCD34D] outline-none"
          />
        </div>
        {err && <div data-testid={AUTH.authError} className="text-red-400 text-sm">{err}</div>}
        <button type="submit" disabled={busy} data-testid={AUTH.registerSubmit} className="btn-gold w-full disabled:opacity-50">
          {busy ? "Creating account…" : "Create account"}
        </button>
        <p className="text-center text-sm text-zinc-400">
          Already have an account? <Link to="/login" className="text-[#FCD34D]">Sign in</Link>
        </p>
      </form>
    </div>
  );
}
