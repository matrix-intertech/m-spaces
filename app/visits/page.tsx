import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser, getVisits } from "@/services/api";

export const metadata: Metadata = {
  title: "My Visits"
};

function value(input: unknown): string {
  return input === null || input === undefined ? "" : String(input);
}

export default async function VisitsPage() {
  const [user, visits] = await Promise.all([getCurrentUser(), getVisits()]);
  if (!user) redirect("/login?redirect=/visits");

  return (
    <div className="container" style={{ display: "grid", gap: "1.25rem", padding: "2rem 0 3rem" }}>
      <section className="surface" style={{ display: "grid", gap: ".6rem", borderRadius: 8, padding: "1.25rem" }}>
        <span className="ms-chip" style={{ color: "#7c2d12", background: "#fff7ed", borderColor: "#fed7aa" }}>Visit workflow</span>
        <h1 className="text-4xl font-black text-slate-950">My Visits</h1>
      </section>
      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {visits.length ? visits.map((item, index) => (
          <article key={String(item.id ?? index)} className="surface" style={{ borderRadius: 8, padding: "1rem" }}>
            <h2 className="text-lg font-black text-slate-950">{value(item.property_title) || `Visit #${value(item.id) || index + 1}`}</h2>
            <dl className="mt-4 grid gap-2 text-sm">
              {["status", "locality", "renter_name", "agent_name", "scheduled_at"].map((field) => (
                <div key={field} className="flex justify-between gap-3 border-t border-slate-100 pt-2">
                  <dt className="font-bold text-slate-500">{field.replace(/_/g, " ")}</dt>
                  <dd className="max-w-[58%] truncate text-right font-semibold text-slate-800">{value(item[field]) || "-"}</dd>
                </div>
              ))}
            </dl>
          </article>
        )) : (
          <div className="surface" style={{ borderRadius: 8, padding: "2rem", textAlign: "center" }}>
            <h2 className="text-xl font-black text-slate-950">No visits scheduled</h2>
            <p className="text-sm font-medium text-slate-500">Visit requests will appear here once scheduled.</p>
          </div>
        )}
      </section>
    </div>
  );
}
