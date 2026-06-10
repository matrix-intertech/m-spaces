import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Camera } from "lucide-react";
import { backendBaseUrl } from "@/lib/config";
import { assetPath } from "@/lib/format";
import { getCurrentUser, getDashboardPayload } from "@/services/api";

export const metadata: Metadata = {
  title: "Profile"
};

function value(input: unknown): string {
  return input === null || input === undefined ? "" : String(input);
}

function asRecords(input: unknown): Array<Record<string, unknown>> {
  return Array.isArray(input) ? input.filter((item): item is Record<string, unknown> => item !== null && typeof item === "object" && !Array.isArray(item)) : [];
}

export default async function ProfilePage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = searchParams ? await searchParams : {};
  const [user, payload] = await Promise.all([getCurrentUser(), getDashboardPayload("profile")]);
  if (!user) redirect("/login?redirect=/profile");
  const usernameError = Array.isArray(params.usernameError) ? params.usernameError[0] : params.usernameError;
  const phoneError = Array.isArray(params.phoneError) ? params.phoneError[0] : params.phoneError;
  const profileError = Array.isArray(params.error) ? params.error[0] : params.error;

  const profile = payload?.user ?? user;
  const profileRecord = profile as unknown as Record<string, unknown>;
  const avatar = assetPath(value(profile.avatar_url) || "/assets/no-photo.svg", "/assets/no-photo.svg");
  const cover = assetPath(value(profileRecord.cover_url) || "/assets/home.png", "/assets/home.png");
  const referredUsers = asRecords(payload?.referredUsers);
  const withdrawals = asRecords(payload?.withdrawals);
  const role = String(profile.role ?? "").toLowerCase();
  const isPartnerProfile = ["builder", "broker", "external_sales", "dealer", "agent", "corporate", "corporate_user"].includes(role);
  const portfolioHref = profile.username ? `/portfolio/${encodeURIComponent(String(profile.username))}` : null;

  return (
    <div className="container" style={{ display: "grid", gap: "1.25rem", padding: "2rem 0 3rem" }}>
      <section className="surface" style={{ display: "grid", gap: "1.1rem", borderRadius: 8, padding: "1.5rem" }}>
        <div>
          <span className="ms-chip" style={{ color: "#b91c1c", background: "#fff1f2", borderColor: "#fecdd3" }}>{profile.role || "member"}</span>
          <h1 className="mt-3 text-4xl font-black text-slate-950">Profile</h1>
        </div>
        <div className="grid gap-4">
          <div className="relative overflow-hidden rounded-xl border border-slate-200">
            <img src={cover} alt="Cover" className="h-52 w-full object-cover md:h-72" />
            <label htmlFor="profile-cover-photo" className="absolute right-3 top-3 inline-flex cursor-pointer items-center gap-1 rounded-md bg-black/50 px-2 py-1 text-xs font-bold text-white backdrop-blur">
              <Camera size={14} aria-hidden />
              Edit cover
            </label>
          </div>
          <div className="relative -mt-16 ml-5 h-32 w-32 overflow-hidden rounded-full border-4 border-white shadow-xl md:h-40 md:w-40">
            <img src={avatar} alt="Profile" className="h-full w-full object-cover" />
            <label htmlFor="profile-avatar-photo" className="absolute inset-0 grid cursor-pointer place-items-center bg-black/40 text-white opacity-0 transition-opacity hover:opacity-100">
              <Camera size={22} aria-hidden />
            </label>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {[
            ["Name", profile.name || profile.display_name || profile.username],
            ["Email", profile.email],
            ["Phone", profile.phone],
            ["Account", profile.account_number],
            ["Company", profile.agency_name],
            ["Locality", profile.locality]
          ].map(([label, item]) => (
            <div key={label} className="rounded-lg border border-slate-200 bg-white p-4">
              <p className="text-xs font-black uppercase tracking-wider text-slate-500">{label}</p>
              <strong className="mt-1 block truncate text-slate-950">{value(item) || "-"}</strong>
            </div>
          ))}
        </div>
        {isPartnerProfile && portfolioHref ? (
          <div style={{ display: "flex", justifyContent: "flex-start" }}>
            <Link href={portfolioHref} className="btn btn-secondary">
              Show Portfolio
            </Link>
          </div>
        ) : null}
      </section>

      <form action={`${backendBaseUrl}/edit-profile`} method="POST" encType="multipart/form-data" className="surface" style={{ display: "grid", gap: ".9rem", borderRadius: 8, padding: "1.25rem" }}>
        <h2 className="text-xl font-black text-slate-950">Edit Profile</h2>
        {profileError ? <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-bold text-red-700">{profileError}</div> : null}
        <div className="grid gap-3 md:grid-cols-2">
          <label className="grid gap-1.5 text-sm font-bold text-slate-700">Name<input className="field" name="name" defaultValue={value(profile.name)} /></label>
          <label className="grid gap-1.5 text-sm font-bold text-slate-700">
            Username
            <input className="field" name="username" defaultValue={value(profile.username)} />
            {usernameError ? <span className="text-xs font-bold text-red-600">{usernameError}</span> : null}
          </label>
          <label className="grid gap-1.5 text-sm font-bold text-slate-700">Email<input className="field" name="email" type="email" defaultValue={value(profile.email)} /></label>
          <label className="grid gap-1.5 text-sm font-bold text-slate-700">
            Phone
            <input className="field" name="phone" type="tel" defaultValue={value(profile.phone)} />
            {phoneError ? <span className="text-xs font-bold text-red-600">{phoneError}</span> : null}
          </label>
          <label className="grid gap-1.5 text-sm font-bold text-slate-700">City<input className="field" name="city" defaultValue={value(profile.city)} /></label>
          <label className="grid gap-1.5 text-sm font-bold text-slate-700">Locality<input className="field" name="locality" defaultValue={value(profile.locality)} /></label>
          <label className="grid gap-1.5 text-sm font-bold text-slate-700">Company<input className="field" name="agency_name" defaultValue={value(profile.agency_name)} /></label>
          <label className="grid gap-1.5 text-sm font-bold text-slate-700">Website<input className="field" name="company_website" defaultValue={value(profileRecord.company_website)} /></label>
          <label className="grid gap-1.5 text-sm font-bold text-slate-700">Profile photo<input id="profile-avatar-photo" className="field" name="profile_photo" type="file" accept="image/*" /></label>
          <label className="grid gap-1.5 text-sm font-bold text-slate-700">Cover photo<input id="profile-cover-photo" className="field" name="cover_photo" type="file" accept="image/*" /></label>
        </div>
        <label className="grid gap-1.5 text-sm font-bold text-slate-700">About<textarea className="field" name="about" rows={4} defaultValue={value(profileRecord.about)} /></label>
        <button className="btn btn-primary" type="submit">Save profile</button>
      </form>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="surface" style={{ borderRadius: 8, padding: "1rem" }}>
          <h2 className="text-xl font-black text-slate-950">Referrals</h2>
          <p className="text-sm font-medium text-slate-500">{value(profileRecord.referral_code)}</p>
          <div className="mt-4 grid gap-2">
            {referredUsers.length ? referredUsers.slice(0, 8).map((item, index) => (
              <div key={String(item.id ?? index)} className="rounded-lg border border-slate-200 p-3 text-sm">
                <strong>{value(item.username) || "Referred user"}</strong>
                <p className="text-slate-500">{value(item.role)} {value(item.status) ? `- ${value(item.status)}` : ""}</p>
              </div>
            )) : <p className="text-sm font-medium text-slate-500">No referred users yet.</p>}
          </div>
        </article>
        <article className="surface" style={{ borderRadius: 8, padding: "1rem" }}>
          <h2 className="text-xl font-black text-slate-950">Withdrawals</h2>
          <div className="mt-4 grid gap-2">
            {withdrawals.length ? withdrawals.slice(0, 8).map((item, index) => (
              <div key={String(item.id ?? index)} className="rounded-lg border border-slate-200 p-3 text-sm">
                <strong>{value(item.amount) || "Withdrawal"}</strong>
                <p className="text-slate-500">{value(item.status)} {value(item.created_at) ? `- ${value(item.created_at)}` : ""}</p>
              </div>
            )) : <p className="text-sm font-medium text-slate-500">No withdrawals yet.</p>}
          </div>
        </article>
      </section>
    </div>
  );
}
