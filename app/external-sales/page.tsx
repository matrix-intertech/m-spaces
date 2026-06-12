import type { Metadata } from "next";
import { renderDashboardPage } from "@/lib/dashboardPage";

export const metadata: Metadata = {
  title: "External Sales Dashboard"
};

export default async function ExternalSalesDashboardPage() {
  return renderDashboardPage("sales");
}
