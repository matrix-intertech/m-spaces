import { NextResponse } from "next/server";
import { searchPlaces } from "@/services/places";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";
  const places = await searchPlaces(q);
  return NextResponse.json({ places });
}
