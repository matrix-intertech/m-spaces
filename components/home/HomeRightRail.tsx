"use client";

import { Map } from "lucide-react";
import { PropertyMapIsland } from "@/components/map/PropertyMapIsland";
import type { Property } from "@/types";

export function HomeRightRail({
  properties,
  trendingSearches,
  spotlight: _spotlight
}: {
  properties: Property[];
  trendingSearches: string[];
  spotlight: Property | null;
}) {
  return (
    <div style={{ display: "grid", gap: "1rem" }}>
      <section className="ms-home-panel" style={{ padding: ".9rem" }}>
        <h3 style={{ margin: "0 0 .7rem", fontSize: "1.28rem" }}>Trending Searches</h3>
        <div style={{ display: "flex", flexWrap: "wrap", gap: ".45rem" }}>
          {trendingSearches.map((chip) => (
            <a key={chip} href={`/search?search=${encodeURIComponent(chip)}`} style={{ borderRadius: 999, background: "rgba(59, 130, 246, 0.14)", color: "var(--ms-ink)", fontSize: ".84rem", fontWeight: 800, padding: ".38rem .7rem" }}>
              {chip}
            </a>
          ))}
        </div>
      </section>

      <section className="ms-home-panel" style={{ padding: ".85rem", display: "grid", gridTemplateRows: "auto 1fr", minHeight: 420 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: ".6rem", marginBottom: ".7rem" }}>
          <h3 style={{ margin: 0, fontSize: "1.15rem" }}>Map View</h3>
          <span style={{ display: "inline-flex", alignItems: "center", gap: ".35rem", color: "var(--ms-muted)", fontSize: ".86rem", fontWeight: 800 }}>
            <Map size={15} aria-hidden />
            Live map
          </span>
        </div>
        <div
          className="ms-map-preview"
          style={{
            display: "block",
            position: "relative",
            borderRadius: 10,
            overflow: "hidden",
            border: "1px solid var(--ms-line)",
            height: "100%"
          }}
        >
          <PropertyMapIsland properties={properties} height={360} showSearchControl loadStrategy="idle" />
        </div>
      </section>
    </div>
  );
}
