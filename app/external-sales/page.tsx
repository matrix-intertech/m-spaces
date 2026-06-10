import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "External Sales Dashboard"
};

export default async function ExternalSalesDashboardPage() {
  redirect("/sales");
}
