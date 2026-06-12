import type { Metadata } from "next";
import { renderDashboardPage } from "@/lib/dashboardPage";

export const metadata: Metadata = {
  title: "Agent Dashboard"
};

export default async function AgentDashboardPage() {
  return renderDashboardPage("broker");
}
