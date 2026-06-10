import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Commercial Real Estate in India",
  description:
    "Discover verified commercial properties across India including office spaces, retail shops, warehouses, and sale listings on MatrixSpaces.",
  alternates: {
    canonical: "/commercial-real-estate-india"
  },
  openGraph: {
    title: "Commercial Real Estate in India | MatrixSpaces",
    description:
      "Verified office, retail, warehouse, and investment listings across key Indian cities.",
    url: "https://matrixspaces.com/commercial-real-estate-india",
    type: "website"
  }
};

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "What types of commercial properties are listed on MatrixSpaces?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "MatrixSpaces lists offices, retail shops, warehouse spaces, and other commercial property types for rent and sale."
      }
    },
    {
      "@type": "Question",
      name: "Can I explore verified properties on MatrixSpaces?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. MatrixSpaces highlights verified listings to help users discover trusted commercial inventory."
      }
    },
    {
      "@type": "Question",
      name: "How can I contact property owners or brokers?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Users can open a property page, review details, and use available contact or chat actions to connect."
      }
    }
  ]
};

export default function CommercialRealEstateIndiaPage() {
  return (
    <main className="container" style={{ display: "grid", gap: "1rem", padding: "2rem 0 3rem" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />

      <section className="surface" style={{ borderRadius: 8, padding: "1.25rem" }}>
        <span className="ms-chip" style={{ color: "#b91c1c", background: "#fff1f2", borderColor: "#fecdd3" }}>
          MatrixSpaces
        </span>
        <h1 className="mt-3 text-4xl font-black text-slate-950 md:text-5xl">Commercial Real Estate in India</h1>
        <p className="mt-3 max-w-4xl text-base font-medium leading-8 text-slate-700">
          MatrixSpaces helps you discover commercial properties across India with structured listings for rent and sale.
          Explore offices, retail spaces, and warehouses with location-first discovery and portfolio-backed property data.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link className="btn btn-primary" href="/search">
            Explore Listings
          </Link>
          <Link className="btn btn-secondary" href="/partners">
            Explore Partners
          </Link>
        </div>
      </section>

      <section className="surface" style={{ borderRadius: 8, padding: "1.25rem" }}>
        <h2 className="text-2xl font-black text-slate-950">Popular Categories</h2>
        <ul className="mt-4 grid gap-2 text-sm font-semibold text-slate-700 md:grid-cols-2">
          <li>Office Space Leasing</li>
          <li>Retail Property Listings</li>
          <li>Warehouse and Industrial Units</li>
          <li>Commercial Property for Sale</li>
          <li>Verified Commercial Listings</li>
          <li>Location-Based Property Discovery</li>
        </ul>
      </section>
    </main>
  );
}

