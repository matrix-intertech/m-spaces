"use client";

import Link from "next/link";
import { useState } from "react";

export default function LogoutForm() {
  const [submitting, setSubmitting] = useState(false);

  return (
    <div style={{ display: "grid", gap: ".75rem" }}>
      <form
        action="/api/logout"
        method="post"
        onSubmit={() => setSubmitting(true)}
        style={{ display: "grid", gap: ".75rem" }}
      >
        <button className="btn btn-primary" type="submit" disabled={submitting} style={{ width: "100%" }}>
          {submitting ? "Signing you out..." : "Yes, sign me out"}
        </button>
      </form>
      <Link className="btn btn-secondary" href="/" style={{ width: "100%" }}>
        Stay signed in
      </Link>
    </div>
  );
}
