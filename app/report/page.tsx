import type { Metadata } from "next";
import { backendBaseUrl } from "@/lib/config";

export const metadata: Metadata = {
  title: "Report An Issue | MatrixSpaces",
  description: "Report platform, listing, visit, chat, or account issues to the MatrixSpaces support team."
};

const issueTypes = [
  "Listing misinformation",
  "Fraud or suspicious activity",
  "Visit scheduling problem",
  "Chat abuse / spam",
  "Account access issue",
  "Payment / referral issue",
  "Other"
];

export default function ReportPage() {
  return (
    <main className="container" style={{ padding: "2rem 0 3rem", display: "grid", gap: "1rem" }}>
      <section
        className="surface"
        style={{
          borderRadius: 16,
          padding: "1.25rem",
          background: "linear-gradient(140deg,#7f1d1d 0%,#b91c1c 50%,#ef4444 100%)",
          color: "#fff"
        }}
      >
        <p style={{ margin: 0, fontWeight: 800, letterSpacing: ".08em", fontSize: ".75rem", textTransform: "uppercase", opacity: 0.9 }}>Safety & Compliance</p>
        <h1 style={{ margin: ".55rem 0 .35rem", fontSize: "2rem", lineHeight: 1.1, fontWeight: 900 }}>Report An Issue</h1>
        <p style={{ margin: 0, maxWidth: 760, color: "rgba(255,255,255,.92)", fontWeight: 600 }}>
          Help us keep MatrixSpaces trustworthy. Share details and our team will review and take action.
        </p>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.1fr_.9fr]">
        <article className="surface" style={{ borderRadius: 12, padding: "1rem", display: "grid", gap: ".85rem" }}>
          <h2 className="text-xl font-black text-slate-950" style={{ margin: 0 }}>Submit Report</h2>
          <form action={`${backendBaseUrl}/report`} method="POST" style={{ display: "grid", gap: ".75rem" }}>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="grid gap-1.5 text-sm font-bold text-slate-700">
                Reported username
                <input className="field" name="reported_username" placeholder="Reported username (optional)" autoComplete="username" />
              </label>
              <label className="grid gap-1.5 text-sm font-bold text-slate-700">
                Issue type
                <select className="field" name="reason" defaultValue="" required>
                  <option value="" disabled>Select issue type</option>
                  {issueTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="grid gap-1.5 text-sm font-bold text-slate-700">
              Issue description
              <textarea className="field" name="description" placeholder="Describe what happened, where, and any useful details..." rows={7} required />
            </label>
            <button type="submit" className="btn btn-primary" style={{ width: "fit-content" }}>
              Submit Report
            </button>
          </form>
        </article>

        <div style={{ display: "grid", gap: ".75rem" }}>
          <article className="surface" style={{ borderRadius: 12, padding: "1rem" }}>
            <h3 className="text-base font-black text-slate-950" style={{ margin: 0 }}>What To Include</h3>
            <ul style={{ margin: ".65rem 0 0", paddingLeft: "1rem", color: "#334155", fontWeight: 600, display: "grid", gap: ".4rem" }}>
              <li>Username or listing link involved</li>
              <li>Approximate date and time</li>
              <li>Screenshots or message context</li>
              <li>Why it violates policy or trust</li>
            </ul>
          </article>

          <article className="surface" style={{ borderRadius: 12, padding: "1rem" }}>
            <h3 className="text-base font-black text-slate-950" style={{ margin: 0 }}>Review Timeline</h3>
            <p style={{ margin: ".6rem 0 0", color: "#334155", fontWeight: 600 }}>
              Reports are logged instantly and become visible in Admin Dashboard under the <strong>Issue Reports</strong> tab.
            </p>
          </article>
        </div>
      </section>
    </main>
  );
}

