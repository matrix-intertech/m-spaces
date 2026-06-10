import type { Metadata } from "next";
import LogoutForm from "./LogoutForm";

export const metadata: Metadata = {
  title: "Logout"
};

export default function LogoutPage() {
  return (
    <div className="container" style={{ maxWidth: 520, padding: "2.5rem 0" }}>
      <div className="surface" style={{ borderRadius: 8, padding: "1.25rem", display: "grid", gap: ".9rem" }}>
        <h1 style={{ margin: 0 }}>Log out of MatrixSpaces?</h1>
        <p style={{ margin: 0, color: "var(--ms-muted)" }}>
          You will be signed out from this device and need to log in again to access your dashboard.
        </p>
        <LogoutForm />
      </div>
    </div>
  );
}
