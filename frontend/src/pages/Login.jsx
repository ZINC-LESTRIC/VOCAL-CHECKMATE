import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { AUTH } from "@/constants/testIds";
import { formatApiErrorDetail } from "@/lib/api";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr("");
    try {
      await login(email, password);
      navigate("/dashboard");
    } catch (e) {
      setErr(formatApiErrorDetail(e?.response?.data?.detail) || e.message);
    } finally { setBusy(false); }
  };

  return (
    <div className="max-w-md mx-auto px-6 py-16">
      <h1 className="font-display text-5xl mb-2">Welcome back</h1>
      <p className="text-zinc-400 mb-10">Sign in to continue your game.</p>
      <form onSubmit={submit} className="glass rounded-3xl p-8 space-y-5">
        <div>
          <label className="block text-xs uppercase tracking-[0.3em] text-zinc-400 mb-2">Email</label>
          <input
            data-testid={AUTH.loginEmail}
            type="email" required value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 focus:border-[#FCD34D] outline-none"
          />
        </div>
        <div>
          <label className="block text-xs uppercase tracking-[0.3em] text-zinc-400 mb-2">Password</label>
          <input
            data-testid={AUTH.loginPassword}
            type="password" required value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 focus:border-[#FCD34D] outline-none"
          />
        </div>
        {err && <div data-testid={AUTH.authError} className="text-red-400 text-sm">{err}</div>}
        <button type="submit" disabled={busy} data-testid={AUTH.loginSubmit} className="btn-gold w-full disabled:opacity-50">
          {busy ? "Signing in…" : "Sign in"}
        </button>
        <p className="text-center text-sm text-zinc-400">
          New here? <Link to="/register" className="text-[#FCD34D]">Create an account</Link>
        </p>
      </form>
    </div>
  );
}
