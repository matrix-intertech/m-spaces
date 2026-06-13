import type { Metadata } from "next";
import { backendBaseUrl } from "@/lib/config";
import { LockKeyhole } from "lucide-react";

export const metadata: Metadata = {
  title: "Two-Factor Authentication"
};

export default function Login2FAPage() {
  return (
    <div className="container" style={{ display: "flex", justifyContent: "center", padding: "2.5rem 0" }}>
      <div style={{ width: "100%", maxWidth: 448, border: "1px solid #f1f5f9", borderRadius: 16, background: "white", boxShadow: "0 22px 60px rgba(15, 23, 42, 0.14)", padding: "2rem" }}>
        <div style={{ display: "grid", justifyItems: "center", gap: ".75rem", marginBottom: "1.5rem", textAlign: "center" }}>
          <div style={{ display: "grid", width: 64, height: 64, placeItems: "center", borderRadius: 999, background: "#eff6ff", color: "#2563eb" }}>
            <LockKeyhole size={32} aria-hidden />
          </div>
          <h1 style={{ margin: 0, color: "#0f172a", fontSize: "1.5rem", fontWeight: 900 }}>Two-Factor Authentication</h1>
          <p style={{ margin: 0, color: "#64748b", fontSize: ".9rem" }}>Enter the 6-digit code from your app or a recovery code.</p>
        </div>
        <form action={`${backendBaseUrl}/login/2fa`} method="post" style={{ display: "grid", gap: "1.25rem" }}>
          <label className="grid gap-1.5 text-sm font-bold text-slate-700">
            Authentication code
            <input name="token" inputMode="numeric" autoComplete="one-time-code" placeholder="Code" aria-describedby="two-factor-help" autoFocus required style={{ width: "100%", border: "1px solid #cbd5e1", borderRadius: 12, padding: "1rem", textAlign: "center", fontFamily: "monospace", fontSize: "1.5rem", letterSpacing: ".18em", outline: "none" }} />
          </label>
          <p id="two-factor-help" className="text-xs font-semibold text-slate-500">Enter the current code from your authenticator app.</p>
          <button type="submit" style={{ border: 0, borderRadius: 12, background: "#0f172a", color: "white", cursor: "pointer", fontWeight: 800, padding: ".85rem", boxShadow: "0 12px 30px rgba(15,23,42,.14)" }}>
            Verify Login
          </button>
        </form>
        <div style={{ marginTop: "1.5rem", textAlign: "center" }}>
          <a href="/login" style={{ color: "#94a3b8", fontSize: ".9rem", fontWeight: 800 }}>Back to Login</a>
        </div>
      </div>
    </div>
  );
}
