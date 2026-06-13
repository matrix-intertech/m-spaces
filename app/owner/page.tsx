import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { OwnerDashboard } from "@/components/pages/OwnerDashboard";
import { getCurrentUser, getOwnerDashboard } from "@/services/api";

export const metadata: Metadata = {
  title: "Owner Dashboard",
  robots: {
    index: false,
    follow: false
  }
};

export default async function OwnerDashboardPage() {
  const [user, dashboard] = await Promise.all([getCurrentUser(), getOwnerDashboard()]);
  if (!user) redirect("/login?redirect=/owner");
  if (!dashboard) redirect("/login?redirect=/owner");
  return <OwnerDashboard {...dashboard} />;
}
