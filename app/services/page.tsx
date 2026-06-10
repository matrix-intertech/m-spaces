import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Building2, Calculator, Compass, Handshake, PlusCircle } from "lucide-react";

export const metadata: Metadata = {
  title: "All Services | MatrixSpaces",
  description: "Explore MatrixSpaces services for property discovery, valuation, listing, and partner growth."
};

const services = [
  {
    title: "Property Valuation",
    desc: "Get market-aligned valuation support with locality, demand, and inventory context.",
    href: "/services/valuation",
    tone: "gold",
    icon: Calculator
  },
  {
    title: "Sell or Rent Property",
    desc: "List your property, capture leads, and move faster from inquiry to closure.",
    href: "/services/sell-rent",
    tone: "pink",
    icon: Building2
  },
  {
    title: "Search Properties",
    desc: "Discover verified options by city, locality, budget, and business requirement.",
    href: "/search",
    tone: "blue",
    icon: Compass
  },
  {
    title: "List With MatrixSpaces",
    desc: "Publish inventory and manage statuses, media, and responses from one dashboard.",
    href: "/list-property",
    tone: "violet",
    icon: PlusCircle
  },
  {
    title: "Partner Network",
    desc: "Connect with active brokers, builders, and sales teams across the platform.",
    href: "/partners",
    tone: "green",
    icon: Handshake
  }
] as const;

export default function ServicesPage() {
  return (
    <main className="container" style={{ paddingTop: "1.25rem", paddingBottom: "1.4rem" }}>
      <style>{`
        .ms-services-shell {
          position: relative;
          border: 1px solid #dbe3ef;
          border-radius: 18px;
          overflow: hidden;
          background: linear-gradient(145deg, #f8fbff 0%, #f9fafb 54%, #eef6ff 100%);
          padding: clamp(1rem, 2vw, 2rem);
        }
        .ms-services-shell::before {
          content: "";
          position: absolute;
          inset: -120px auto auto -120px;
          width: 320px;
          height: 320px;
          border-radius: 999px;
          background: radial-gradient(circle, rgba(212,175,55,.2), rgba(212,175,55,0));
          pointer-events: none;
        }
        .ms-services-shell::after {
          content: "";
          position: absolute;
          inset: auto -140px -120px auto;
          width: 380px;
          height: 380px;
          border-radius: 999px;
          background: radial-gradient(circle, rgba(37,99,235,.18), rgba(37,99,235,0));
          pointer-events: none;
        }
        .ms-services-hero {
          position: relative;
          z-index: 1;
          display: grid;
          gap: .8rem;
          margin-bottom: 1.1rem;
        }
        .ms-services-badge {
          display: inline-flex;
          width: fit-content;
          border-radius: 999px;
          border: 1px solid rgba(212,175,55,.35);
          background: rgba(212,175,55,.12);
          color: #9a6c00;
          font-size: .72rem;
          font-weight: 900;
          letter-spacing: .12em;
          text-transform: uppercase;
          padding: .34rem .62rem;
        }
        .ms-services-hero h1 {
          margin: 0;
          font-size: clamp(1.7rem, 5vw, 2.7rem);
          line-height: 1.06;
        }
        .ms-services-hero p {
          margin: 0;
          max-width: 65ch;
          color: #475569;
          font-weight: 600;
        }
        .msx-services-grid {
          position: relative;
          z-index: 1;
          display: grid;
          grid-template-columns: repeat(12, minmax(0, 1fr));
          gap: .85rem;
        }
        .msx-service-card {
          grid-column: span 12;
          border: 1px solid #dbe3ef;
          border-radius: 14px;
          background: rgba(255,255,255,.87);
          backdrop-filter: blur(3px);
          padding: .95rem;
          display: grid;
          gap: .62rem;
          transition: transform .25s ease, box-shadow .25s ease, border-color .25s ease;
        }
        .msx-service-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 16px 26px rgba(15,23,42,.08);
          border-color: #c4d4ef;
        }
        .msx-service-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: .6rem;
        }
        .msx-service-icon {
          width: 42px;
          height: 42px;
          border-radius: 12px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
        .tone-gold { background: rgba(212,175,55,.15); color: #a16207; }
        .tone-pink { background: rgba(255,46,147,.13); color: #be185d; }
        .tone-blue { background: rgba(14,165,233,.13); color: #0369a1; }
        .tone-violet { background: rgba(124,58,237,.13); color: #6d28d9; }
        .tone-green { background: rgba(34,197,94,.13); color: #15803d; }
        .msx-service-card h2 {
          margin: 0;
          font-size: 1.05rem;
          line-height: 1.25;
        }
        .msx-service-card p {
          margin: 0;
          color: #475569;
          font-size: .93rem;
          line-height: 1.45;
        }
        .msx-service-link {
          display: inline-flex;
          align-items: center;
          gap: .35rem;
          font-weight: 800;
          color: #0f172a;
        }
        .msx-service-link svg { transition: transform .2s ease; }
        .msx-service-card:hover .msx-service-link svg { transform: translateX(4px); }
        .ms-services-cta {
          margin-top: .95rem;
          position: relative;
          z-index: 1;
          border: 1px solid #dbe3ef;
          border-radius: 14px;
          background: linear-gradient(120deg, #0f172a 0%, #1e293b 55%, #334155 100%);
          color: white;
          padding: 1rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: .8rem;
          flex-wrap: wrap;
        }
        .ms-services-cta p {
          margin: 0;
          color: rgba(255,255,255,.85);
          font-weight: 600;
        }
        @media (min-width: 760px) {
          .msx-service-card { grid-column: span 6; }
        }
        @media (min-width: 1080px) {
          .msx-service-card { grid-column: span 4; }
        }
      `}</style>

      <section className="ms-services-shell">
        <header className="ms-services-hero">
          <span className="ms-services-badge">MatrixSpaces Services</span>
          <h1>
            All Services,
            <br />
            One Growth Engine
          </h1>
          <p>
            Discover complete workflows for discovery, valuation, listing, and partner collaboration designed for modern real-estate teams.
          </p>
        </header>

        <div className="msx-services-grid">
          {services.map((service) => {
            const Icon = service.icon;
            return (
              <article key={service.href} className="msx-service-card">
                <div className="msx-service-top">
                  <span className={`msx-service-icon tone-${service.tone}`}>
                    <Icon size={20} aria-hidden />
                  </span>
                </div>
                <h2>{service.title}</h2>
                <p>{service.desc}</p>
                <Link className="msx-service-link" href={service.href}>
                  Explore Service <ArrowRight size={15} aria-hidden />
                </Link>
              </article>
            );
          })}
        </div>

        <div className="ms-services-cta">
          <div>
            <strong style={{ fontSize: "1.03rem" }}>Need help deciding where to start?</strong>
            <p>Share your requirement and we will guide you to the best service flow.</p>
          </div>
          <Link className="btn btn-primary" href="/contact">
            Talk to MatrixSpaces
          </Link>
        </div>
      </section>
    </main>
  );
}
