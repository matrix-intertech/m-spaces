import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { backendBaseUrl } from "@/lib/config";
import { getCurrentUser, getDashboardPayload } from "@/services/api";

export const metadata: Metadata = {
  title: "Complete Profile"
};

function value(input: unknown): string {
  return input === null || input === undefined ? "" : String(input);
}

export default async function CompleteProfilePage() {
  const [user, payload] = await Promise.all([getCurrentUser(), getDashboardPayload("complete-profile")]);
  if (!user) redirect("/login?redirect=/complete-profile");
  if (payload?.completed === true) redirect("/");
  const userRecord = user as unknown as Record<string, unknown>;

  return (
    <div className="container" style={{ display: "grid", gap: "1rem", padding: "2rem 0 3rem" }}>
      <section>
        <span className="ms-chip" style={{ color: "#b91c1c", background: "#fff1f2", borderColor: "#fecdd3" }}>Account setup</span>
        <h1 className="mt-3 text-4xl font-black text-slate-950">Complete profile</h1>
      </section>
      <form action={`${backendBaseUrl}/complete-profile`} method="POST" className="surface" style={{ display: "grid", gap: ".9rem", borderRadius: 8, padding: "1.25rem", maxWidth: 720 }}>
        <label className="grid gap-1.5 text-sm font-bold text-slate-700">Full name<input className="field" name="name" defaultValue={value(user.name || user.display_name || user.username)} required /></label>
        <label className="grid gap-1.5 text-sm font-bold text-slate-700">Email<input className="field" name="email" type="email" defaultValue={value(user.email)} required /></label>
        <label className="grid gap-1.5 text-sm font-bold text-slate-700">Company name<input className="field" name="agency_name" defaultValue={value(user.agency_name)} /></label>
        <label className="grid gap-1.5 text-sm font-bold text-slate-700">GST number<input className="field" name="gst_number" defaultValue={value(userRecord.gst_number)} /></label>
        <label className="grid gap-1.5 text-sm font-bold text-slate-700">RERA number<input className="field" name="rera_number" defaultValue={value(userRecord.rera_number)} /></label>
        <button className="btn btn-primary" type="submit">Complete profile</button>
      </form>
    </div>
  );
}
