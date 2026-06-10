import type { Metadata } from "next";
import { renderDashboardPage } from "@/lib/dashboardPage";

export const metadata: Metadata = {
  title: "Builder Dashboard"
};

export default async function BuilderDashboardPage() {
  return renderDashboardPage("builder");
}
