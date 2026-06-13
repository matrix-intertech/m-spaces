import type { Metadata } from "next";
import { renderDashboardPage } from "@/lib/dashboardPage";

export const metadata: Metadata = {
  title: "Broker Dashboard",
  robots: {
    index: false,
    follow: false
  }
};

export default async function BrokerDashboardPage() {
  return renderDashboardPage("broker");
}
