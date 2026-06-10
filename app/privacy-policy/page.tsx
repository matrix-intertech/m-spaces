import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | MatrixSpaces",
  description: "Learn how MatrixSpaces collects, uses, stores, and protects your personal and business data."
};

const updatedOn = "May 30, 2026";

function PolicySection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="surface" style={{ borderRadius: 12, padding: "1rem" }}>
      <h2 className="text-lg font-black text-slate-950" style={{ margin: 0 }}>
        {title}
      </h2>
      <div style={{ marginTop: ".6rem", color: "#334155", fontWeight: 600, display: "grid", gap: ".45rem" }}>{children}</div>
    </section>
  );
}

export default function PrivacyPolicyPage() {
  return (
    <main className="container" style={{ padding: "2rem 0 3rem", display: "grid", gap: "1rem" }}>
      <section
        className="surface"
        style={{
          borderRadius: 16,
          padding: "1.25rem",
          background: "linear-gradient(140deg,#0f172a 0%,#1e293b 55%,#334155 100%)",
          color: "#f8fafc"
        }}
      >
        <p style={{ margin: 0, fontWeight: 800, letterSpacing: ".08em", fontSize: ".75rem", textTransform: "uppercase", opacity: 0.9 }}>Legal</p>
        <h1 style={{ margin: ".55rem 0 .35rem", fontSize: "2rem", lineHeight: 1.1, fontWeight: 900 }}>Privacy Policy</h1>
        <p style={{ margin: 0, maxWidth: 780, color: "rgba(248,250,252,.92)", fontWeight: 600 }}>
          This policy explains how MatrixSpaces collects, uses, and protects information when you use our website, applications, and services.
        </p>
        <p style={{ margin: ".55rem 0 0", fontSize: ".88rem", color: "rgba(248,250,252,.82)", fontWeight: 700 }}>Last updated: {updatedOn}</p>
      </section>

      <PolicySection title="1. Information We Collect">
        <p>We may collect account details like name, email, phone number, company details, and role information.</p>
        <p>We also collect listing, requirement, visit, communication, and support/report data you provide while using MatrixSpaces.</p>
        <p>Technical data such as IP address, browser type, device details, and activity logs may be recorded for security and analytics.</p>
      </PolicySection>

      <PolicySection title="2. How We Use Information">
        <p>We use your information to provide platform features such as property discovery, chat, visits, partner workflows, and account support.</p>
        <p>Data is also used for verification, fraud prevention, service quality improvement, and legal compliance.</p>
      </PolicySection>

      <PolicySection title="3. Data Sharing">
        <p>We share data only as needed to operate core services, comply with legal obligations, or protect users and platform integrity.</p>
        <p>Where required, your information may be shared with authorized team members, service providers, or government authorities.</p>
      </PolicySection>

      <PolicySection title="4. Cookies and Tracking">
        <p>We may use cookies and similar technologies to maintain sessions, remember preferences, and improve user experience.</p>
        <p>You can manage cookies through your browser settings, but some platform features may not work properly if disabled.</p>
      </PolicySection>

      <PolicySection title="5. Data Retention and Security">
        <p>We retain information for as long as required for service delivery, legal obligations, and legitimate business purposes.</p>
        <p>MatrixSpaces uses reasonable technical and operational safeguards, but no internet-based system is 100% secure.</p>
      </PolicySection>

      <PolicySection title="6. Your Rights">
        <p>You may request access, correction, or deletion of your personal data, subject to applicable law and operational requirements.</p>
        <p>You may also request account deactivation by contacting support.</p>
      </PolicySection>

      <PolicySection title="7. Third-Party Links">
        <p>Our platform may contain links to external sites. We are not responsible for the privacy practices of third-party websites.</p>
      </PolicySection>

      <PolicySection title="8. Policy Updates">
        <p>We may update this Privacy Policy from time to time. Material changes will be reflected on this page with an updated effective date.</p>
      </PolicySection>

      <PolicySection title="9. Contact">
        <p>For privacy-related questions, contact us at support@matrixspaces.com or visit our Contact page.</p>
      </PolicySection>
    </main>
  );
}

