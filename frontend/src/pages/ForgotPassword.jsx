import { useState } from "react";
import { Link } from "react-router-dom";
import api from "@/lib/api";
import { formatApiErrorDetail } from "@/lib/api";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [err, setErr] = useState("");
  const [success, setSuccess] = useState("");
  const [resetLink, setResetLink] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErr("");
    setSuccess("");
    setResetLink("");
    try {
      const { data } = await api.post("/auth/forgot-password", { email });
      setSuccess(data.message || "If an account with that email exists, a reset link has been generated.");
      if (data.reset_link) {
        setResetLink(data.reset_link);
      }
    } catch (e) {
      setErr(formatApiErrorDetail(e?.response?.data?.detail) || e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-6 py-16">
      <h1 className="font-display text-5xl mb-2">Forgot password</h1>
      <p className="text-zinc-400 mb-10">Enter your email and we will generate a reset link.</p>
      <form onSubmit={submit} className="glass rounded-3xl p-8 space-y-5">
        <div>
          <label className="block text-xs uppercase tracking-[0.3em] text-zinc-400 mb-2">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 focus:border-[#FCD34D] outline-none"
          />
        </div>
        {err && <div className="text-red-400 text-sm">{err}</div>}
        {success && (
          <div className="text-green-400 text-sm space-y-2">
            <p>{success}</p>
            {resetLink && (
              <p>
                <Link to={resetLink} className="text-[#FCD34D] underline">
                  Click here to reset your password
                </Link>
              </p>
            )}
          </div>
        )}
        <button type="submit" disabled={busy} className="btn-gold w-full disabled:opacity-50">
          {busy ? "Sending…" : "Send reset link"}
        </button>
        <p className="text-center text-sm text-zinc-400">
          Remember your password? <Link to="/login" className="text-[#FCD34D]">Sign in</Link>
        </p>
      </form>
    </div>
  );
}
