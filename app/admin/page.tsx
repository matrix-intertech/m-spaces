import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/pages/DashboardShell";
import { RoleDashboard } from "@/components/pages/RoleDashboard";
import { dashboardPreset } from "@/components/pages/dashboardPresets";
import { getCurrentUser, getDashboardPayload } from "@/services/api";
import type { User } from "@/types";

export const metadata: Metadata = {
  title: "Admin Dashboard"
};

export default async function AdminDashboardPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const payload = await getDashboardPayload("admin", resolvedSearchParams);
  let user = (payload?.user as User | undefined) ?? null;

  if (!user) {
    user = await getCurrentUser();
  }

  if (!user) redirect("/login?redirect=/admin?tab=overview");

  const role = String(user.role ?? "").toLowerCase();
  if (role !== "admin" && role !== "support") {
    redirect("/");
  }

  const preset = dashboardPreset("admin", user);
  if (!payload) {
    return (
      <DashboardShell
        title={preset.title}
        subtitle="This dashboard could not be loaded from the backend JSON contract."
      />
    );
  }

  return <RoleDashboard user={user} payload={payload} {...preset} />;
}
