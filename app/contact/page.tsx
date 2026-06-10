import type { Metadata } from "next";
import Link from "next/link";
import { backendBaseUrl } from "@/lib/config";

export const metadata: Metadata = {
  title: "Contact Us | MatrixSpaces",
  description: "Connect with MatrixSpaces for listings, support, partnerships, and enterprise requirements."
};

export default function ContactPage() {
  return (
    <main className="container" style={{ padding: "2rem 0 3rem", display: "grid", gap: "1rem" }}>
      <section
        className="surface"
        style={{
          borderRadius: 16,
          padding: "1.25rem",
          background: "linear-gradient(135deg,#111827 0%,#1f2937 55%,#374151 100%)",
          color: "#f8fafc"
        }}
      >
        <p style={{ margin: 0, fontWeight: 800, letterSpacing: ".08em", fontSize: ".75rem", textTransform: "uppercase", opacity: 0.85 }}>Contact MatrixSpaces</p>
        <h1 style={{ margin: ".55rem 0 .35rem", fontSize: "2rem", lineHeight: 1.1, fontWeight: 900 }}>Let&apos;s Talk About Your Next Commercial Space</h1>
        <p style={{ margin: 0, maxWidth: 760, color: "rgba(248,250,252,.9)", fontWeight: 600 }}>
          Reach our team for support, listing assistance, partnership onboarding, or enterprise real-estate requirements.
        </p>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.1fr_.9fr]">
        <div className="surface" style={{ borderRadius: 12, padding: "1rem", display: "grid", gap: ".9rem" }}>
          <h2 className="text-xl font-black text-slate-950" style={{ margin: 0 }}>Send Us A Message</h2>
          <form action={`${backendBaseUrl}/contact`} method="POST" style={{ display: "grid", gap: ".75rem" }}>
            <div className="grid gap-3 md:grid-cols-2">
              <input className="field" placeholder="Full name" name="name" required />
              <input className="field" placeholder="Email address" name="email" type="email" required />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <input className="field" placeholder="Phone number" name="phone" />
              <select className="field" name="topic" defaultValue="" required>
                <option value="" disabled>Select topic</option>
                <option value="support">Support</option>
                <option value="listings">Listings</option>
                <option value="partnership">Partnership</option>
                <option value="enterprise">Enterprise requirement</option>
              </select>
            </div>
            <textarea className="field" placeholder="Tell us how we can help..." name="message" rows={5} required />
            <div className="flex flex-wrap gap-2">
              <button type="submit" className="btn btn-primary">Send Message</button>
              <a href="mailto:support@matrixspaces.com" className="btn btn-secondary">Email Instead</a>
            </div>
          </form>
        </div>

        <div style={{ display: "grid", gap: ".75rem" }}>
          <article className="surface" style={{ borderRadius: 12, padding: "1rem" }}>
            <h3 className="text-base font-black text-slate-950" style={{ margin: 0 }}>Talk To Us</h3>
            <div style={{ marginTop: ".65rem", display: "grid", gap: ".5rem" }}>
              <a href="tel:+919217676115" className="btn btn-secondary" style={{ justifyContent: "flex-start" }}>Call: +91 9217676115</a>
              <a href="mailto:support@matrixspaces.com" className="btn btn-secondary" style={{ justifyContent: "flex-start" }}>support@matrixspaces.com</a>
              <Link href="/partner-signup" className="btn btn-secondary" style={{ justifyContent: "flex-start" }}>Partner with MatrixSpaces</Link>
            </div>
          </article>

          <article className="surface" style={{ borderRadius: 12, padding: "1rem" }}>
            <h3 className="text-base font-black text-slate-950" style={{ margin: 0 }}>Office Hours</h3>
            <p style={{ margin: ".6rem 0 0", color: "#334155", fontWeight: 600 }}>Monday - Saturday</p>
            <p style={{ margin: ".25rem 0 0", color: "#0f172a", fontWeight: 800 }}>10:00 AM to 7:00 PM (IST)</p>
          </article>

          <article className="surface" style={{ borderRadius: 12, padding: "1rem" }}>
            <h3 className="text-base font-black text-slate-950" style={{ margin: 0 }}>Corporate Office</h3>
            <p style={{ margin: ".6rem 0 0", color: "#334155", fontWeight: 600 }}>
              G-68 Kalkaji,
              <br />
              New Delhi, India 110019
            </p>
          </article>
        </div>
      </section>
    </main>
  );
}
