import type { Metadata } from "next";
import { backendBaseUrl } from "@/lib/config";

export const metadata: Metadata = {
  title: "Reset Password"
};

export default async function ResetPasswordPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  return (
    <div className="container" style={{ maxWidth: 520, padding: "2.5rem 0" }}>
      <form action={`${backendBaseUrl}/reset-password/${token}`} method="post" className="surface" style={{ borderRadius: 8, padding: "1.25rem", display: "grid", gap: ".9rem" }}>
        <h1 style={{ margin: 0 }}>Reset password</h1>
        <input className="field" name="password" type="password" autoComplete="new-password" minLength={8} required />
        <button className="btn btn-primary" type="submit">
          Save new password
        </button>
      </form>
    </div>
  );
}
