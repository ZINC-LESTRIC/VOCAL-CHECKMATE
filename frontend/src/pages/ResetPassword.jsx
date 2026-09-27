import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api, formatApiErrorDetail } from "@/lib/api";

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    setSuccess("");

    if (password !== confirm) {
      setErr("Passwords do not match");
      return;
    }
    if (password.length < 6) {
      setErr("Password must be at least 6 characters");
      return;
    }
    if (!token) {
      setErr("Invalid or missing reset token");
      return;
    }

    setBusy(true);
    try {
      const { data } = await api.post("/auth/reset-password", {
        token,
        new_password: password,
      });
      setSuccess(data.message || "Password reset successfully!");
      setTimeout(() => navigate("/login"), 2000);
    } catch (e) {
      setErr(formatApiErrorDetail(e?.response?.data?.detail) || e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-6 py-16">
      <h1 className="font-display text-5xl mb-2">Reset password</h1>
      <p className="text-zinc-400 mb-10">Enter your new password below.</p>
      <form onSubmit={submit} className="glass rounded-3xl p-8 space-y-5">
        <div>
          <label className="block text-xs uppercase tracking-[0.3em] text-zinc-400 mb-2">New password</label>
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 focus:border-[#FCD34D] outline-none"
          />
        </div>
        <div>
          <label className="block text-xs uppercase tracking-[0.3em] text-zinc-400 mb-2">Confirm password</label>
          <input
            type="password"
            required
            minLength={6}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 focus:border-[#FCD34D] outline-none"
          />
        </div>
        {err && <div className="text-red-400 text-sm">{err}</div>}
        {success && <div className="text-green-400 text-sm">{success}</div>}
        <button type="submit" disabled={busy} className="btn-gold w-full disabled:opacity-50">
          {busy ? "Resetting…" : "Reset password"}
        </button>
        <p className="text-center text-sm text-zinc-400">
          <Link to="/login" className="text-[#FCD34D]">Back to sign in</Link>
        </p>
      </form>
    </div>
  );
}
