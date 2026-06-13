import { NextResponse } from "next/server";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { fetchPartners } = require("../../../server/public-data");

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestId = request.headers.get("x-request-id") ?? undefined;
  try {
    const partners = await fetchPartners();
    return NextResponse.json({ partners });
  } catch (error) {
    console.error("Native partner fetch error:", { requestId, error });
    return NextResponse.json(
      { success: false, error: "Failed to fetch partners", requestId },
      { status: 500 }
    );
  }
}
