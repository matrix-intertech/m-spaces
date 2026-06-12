import type { Metadata } from "next";
import { renderDashboardPage } from "@/lib/dashboardPage";

export const metadata: Metadata = {
  title: "Dealer Dashboard"
};

export default async function DealerDashboardPage() {
  return renderDashboardPage("broker");
}
