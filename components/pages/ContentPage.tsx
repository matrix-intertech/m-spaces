import Link from "next/link";

export interface ContentPageSection {
  title: string;
  body: string;
}

export function ContentPage({
  title,
  subtitle,
  sections,
  cta
}: {
  title: string;
  subtitle: string;
  sections: ContentPageSection[];
  cta?: { href: string; label: string };
}) {
  return (
    <div className="container" style={{ display: "grid", gap: "1.25rem", padding: "2.5rem 0" }}>
      <section style={{ maxWidth: 780 }}>
        <h1 style={{ margin: 0, fontSize: "clamp(2.2rem, 6vw, 4.8rem)", lineHeight: 0.98 }}>{title}</h1>
        <p style={{ color: "var(--ms-muted)", fontSize: "1.05rem", lineHeight: 1.7 }}>{subtitle}</p>
        {cta ? (
          <Link className="btn btn-primary" href={cta.href}>
            {cta.label}
          </Link>
        ) : null}
      </section>
      <div className="grid-auto">
        {sections.map((section) => (
          <article key={section.title} className="surface" style={{ borderRadius: 8, padding: "1.2rem" }}>
            <h2 style={{ marginTop: 0 }}>{section.title}</h2>
            <p style={{ marginBottom: 0, color: "var(--ms-muted)", lineHeight: 1.7 }}>{section.body}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
