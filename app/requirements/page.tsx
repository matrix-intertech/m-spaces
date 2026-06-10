import type { Metadata } from "next";
import Link from "next/link";
import { backendBaseUrl } from "@/lib/config";
import { formatDateTime } from "@/lib/format";
import { getCurrentUser, getRequirementsBoard } from "@/services/api";

export const metadata: Metadata = {
  title: "Requirements"
};

const propertyTypes = ["Office", "Warehouse", "Retail", "Coworking", "Bank Space", "Gym Space", "Villa", "Mansion", "Luxury Flat", "House", "Others"];

function read(value: unknown, fallback = "-") {
  return value === null || value === undefined || value === "" ? fallback : String(value);
}

function RequirementCard({ requirement }: { requirement: Record<string, unknown> }) {
  return (
    <article className="surface" style={{ borderRadius: 8, padding: "1rem" }}>
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <span className="ms-chip" style={{ color: "#b91c1c", background: "#fff1f2", borderColor: "#fecdd3" }}>
            {read(requirement.requirement_type, "Buy")}
          </span>
          <h2 className="mt-3 text-xl font-black text-slate-950">{read(requirement.property_type)} in {read(requirement.cities)}</h2>
          <p className="mt-1 text-sm font-medium text-slate-500">{read(requirement.locality, "Flexible locality")}</p>
        </div>
        <div className="text-left md:text-right">
          <p className="text-xs font-black uppercase tracking-wider text-slate-500">Budget</p>
          <p className="text-lg font-black text-slate-950">{read(requirement.budget, "Flexible")}</p>
        </div>
      </div>
      <dl className="mt-4 grid gap-2 border-t border-slate-100 pt-4 md:grid-cols-3">
        <div>
          <dt className="text-xs font-black uppercase tracking-wider text-slate-400">Min Size</dt>
          <dd className="text-sm font-bold text-slate-800">{read(requirement.min_size, "Flexible")}</dd>
        </div>
        <div>
          <dt className="text-xs font-black uppercase tracking-wider text-slate-400">Contact</dt>
          <dd className="text-sm font-bold text-slate-800">{read(requirement.contact_name || requirement.agency_name, "MatrixSpaces user")}</dd>
        </div>
        <div>
          <dt className="text-xs font-black uppercase tracking-wider text-slate-400">Posted</dt>
          <dd className="text-sm font-bold text-slate-800">{requirement.created_at ? formatDateTime(String(requirement.created_at)) : "-"}</dd>
        </div>
      </dl>
      {requirement.description ? <p className="mt-4 text-sm font-medium leading-6 text-slate-600">{String(requirement.description)}</p> : null}
    </article>
  );
}

function RequirementForm() {
  return (
    <form action={`${backendBaseUrl}/requirements/add`} method="POST" className="surface" style={{ display: "grid", gap: ".9rem", borderRadius: 8, padding: "1rem" }}>
      <div>
        <h2 className="text-xl font-black text-slate-950">Post Requirement</h2>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="grid gap-1.5 text-sm font-bold text-slate-700">
          <span>Target cities</span>
          <input className="field" name="cities" required placeholder="Noida, Delhi, Gurugram" />
        </label>
        <label className="grid gap-1.5 text-sm font-bold text-slate-700">
          <span>Locality</span>
          <input className="field" name="locality" placeholder="Sector, landmark, micro-market" />
        </label>
        <label className="grid gap-1.5 text-sm font-bold text-slate-700">
          <span>Property type</span>
          <select className="field" name="property_type" required defaultValue="Office">
            {propertyTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1.5 text-sm font-bold text-slate-700">
          <span>Requirement type</span>
          <select className="field" name="requirement_type" defaultValue="Buy">
            <option value="Buy">Buy</option>
            <option value="Rent">Rent</option>
            <option value="Lease">Lease</option>
          </select>
        </label>
        <label className="grid gap-1.5 text-sm font-bold text-slate-700">
          <span>Min size</span>
          <input className="field" name="min_size" placeholder="e.g. 2000 sq.ft" />
        </label>
        <label className="grid gap-1.5 text-sm font-bold text-slate-700">
          <span>Budget</span>
          <input className="field" name="budget" placeholder="e.g. 1.5 Cr or 2 L/month" />
        </label>
      </div>
      <label className="grid gap-1.5 text-sm font-bold text-slate-700">
        <span>Description</span>
        <textarea className="field" name="description" rows={4} placeholder="Use-case, preferred floor, handover timeline, frontage, parking..." />
      </label>
      <button className="btn btn-primary" type="submit">
        Post requirement
      </button>
    </form>
  );
}

export default async function RequirementsPage() {
  const [user, board] = await Promise.all([getCurrentUser(), getRequirementsBoard()]);

  return (
    <div className="container" style={{ display: "grid", gap: "1rem", padding: "2rem 0 3rem" }}>
      <section className="surface" style={{ borderRadius: 8, padding: "1.25rem" }}>
        <span className="ms-chip" style={{ color: "#b91c1c", background: "#fff1f2", borderColor: "#fecdd3" }}>
          Hot Requirements
        </span>
        <h1 className="mt-3 text-4xl font-black text-slate-950 md:text-5xl">Requirements</h1>
      </section>

      {user ? (
        <RequirementForm />
      ) : (
        <section className="surface" style={{ borderRadius: 8, padding: "1rem" }}>
          <p className="text-sm font-bold text-slate-700">Log in to post a new requirement.</p>
          <Link href="/login?redirect=/requirements" className="btn btn-secondary mt-3 inline-flex">
            Log in
          </Link>
        </section>
      )}

      {user && board.myRequirements.length ? (
        <section className="grid gap-3">
          <h2 className="text-2xl font-black text-slate-950">My Requirements</h2>
          {board.myRequirements.map((requirement) => (
            <RequirementCard key={String(requirement.id)} requirement={requirement} />
          ))}
        </section>
      ) : null}

      <section className="grid gap-3">
        <h2 className="text-2xl font-black text-slate-950">Active Board</h2>
        {board.requirements.length ? (
          board.requirements.map((requirement) => <RequirementCard key={String(requirement.id)} requirement={requirement} />)
        ) : (
          <div className="surface" style={{ borderRadius: 8, padding: "2rem", textAlign: "center" }}>
            <h2 className="text-xl font-black text-slate-950">No active requirements</h2>
          </div>
        )}
      </section>
    </div>
  );
}
