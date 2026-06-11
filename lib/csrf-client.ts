"use client";

let cachedToken = "";

export async function getClientCsrfToken(forceRefresh = false): Promise<string> {
  if (cachedToken && !forceRefresh) return cachedToken;
  cachedToken = "";
  return cachedToken;
}
