import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "About Us | MatrixSpaces",
  description: "Learn about MatrixSpaces, our mission, and how we help businesses discover and manage commercial real estate."
};

const highlights = [
  { title: "Verified Inventory", text: "We focus on quality commercial listings across offices, retail, warehouse, and flexible workspaces." },
  { title: "Role-Based Workflows", text: "Owners, brokers, builders, sales teams, and corporates each get focused dashboards and actions." },
  { title: "Real Collaboration", text: "From discovery to visits and conversations, MatrixSpaces keeps teams and clients aligned in one place." }
];

export default function AboutPage() {
  return (
    <main className="container" style={{ padding: "2rem 0 3rem", display: "grid", gap: "1rem" }}>
      <section
        className="surface"
        style={{
          borderRadius: 16,
          padding: "1.25rem",
          background: "linear-gradient(140deg,#111827 0%,#1f2937 55%,#374151 100%)",
          color: "#f8fafc"
        }}
      >
        <p style={{ margin: 0, fontWeight: 800, letterSpacing: ".08em", fontSize: ".75rem", textTransform: "uppercase", opacity: 0.9 }}>About MatrixSpaces</p>
        <h1 style={{ margin: ".55rem 0 .35rem", fontSize: "2rem", lineHeight: 1.1, fontWeight: 900 }}>Commercial Real Estate, Made Collaborative</h1>
        <p style={{ margin: 0, maxWidth: 820, color: "rgba(248,250,252,.92)", fontWeight: 600 }}>
          MatrixSpaces connects businesses, owners, and partners through a modern platform for discovering, listing, managing, and closing commercial property opportunities.
        </p>
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        {highlights.map((item) => (
          <article key={item.title} className="surface" style={{ borderRadius: 12, padding: "1rem" }}>
            <h2 className="text-lg font-black text-slate-950" style={{ margin: 0 }}>
              {item.title}
            </h2>
            <p style={{ margin: ".55rem 0 0", color: "#334155", fontWeight: 600 }}>{item.text}</p>
          </article>
        ))}
      </section>

      <section className="surface" style={{ borderRadius: 12, padding: "1rem", display: "grid", gap: ".75rem" }}>
        <h2 className="text-xl font-black text-slate-950" style={{ margin: 0 }}>What We Help You Do</h2>
        <div className="grid gap-2 md:grid-cols-2">
          <p style={{ margin: 0, color: "#334155", fontWeight: 600 }}>Discover verified commercial spaces by location, budget, and type.</p>
          <p style={{ margin: 0, color: "#334155", fontWeight: 600 }}>List and manage properties with photos, pricing, and workflow controls.</p>
          <p style={{ margin: 0, color: "#334155", fontWeight: 600 }}>Coordinate visits, lead assignments, and client conversations faster.</p>
          <p style={{ margin: 0, color: "#334155", fontWeight: 600 }}>Support partner ecosystems across brokers, builders, and sales teams.</p>
        </div>
      </section>

      <section className="surface" style={{ borderRadius: 12, padding: "1rem", display: "flex", flexWrap: "wrap", gap: ".6rem", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h3 className="text-lg font-black text-slate-950" style={{ margin: 0 }}>Work With MatrixSpaces</h3>
          <p style={{ margin: ".35rem 0 0", color: "#475569", fontWeight: 600 }}>Join as a partner, list your properties, or reach our support team.</p>
        </div>
        <div style={{ display: "flex", gap: ".5rem", flexWrap: "wrap" }}>
          <Link href="/partner-signup" className="btn btn-primary">Join as Partner</Link>
          <Link href="/contact" className="btn btn-secondary">Contact Us</Link>
        </div>
      </section>
    </main>
  );
}

