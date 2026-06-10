import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { backendBaseUrl } from "@/lib/config";
import { getCurrentUser, getNotifications } from "@/services/api";

export const metadata: Metadata = {
  title: "Notifications"
};

function value(input: unknown): string {
  return input === null || input === undefined ? "" : String(input);
}

export default async function NotificationsPage() {
  const [user, notifications] = await Promise.all([getCurrentUser(), getNotifications()]);
  if (!user) redirect("/login?redirect=/notifications");

  return (
    <div className="container" style={{ display: "grid", gap: "1.25rem", padding: "2rem 0 3rem" }}>
      <section className="surface" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", borderRadius: 8, padding: "1.25rem" }}>
        <div>
          <span className="ms-chip" style={{ color: "#b91c1c", background: "#fff1f2", borderColor: "#fecdd3" }}>Updates</span>
          <h1 className="mt-3 text-4xl font-black text-slate-950">Notifications</h1>
        </div>
        <form action={`${backendBaseUrl}/notifications/mark-read`} method="POST">
          <button className="btn btn-secondary" type="submit">Mark all read</button>
        </form>
      </section>

      <section className="grid gap-3">
        {notifications.length ? notifications.map((item, index) => {
          const href = value(item.link) || "/notifications";
          return (
            <Link key={String(item.id ?? index)} href={href} className="surface" style={{ display: "grid", gap: ".25rem", borderRadius: 8, padding: "1rem" }}>
              <strong className="text-slate-950">{value(item.content) || "Notification"}</strong>
              <span className="text-sm font-medium text-slate-500">{value(item.created_at)}</span>
            </Link>
          );
        }) : (
          <div className="surface" style={{ borderRadius: 8, padding: "2rem", textAlign: "center" }}>
            <h2 className="text-xl font-black text-slate-950">No notifications yet</h2>
            <p className="text-sm font-medium text-slate-500">New chat, visit, and platform updates will appear here.</p>
          </div>
        )}
      </section>
    </div>
  );
}
