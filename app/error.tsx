"use client";

export default function ErrorPage({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="container" style={{ padding: "5rem 0" }}>
      <div className="surface" style={{ borderRadius: 8, padding: "2rem", textAlign: "center" }}>
        <h1>Something went wrong</h1>
        <p style={{ color: "var(--ms-muted)" }}>{error.message}</p>
        <button className="btn btn-primary" onClick={reset}>
          Try again
        </button>
      </div>
    </div>
  );
}
