import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { renderDashboardPage } from "@/lib/dashboardPage";
import { getCurrentUser } from "@/services/api";

export const metadata: Metadata = {
  title: "Admin Dashboard"
};

export default async function AdminDashboardPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login?redirect=/admin");
  }
  if (String(user.role ?? "").toLowerCase() !== "admin") {
    return (
      <div style={{ minHeight: "70vh", display: "grid", placeItems: "center", padding: "2rem" }}>
        <div style={{ maxWidth: 560, textAlign: "center", border: "1px solid #e5e7eb", borderRadius: 12, padding: "1.25rem", background: "#fff" }}>
          <h1 style={{ margin: 0, fontSize: "1.6rem", fontWeight: 900, color: "#111827" }}>403 Forbidden</h1>
          <p style={{ margin: ".75rem 0 0", color: "#4b5563", fontWeight: 600 }}>You do not have permission to access the admin dashboard.</p>
        </div>
      </div>
    );
  }
  return renderDashboardPage("admin");
}
