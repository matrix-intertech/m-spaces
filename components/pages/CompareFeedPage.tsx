"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { BedDouble, Bath, Ruler, Heart, MapPinned, MapPin } from "lucide-react";
import { PropertyMapIsland } from "@/components/map/PropertyMapIsland";
import { PropertyPhotoCarousel } from "@/components/property/PropertyPhotoCarousel";
import { money, parsePhotos, titleCase } from "@/lib/format";
import type { Property } from "@/types";

type FeedMode = "recommended" | "nearby" | "newest";
type SideMode = "list" | "map";

function parseNumber(value: unknown): number | null {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const earth = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return 2 * earth * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function CompareFeedPage({ properties }: { properties: Property[] }) {
  const [mode, setMode] = useState<FeedMode>("nearby");
  const [sideMode, setSideMode] = useState<SideMode>("map");
  const [userCoords] = useState<{ lat: number; lon: number } | null>(null);

  const sortedProperties = useMemo(() => {
    const list = [...properties];
    if (mode === "newest") return list.sort((a, b) => Number(b.id || 0) - Number(a.id || 0));
    if (mode === "recommended") return list.sort((a, b) => Number(b.is_matrix_verified) - Number(a.is_matrix_verified));
    if (!userCoords) return list;
    return list.sort((a, b) => {
      const aLat = parseNumber(a.latitude);
      const aLon = parseNumber(a.longitude);
      const bLat = parseNumber(b.latitude);
      const bLon = parseNumber(b.longitude);
      const aDistance = aLat !== null && aLon !== null ? haversineKm(userCoords.lat, userCoords.lon, aLat, aLon) : Number.MAX_SAFE_INTEGER;
      const bDistance = bLat !== null && bLon !== null ? haversineKm(userCoords.lat, userCoords.lon, bLat, bLon) : Number.MAX_SAFE_INTEGER;
      return aDistance - bDistance;
    });
  }, [mode, properties, userCoords]);

  return (
    <div className="container" style={{ paddingTop: "1rem", paddingBottom: "1.4rem" }}>
      <style>{`
        .ms-compare-wrap {
          border: 1px solid #dbe3ef;
          border-radius: 10px;
          background: #f8fbff;
          color: #0f172a;
          padding: 1rem;
        }
        .ms-compare-toolbar {
          display: grid;
          gap: .9rem;
          border-bottom: 1px solid #dbe3ef;
          padding-bottom: .9rem;
          margin-bottom: .9rem;
        }
        .ms-compare-tabs {
          display: flex;
          gap: .6rem;
          flex-wrap: wrap;
        }
        .ms-compare-tab {
          border: 0;
          border-bottom: 2px solid transparent;
          background: transparent;
          color: #64748b;
          font-weight: 800;
          padding: .4rem .2rem;
          cursor: pointer;
        }
        .ms-compare-tab.is-active {
          color: #60a5fa;
          border-bottom-color: #2563eb;
        }
        .ms-compare-layout {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 32%;
          gap: .9rem;
          align-items: start;
        }
        .ms-compare-list {
          display: grid;
          gap: .8rem;
        }
        .ms-compare-card {
          border: 1px solid #dbe3ef;
          border-radius: 10px;
          background: #f8fafc;
          color: #0f172a;
          overflow: hidden;
          display: grid;
          grid-template-columns: minmax(220px, 40%) minmax(0, 1fr);
        }
        .ms-compare-content {
          padding: .9rem;
          display: grid;
          gap: .55rem;
        }
        .ms-compare-meta {
          display: flex;
          flex-wrap: wrap;
          gap: .7rem;
          color: #334155;
          font-size: .94rem;
          font-weight: 700;
        }
        .ms-compare-switch {
          display: inline-grid;
          grid-template-columns: repeat(2, 1fr);
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          overflow: hidden;
          background: #fff;
        }
        .ms-compare-switch button {
          border: 0;
          background: transparent;
          min-height: 34px;
          padding: 0 .65rem;
          font-weight: 800;
          cursor: pointer;
          color: #0f172a;
        }
        .ms-compare-switch button.is-active {
          background: #eff6ff;
          color: #1d4ed8;
        }
        .ms-compare-side {
          border: 1px solid #dbe3ef;
          border-radius: 10px;
          overflow: hidden;
          background: #e2e8f0;
        }
        [data-theme="dark"] .ms-compare-wrap {
          border-color: #1e293b;
          background: #020617;
          color: #e2e8f0;
        }
        [data-theme="dark"] .ms-compare-toolbar {
          border-bottom-color: rgba(148,163,184,.25);
        }
        [data-theme="dark"] .ms-compare-tab {
          color: #94a3b8;
        }
        [data-theme="dark"] .ms-compare-card {
          border-color: #334155;
          background: #f8fafc;
          color: #0f172a;
        }
        [data-theme="dark"] .ms-compare-side {
          border-color: #334155;
          background: #e2e8f0;
        }
        @media (max-width: 980px) {
          .ms-compare-layout { grid-template-columns: 1fr; }
        }
        @media (max-width: 760px) {
          .ms-compare-card { grid-template-columns: 1fr; }
        }
      `}</style>

      <section className="ms-compare-wrap">
        <div className="ms-compare-toolbar">
          <div className="ms-compare-tabs">
            {[
              { key: "recommended", label: "Recommended" },
              { key: "nearby", label: "Nearby" },
              { key: "newest", label: "Newest" }
            ].map((tab) => (
              <button
                key={tab.key}
                type="button"
                className={`ms-compare-tab ${mode === tab.key ? "is-active" : ""}`}
                onClick={() => setMode(tab.key as FeedMode)}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: ".7rem", flexWrap: "wrap" }}>
            <p style={{ margin: 0, color: "var(--ms-muted)", fontWeight: 700 }}>Current location-based and session compare feed from backend.</p>
            <div className="ms-compare-switch">
              <button type="button" className={sideMode === "list" ? "is-active" : ""} onClick={() => setSideMode("list")}>List</button>
              <button type="button" className={sideMode === "map" ? "is-active" : ""} onClick={() => setSideMode("map")}>Map</button>
            </div>
          </div>
        </div>

        <div className="ms-compare-layout">
          <div className="ms-compare-list">
            {sortedProperties.map((property) => {
              const photos = parsePhotos(property.photos, property.photo || property.image_url);
              const title = property.title || `${titleCase(property.type)} space`;
              const price = money(property.final_price ?? property.price ?? property.rent);
              const locality = property.locality || property.city || "Location on request";
              return (
                <article key={property.id} className="ms-compare-card">
                  <div style={{ position: "relative" }}>
                    <PropertyPhotoCarousel photos={photos} alt={title} href={`/property/${property.id}`} aspectRatio="16 / 10" showCounter />
                    {property.is_matrix_verified ? (
                      <span style={{ position: "absolute", left: 10, top: 10, zIndex: 4, borderRadius: 6, background: "#10b981", color: "white", fontSize: ".78rem", fontWeight: 800, padding: ".25rem .5rem" }}>
                        Verified
                      </span>
                    ) : null}
                  </div>
                  <div className="ms-compare-content">
                    <div style={{ display: "flex", justifyContent: "space-between", gap: ".6rem" }}>
                      <strong style={{ fontSize: "2rem", lineHeight: 1 }}>{price}</strong>
                      <button type="button" style={{ border: 0, background: "transparent", color: "#64748b", cursor: "pointer" }} aria-label="Favorite">
                        <Heart size={20} aria-hidden />
                      </button>
                    </div>
                    <h3 style={{ margin: 0, fontSize: "1.7rem", lineHeight: 1.1 }}>{title}</h3>
                    <p style={{ margin: 0, color: "#475569", fontWeight: 700 }}>{locality}</p>
                    <div className="ms-compare-meta">
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><BedDouble size={15} /> {titleCase(property.type) || "Property"}</span>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><Bath size={15} /> {property.listing_type || "Listed"}</span>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><Ruler size={15} /> {property.size ? `${property.size} sqft` : "Area on request"}</span>
                    </div>
                    <div style={{ marginTop: ".35rem", display: "flex", gap: ".45rem", flexWrap: "wrap" }}>
                      <Link className="btn btn-primary" href={`/property/${property.id}`} style={{ borderRadius: 8 }}>View Details</Link>
                      <Link className="btn btn-secondary" href={`/property/${property.id}#chat`} style={{ borderRadius: 8 }}>Chat</Link>
                    </div>
                  </div>
                </article>
              );
            })}
            {!sortedProperties.length ? (
              <div style={{ border: "1px solid var(--ms-line)", borderRadius: 10, padding: "1rem", color: "var(--ms-muted)", background: "rgba(255,255,255,.5)" }}>
                No properties in compare list yet. Add properties from cards to compare.
              </div>
            ) : null}
          </div>

          <aside className="ms-compare-side">
            {sideMode === "map" ? (
              <PropertyMapIsland properties={sortedProperties} height={700} />
            ) : (
              <div style={{ display: "grid", gap: ".55rem", padding: ".65rem", background: "#f8fafc" }}>
                {sortedProperties.map((property) => (
                  <Link key={`side-${property.id}`} href={`/property/${property.id}`} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: ".5rem", border: "1px solid #cbd5e1", borderRadius: 8, background: "white", padding: ".55rem .65rem", color: "#0f172a", fontWeight: 700 }}>
                    <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{property.title || titleCase(property.type) || "Property"}</span>
                    <span style={{ color: "#334155", fontSize: ".85rem", display: "inline-flex", alignItems: "center", gap: 3 }}><MapPin size={13} />{property.locality || property.city || "Area"}</span>
                  </Link>
                ))}
              </div>
            )}
          </aside>
        </div>
      </section>
    </div>
  );
}
