import type { Metadata } from "next";
import Link from "next/link";
import { backendBaseUrl } from "@/lib/config";

export const metadata: Metadata = {
  title: "Forgot Password"
};

export default function ForgotPasswordPage() {
  return (
    <div className="container" style={{ maxWidth: 540, padding: "2.5rem 0" }}>
      <form action={`${backendBaseUrl}/forgot-password`} method="post" className="surface" style={{ borderRadius: 8, padding: "1.25rem", display: "grid", gap: ".9rem" }}>
        <h1 style={{ margin: 0 }}>Forgot password</h1>
        <p style={{ margin: 0, color: "var(--ms-muted)" }}>The reset email is sent by the existing Express email workflow.</p>
        <label>
          <span style={{ display: "block", marginBottom: ".3rem", fontWeight: 700 }}>Email</span>
          <input className="field" name="email" type="email" autoComplete="email" required />
        </label>
        <button className="btn btn-primary" type="submit">
          Send reset link
        </button>
        <Link href="/login" style={{ color: "var(--ms-muted)", fontWeight: 700 }}>
          Back to login
        </Link>
      </form>
    </div>
  );
}
