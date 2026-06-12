"use client";

import { useState } from "react";
import { Map, Newspaper } from "lucide-react";
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
  const [mapMode, setMapMode] = useState(false);
  const previewLocations = Array.from(
    new Set(
      properties
        .map((property) => property.locality || property.city || property.title || "")
        .filter(Boolean)
    )
  ).slice(0, 3);

  return (
    <div style={{ display: "grid", gap: "1rem" }}>
      <style>{`
        .ms-map-preview .leaflet-control-container,
        .ms-map-preview .leaflet-popup-pane {
          display: none !important;
        }
      `}</style>
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
          <button className="btn btn-secondary" type="button" onClick={() => setMapMode((value) => !value)} style={{ minHeight: 34, borderRadius: 8, padding: "0 .7rem" }}>
            {mapMode ? <Newspaper size={15} aria-hidden /> : <Map size={15} aria-hidden />}
            {mapMode ? "Cards" : "Map"}
          </button>
        </div>
        {mapMode ? (
          <PropertyMapIsland properties={properties} height={360} />
        ) : (
          <div
            className="ms-map-preview"
            style={{
              display: "grid",
              alignContent: "space-between",
              gap: ".9rem",
              borderRadius: 10,
              overflow: "hidden",
              border: "1px solid var(--ms-line)",
              height: "100%",
              padding: "1rem",
              background:
                "radial-gradient(circle at top right, rgba(59,130,246,.16), transparent 30%), radial-gradient(circle at bottom left, rgba(16,185,129,.14), transparent 26%), rgba(255,255,255,.92)"
            }}
          >
            <div style={{ display: "grid", gap: ".75rem" }}>
              <div>
                <strong style={{ display: "block", fontSize: "1rem", marginBottom: ".25rem" }}>Explore listings faster</strong>
                <p style={{ margin: 0, color: "var(--ms-muted)", fontSize: ".92rem", fontWeight: 700 }}>
                  Map bundle ab sirf tab load hoga jab aap usse open karoge. Isse first page render noticeably faster hota hai.
                </p>
              </div>
              <div style={{ display: "grid", gap: ".5rem" }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: ".45rem" }}>
                  <span style={{ borderRadius: 999, background: "rgba(15,23,42,.06)", padding: ".35rem .65rem", fontSize: ".82rem", fontWeight: 800 }}>
                    {properties.length} featured listings
                  </span>
                  {previewLocations.map((location) => (
                    <span key={location} style={{ borderRadius: 999, background: "rgba(59,130,246,.12)", padding: ".35rem .65rem", fontSize: ".82rem", fontWeight: 800 }}>
                      {location}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <div style={{ display: "grid", gap: ".55rem" }}>
              <button className="btn btn-secondary" type="button" onClick={() => setMapMode(true)} style={{ borderRadius: 8 }}>
                <Map size={16} aria-hidden />
                Open live map
              </button>
              <span style={{ color: "var(--ms-muted)", fontSize: ".8rem", fontWeight: 700 }}>
                Leaflet map, cluster assets, and nearby-place overlays now stay deferred until needed.
              </span>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
