import type { Metadata } from "next";
import { renderDashboardPage } from "@/lib/dashboardPage";

export const metadata: Metadata = {
  title: "Broker Dashboard"
};

export default async function BrokerDashboardPage() {
  return renderDashboardPage("broker");
}
