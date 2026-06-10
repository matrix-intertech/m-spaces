import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { backendUrl, resolveAbsoluteUrl } from "@/lib/config";

export async function POST() {
  const requestHeaders = await headers();
  const cookie = requestHeaders.get("cookie") ?? "";
  const origin = requestHeaders.get("origin")
    ?? `${requestHeaders.get("x-forwarded-proto") ?? "http"}://${requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000"}`;

  try {
    await fetch(resolveAbsoluteUrl(backendUrl("/logout"), origin), {
      method: "POST",
      redirect: "manual",
      headers: cookie ? { Cookie: cookie } : undefined,
      cache: "no-store"
    });
  } catch {
    // Ignore backend connectivity issues and continue to login redirect.
  }

  const response = NextResponse.redirect(new URL("/", origin));
  response.cookies.set("connect.sid", "", { path: "/", maxAge: 0 });
  return response;
}
