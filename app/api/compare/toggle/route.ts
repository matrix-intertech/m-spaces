import { NextResponse } from "next/server";
import { backendUrl, resolveAbsoluteUrl } from "@/lib/config";

export async function POST(request: Request) {
  const cookie = request.headers.get("cookie") ?? "";
  const body = await request.text();
  const backendEndpoint = resolveAbsoluteUrl(backendUrl("/compare/toggle"), new URL(request.url).origin);

  try {
    const response = await fetch(backendEndpoint, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(cookie ? { Cookie: cookie } : {})
      },
      body: body || "{}",
      cache: "no-store"
    });
    const text = await response.text();
    return new NextResponse(text, {
      status: response.status,
      headers: { "content-type": response.headers.get("content-type") ?? "application/json" }
    });
  } catch {
    return NextResponse.json({ status: "error", message: "Compare service unavailable" }, { status: 503 });
  }
}
