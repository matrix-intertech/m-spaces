import type { Metadata } from "next";
import { renderDashboardPage } from "@/lib/dashboardPage";

export const metadata: Metadata = {
  title: "Sales Dashboard",
  robots: {
    index: false,
    follow: false
  }
};

export default async function SalesDashboardPage() {
  return renderDashboardPage("sales");
}
