import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms & Conditions | MatrixSpaces",
  description: "Read the terms governing use of MatrixSpaces services, listings, visits, and communications."
};

const updatedOn = "May 30, 2026";

function TermSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="surface" style={{ borderRadius: 12, padding: "1rem" }}>
      <h2 className="text-lg font-black text-slate-950" style={{ margin: 0 }}>
        {title}
      </h2>
      <div style={{ marginTop: ".6rem", color: "#334155", fontWeight: 600, display: "grid", gap: ".45rem" }}>{children}</div>
    </section>
  );
}

export default function TermsConditionsPage() {
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
        <p style={{ margin: 0, fontWeight: 800, letterSpacing: ".08em", fontSize: ".75rem", textTransform: "uppercase", opacity: 0.9 }}>Legal</p>
        <h1 style={{ margin: ".55rem 0 .35rem", fontSize: "2rem", lineHeight: 1.1, fontWeight: 900 }}>Terms & Conditions</h1>
        <p style={{ margin: 0, maxWidth: 780, color: "rgba(248,250,252,.92)", fontWeight: 600 }}>
          These terms govern your use of MatrixSpaces platform, including listings, communications, visits, and partner workflows.
        </p>
        <p style={{ margin: ".55rem 0 0", fontSize: ".88rem", color: "rgba(248,250,252,.82)", fontWeight: 700 }}>Last updated: {updatedOn}</p>
      </section>

      <TermSection title="1. Acceptance of Terms">
        <p>By using MatrixSpaces, you agree to these Terms & Conditions and our Privacy Policy.</p>
        <p>If you do not agree, you should discontinue use of the platform.</p>
      </TermSection>

      <TermSection title="2. User Accounts">
        <p>You are responsible for maintaining accurate account information and safeguarding your login credentials.</p>
        <p>You are responsible for all activity under your account unless unauthorized use is reported promptly.</p>
      </TermSection>

      <TermSection title="3. Listings and Content">
        <p>Users must provide accurate property, pricing, availability, and contact details in listings and related submissions.</p>
        <p>MatrixSpaces may review, moderate, suspend, or remove content that is misleading, unlawful, abusive, or policy-violating.</p>
      </TermSection>

      <TermSection title="4. Visits, Leads, and Communications">
        <p>Visit scheduling, lead assignment, and chat interactions must be used only for lawful and legitimate real-estate purposes.</p>
        <p>Harassment, spam, fraud, impersonation, or misuse of platform communication features is prohibited.</p>
      </TermSection>

      <TermSection title="5. Prohibited Conduct">
        <p>You must not attempt unauthorized access, interfere with platform operations, or use automated abuse techniques.</p>
        <p>Any action that harms users, platform trust, or legal compliance may lead to account suspension or termination.</p>
      </TermSection>

      <TermSection title="6. Intellectual Property">
        <p>All platform branding, software, and design elements remain the property of MatrixSpaces or its licensors.</p>
        <p>You may not copy, distribute, or exploit protected materials without authorization.</p>
      </TermSection>

      <TermSection title="7. Limitation of Liability">
        <p>MatrixSpaces provides the platform on an “as available” basis without guarantees of uninterrupted or error-free operation.</p>
        <p>To the extent permitted by law, MatrixSpaces is not liable for indirect or consequential losses arising from platform use.</p>
      </TermSection>

      <TermSection title="8. Termination">
        <p>We may restrict or terminate access for violations of these terms, legal requirements, or security risks.</p>
      </TermSection>

      <TermSection title="9. Changes to Terms">
        <p>We may update these terms from time to time. Continued use after updates constitutes acceptance of the revised terms.</p>
      </TermSection>

      <TermSection title="10. Contact">
        <p>For legal or terms-related questions, please contact support@matrixspaces.com.</p>
      </TermSection>
    </main>
  );
}

