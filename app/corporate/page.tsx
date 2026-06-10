import type { Metadata } from "next";
import { renderDashboardPage } from "@/lib/dashboardPage";

export const metadata: Metadata = {
  title: "Corporate Dashboard"
};

export default async function CorporateDashboardPage() {
  return renderDashboardPage("corporate");
}
