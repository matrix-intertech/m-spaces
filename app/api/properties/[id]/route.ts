import { NextResponse } from "next/server";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { fetchPropertyById } = require("../../../../server/public-data");

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const property = await fetchPropertyById(id);

    if (!property) {
      return NextResponse.json(
        { status: "error", code: "NOT_FOUND", message: "Property not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ status: "success", data: property });
  } catch (error) {
    console.error("Native property detail fetch error:", error);
    return NextResponse.json(
      { status: "error", code: "DB_ERROR", message: "Failed to fetch property details" },
      { status: 500 }
    );
  }
}
