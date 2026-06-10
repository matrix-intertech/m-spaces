"use client";

import { backendBaseUrl } from "@/lib/config";

let cachedToken = "";

export async function getClientCsrfToken(forceRefresh = false): Promise<string> {
  if (cachedToken && !forceRefresh) return cachedToken;

  const response = await fetch(`${backendBaseUrl}/api/csrf-token`, {
    method: "GET",
    credentials: "include",
    headers: {
      Accept: "application/json"
    }
  });

  const payload = (await response.json().catch(() => ({}))) as { csrfToken?: string };
  cachedToken = payload.csrfToken ?? "";
  return cachedToken;
}
