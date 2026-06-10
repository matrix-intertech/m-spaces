import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/pages/DashboardShell";
import { RoleDashboard } from "@/components/pages/RoleDashboard";
import { dashboardPreset, type DashboardKind } from "@/components/pages/dashboardPresets";
import { getCurrentUser, getDashboardPayload } from "@/services/api";

export async function renderDashboardPage(kind: DashboardKind) {
  const [user, payload] = await Promise.all([getCurrentUser(), getDashboardPayload(kind)]);
  if (!user) redirect(`/login?redirect=/${kind}`);

  const preset = dashboardPreset(kind, user);
  if (!payload) {
    return (
      <DashboardShell
        title={preset.title}
        subtitle="This dashboard could not be loaded from the backend JSON contract. Check the signed-in role and backend server."
      />
    );
  }

  return <RoleDashboard user={user} payload={payload} {...preset} />;
}
