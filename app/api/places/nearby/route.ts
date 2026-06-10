import { NextResponse } from "next/server";
import { getNearbyPlaces } from "@/services/places";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = Number(searchParams.get("lat"));
  const lon = Number(searchParams.get("lon"));
  const radius = Number(searchParams.get("radius") ?? 10000);
  const places = await getNearbyPlaces(lat, lon, radius);
  return NextResponse.json({ places });
}
