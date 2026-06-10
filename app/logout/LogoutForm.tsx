"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { backendUrl } from "@/lib/config";
import { getClientCsrfToken } from "@/lib/csrf-client";

export default function LogoutForm() {
  const [csrfToken, setCsrfToken] = useState("");

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const token = await getClientCsrfToken().catch(() => "");
      if (!cancelled) setCsrfToken(token);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <form action={backendUrl("/logout")} method="post">
        <input type="hidden" name="_csrf" value={csrfToken} />
        <button className="btn btn-primary" type="submit" style={{ width: "100%" }}>
          Logout
        </button>
      </form>
      <Link className="btn btn-secondary" href="/">
        Stay signed in
      </Link>
    </>
  );
}
