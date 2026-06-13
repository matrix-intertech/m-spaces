import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/LoginForm";

export const metadata: Metadata = {
  title: "Login",
  robots: {
    index: false,
    follow: false
  }
};

export default function LoginPage() {
  return (
    <div className="container" style={{ display: "flex", justifyContent: "center", padding: "2.5rem 0" }}>
      <LoginForm />
    </div>
  );
}
