import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/LoginForm";
import { getCurrentUser } from "@/services/api";

export const metadata: Metadata = {
  title: "Login",
  robots: {
    index: false,
    follow: false
  }
};

function safeRedirectPath(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  const normalized = String(raw || "").trim();
  if (!normalized.startsWith("/") || normalized.startsWith("//")) return "";
  return normalized;
}

function loginRedirectPath(roleValue: unknown) {
  const role = String(roleValue || "").toLowerCase();
  if (role === "admin" || role === "support") return "/admin?tab=overview";
  if (role === "builder") return "/builder";
  if (role === "broker") return "/broker";
  if (role === "dealer") return "/dealer";
  if (role === "agent") return "/agent";
  if (role === "external_sales") return "/sales";
  if (role === "corporate" || role === "corporate_user") return "/corporate";
  return "/";
}

export default async function LoginPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [user, resolvedSearchParams] = await Promise.all([getCurrentUser(), searchParams]);
  if (user) {
    redirect(safeRedirectPath(resolvedSearchParams?.redirect) || loginRedirectPath(user.role));
  }

  return (
    <div className="container" style={{ display: "flex", justifyContent: "center", padding: "2.5rem 0" }}>
      <LoginForm />
    </div>
  );
}
