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
          {submitting ? "Logging out..." : "Yes, log me out"}
        </button>
      </form>
      <Link className="btn btn-secondary" href="/" style={{ width: "100%" }}>
        Cancel and stay signed in
      </Link>
    </div>
  );
}
