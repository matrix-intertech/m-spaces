import { NextResponse } from "next/server";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { fetchProperties } = require("../../../server/public-data");

export const dynamic = "force-dynamic";

function queryObject(searchParams: URLSearchParams): Record<string, string | string[]> {
  const entries = new Map<string, string[]>();
  searchParams.forEach((value, key) => {
    const current = entries.get(key) ?? [];
    current.push(value);
    entries.set(key, current);
  });

  return Object.fromEntries(
    Array.from(entries.entries()).map(([key, values]) => [key, values.length === 1 ? values[0] : values])
  );
}

export async function GET(request: Request) {
  try {
    const params = queryObject(new URL(request.url).searchParams);
    const payload = await fetchProperties(params);
    return NextResponse.json(payload);
  } catch (error) {
    console.error("Native property list fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch properties" }, { status: 500 });
  }
}
