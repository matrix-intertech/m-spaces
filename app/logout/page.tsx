import type { Metadata } from "next";
import LogoutForm from "./LogoutForm";

export const metadata: Metadata = {
  title: "Logout"
};

export default function LogoutPage() {
  return (
    <div className="container" style={{ maxWidth: 560, padding: "2.5rem 0" }}>
      <div className="surface" style={{ borderRadius: 14, padding: "1.4rem", display: "grid", gap: "1rem" }}>
        <div style={{ display: "grid", gap: ".4rem" }}>
          <h1 style={{ margin: 0, fontSize: "1.8rem" }}>Log out of MatrixSpaces?</h1>
          <p style={{ margin: 0, color: "var(--ms-muted)", fontWeight: 600 }}>
            Confirm logout to sign out from this device. If you continue, the public site will open normally with the main navbar and footer.
          </p>
        </div>
        <LogoutForm />
      </div>
    </div>
  );
}
