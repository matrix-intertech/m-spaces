import type { Metadata } from "next";
import Link from "next/link";
import { BedDouble, MessageCircle } from "lucide-react";
import { PropertyActions } from "@/components/property/PropertyActions";
import { PropertyPhotoCarousel } from "@/components/property/PropertyPhotoCarousel";
import { getCurrentUser, getFollowedPartnerIds, getPartners } from "@/services/api";
import { money, parsePhotos, titleCase } from "@/lib/format";
import type { Property } from "@/types";

export const metadata: Metadata = {
  title: "Following Feed"
};

function featureLine(property: Property) {
  const type = property.type ? titleCase(property.type) : "Commercial";
  const listing = property.listing_type ? titleCase(property.listing_type) : "Listed";
  const size = property.size ? `${property.size} sqft` : "Area on request";
  return `${type} • ${listing} • ${size}`;
}

function normalizePartnerProperties(partner: Record<string, unknown>): Property[] {
  if (!Array.isArray(partner.properties)) return [];
  return partner.properties.filter(Boolean) as Property[];
}

export default async function FollowingPage() {
  const [user, followedIds, partners] = await Promise.all([getCurrentUser(), getFollowedPartnerIds(), getPartners()]);

  if (!user) {
    return (
      <div className="container" style={{ paddingTop: "1.2rem", paddingBottom: "1.6rem" }}>
        <div className="ms-home-panel" style={{ padding: "1rem" }}>
          <h1 style={{ margin: 0, fontSize: "1.3rem" }}>Following Feed</h1>
          <p style={{ margin: ".45rem 0 0", color: "var(--ms-muted)", fontWeight: 700 }}>Please login to view posts from followed partners.</p>
          <div style={{ marginTop: ".8rem" }}>
            <Link className="btn btn-primary" href="/login">Login</Link>
          </div>
        </div>
      </div>
    );
  }

  const followedSet = new Set(followedIds);
  const followedPartners = partners.filter((partner) => followedSet.has(Number(partner.id)));
  const feed = followedPartners
    .flatMap((partner) => normalizePartnerProperties(partner).map((property) => ({ property, partner })))
    .filter((row) => Boolean(row.property?.id));

  return (
    <div className="container" style={{ paddingTop: "1.2rem", paddingBottom: "1.6rem" }}>
      <div className="ms-home-panel" style={{ padding: "1rem", marginBottom: ".9rem" }}>
        <h1 style={{ margin: 0, fontSize: "1.3rem" }}>Following Feed</h1>
        <p style={{ margin: ".45rem 0 0", color: "var(--ms-muted)", fontWeight: 700 }}>
          Latest listings from partners you follow.
        </p>
      </div>

      {feed.length === 0 ? (
        <div className="ms-home-panel" style={{ padding: "1rem" }}>
          <p style={{ margin: 0, fontWeight: 700 }}>No followed partner posts yet.</p>
          <p style={{ margin: ".45rem 0 0", color: "var(--ms-muted)" }}>Follow partners from Home or Partners page to build this feed.</p>
          <div style={{ marginTop: ".8rem", display: "flex", gap: ".55rem", flexWrap: "wrap" }}>
            <Link className="btn btn-secondary" href="/">Go Home</Link>
            <Link className="btn btn-secondary" href="/partners">Browse Partners</Link>
          </div>
        </div>
      ) : (
        <div style={{ display: "grid", gap: ".9rem" }}>
          {feed.map(({ property, partner }) => {
            const photos = parsePhotos(property.photos, property.photo || property.image_url);
            const title = property.title || `${titleCase(property.type)} space`;
            const location = property.locality || property.city || "Location on request";
            const partnerName = String(partner.username || partner.name || "Partner");
            return (
              <article key={`${property.id}-${partnerName}`} className="ms-home-feed-card">
                <div style={{ padding: ".8rem 1rem", fontWeight: 800 }}>{partnerName}</div>
                <PropertyPhotoCarousel photos={photos} alt={title} href={`/property/${property.id}`} aspectRatio="16 / 11" showCounter />
                <div style={{ display: "grid", gap: ".6rem", padding: "1rem" }}>
                  <strong style={{ fontSize: "1.6rem", lineHeight: 1 }}>{money(property.final_price ?? property.price ?? property.rent)}</strong>
                  <p style={{ margin: 0, fontSize: "1.05rem" }}>{title} • {location}</p>
                  <div style={{ color: "var(--ms-muted)", fontSize: ".93rem", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 5 }}>
                    <BedDouble size={15} aria-hidden />
                    {featureLine(property)}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: ".5rem" }}>
                    <Link className="btn btn-primary" href={`/property/${property.id}`}>View Property</Link>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: ".4rem" }}>
                      <PropertyActions propertyId={property.id} title={title} />
                      <Link href={`/property/${property.id}#chat`} className="btn btn-secondary" aria-label="Chat" title="Chat">
                        <MessageCircle size={18} aria-hidden />
                      </Link>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
