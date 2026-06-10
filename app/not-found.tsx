import Link from "next/link";

export default function NotFound() {
  return (
    <div className="container" style={{ padding: "5rem 0" }}>
      <div className="surface" style={{ borderRadius: 8, padding: "2rem", textAlign: "center" }}>
        <h1>Page not found</h1>
        <p style={{ color: "var(--ms-muted)" }}>The route does not exist in the MatrixSpaces frontend.</p>
        <Link className="btn btn-primary" href="/">
          Go home
        </Link>
      </div>
    </div>
  );
}
