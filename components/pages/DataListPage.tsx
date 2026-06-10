export function DataListPage({
  title,
  subtitle,
  items,
  emptyLabel
}: {
  title: string;
  subtitle: string;
  items: Array<Record<string, unknown>>;
  emptyLabel: string;
}) {
  return (
    <div className="container" style={{ display: "grid", gap: "1rem", padding: "2rem 0" }}>
      <section style={{ display: "grid", gap: ".45rem" }}>
        <span className="ms-chip" style={{ color: "var(--ms-brand-dark)", background: "rgba(255,255,255,.7)" }}>MatrixSpaces Workspace</span>
        <h1 style={{ margin: 0, fontSize: "clamp(2rem, 5vw, 4rem)", lineHeight: 1 }}>{title}</h1>
      </section>

      {items.length ? (
        <div style={{ display: "grid", gap: ".75rem" }}>
          {items.map((item, index) => {
            const label = String(item.title || item.content || item.name || item.file_name || item.status || `Item ${index + 1}`);
            const meta = String(item.locality || item.created_at || item.scheduled_at || item.amount || item.type || "");
            return (
              <article key={String(item.id ?? index)} className="surface" style={{ borderRadius: 24, padding: "1rem" }}>
                <strong>{label}</strong>
                {meta ? <p style={{ margin: ".25rem 0 0", color: "var(--ms-muted)" }}>{meta}</p> : null}
              </article>
            );
          })}
        </div>
      ) : (
        <div className="surface" style={{ borderRadius: 28, padding: "2rem", textAlign: "center" }}>
          <h2 style={{ marginTop: 0 }}>{emptyLabel}</h2>
        </div>
      )}
    </div>
  );
}
