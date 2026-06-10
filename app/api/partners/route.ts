import { NextResponse } from "next/server";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { fetchPartners } = require("../../../server/public-data");

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const partners = await fetchPartners();
    return NextResponse.json({ partners });
  } catch (error) {
    console.error("Native partner fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch partners" }, { status: 500 });
  }
}
