"use client";

import dynamic from "next/dynamic";
import type { Property } from "@/types";

const DynamicPropertyMap = dynamic(
  () => import("@/components/map/PropertyMap").then((module) => module.PropertyMap),
  {
    ssr: false,
    loading: () => (
      <div className="surface" style={{ display: "grid", minHeight: 320, placeItems: "center", color: "var(--ms-muted)", fontWeight: 800 }}>
        Loading map...
      </div>
    )
  }
);

export function PropertyMapIsland({
  properties,
  height,
  showNearbyPlaces,
  showSearchControl
}: {
  properties: Property[];
  height?: number;
  showNearbyPlaces?: boolean;
  showSearchControl?: boolean;
}) {
  return (
    <DynamicPropertyMap
      properties={properties}
      height={height}
      showNearbyPlaces={showNearbyPlaces}
      showSearchControl={showSearchControl}
    />
  );
}
