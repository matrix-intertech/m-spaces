import { NextResponse } from "next/server";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { fetchPropertyById } = require("../../../../server/public-data");

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const requestId = request.headers.get("x-request-id") ?? undefined;
  try {
    const { id } = await context.params;
    const property = await fetchPropertyById(id);

    if (!property) {
      return NextResponse.json(
        { success: false, status: "error", code: "NOT_FOUND", error: "Property not found", requestId },
        { status: 404 }
      );
    }

    return NextResponse.json({ status: "success", data: property });
  } catch (error) {
    console.error("Native property detail fetch error:", { requestId, error });
    return NextResponse.json(
      { success: false, status: "error", code: "DB_ERROR", error: "Failed to fetch property details", requestId },
      { status: 500 }
    );
  }
}
