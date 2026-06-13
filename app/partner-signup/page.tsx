import type { Metadata } from "next";
import { PartnerSignupForm } from "@/components/auth/PartnerSignupForm";
import { getCurrentUser } from "@/services/api";

export const metadata: Metadata = {
  title: "Partner Signup",
  description: "Apply to join MatrixSpaces as a builder, broker, dealer, agent, or sales partner.",
  alternates: {
    canonical: "/partner-signup"
  }
};

type PartnerRole = "builder" | "broker" | "external_sales";

function normalizeRole(value: string | undefined): PartnerRole {
  if (value === "broker" || value === "external_sales" || value === "builder") return value;
  return "builder";
}

export default async function PartnerSignupPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [user, params] = await Promise.all([getCurrentUser(), searchParams]);

  const tab = Array.isArray(params.tab) ? params.tab[0] : params.tab;
  const ref = Array.isArray(params.ref) ? params.ref[0] : params.ref;
  const error = Array.isArray(params.error) ? params.error[0] : params.error;
  const loggedInMessage = "You are already signed up. Kindly log out to continue.";
  const resolvedError = user ? loggedInMessage : (error ?? "");

  return (
    <main className="flex-grow flex items-center justify-center py-10 px-3 animate-fade-in-up">
      <PartnerSignupForm initialRole={normalizeRole(tab)} refCode={ref ?? ""} initialError={resolvedError} />
    </main>
  );
}
