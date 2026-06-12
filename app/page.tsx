import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BedDouble, ChartLine, Compass, Ellipsis, MessageCircle, ShieldCheck, Sparkles, Users } from "lucide-react";
import { FollowPartnerButton } from "@/components/home/FollowPartnerButton";
import { HomeSearchPanel } from "@/components/home/HomeSearchPanel";
import { HomeRightRail } from "@/components/home/HomeRightRail";
import { PropertyActions } from "@/components/property/PropertyActions";
import { PropertyPhotoCarousel } from "@/components/property/PropertyPhotoCarousel";
import { getCurrentUser, getFollowedPartnerIds, getPartners, getProperties } from "@/services/api";
import { assetPath, money, parsePhotos, titleCase } from "@/lib/format";
import type { Property } from "@/types";

export const metadata: Metadata = {
  title: "Commercial Real Estate Discovery"
};

type HomeMode = "for-you" | "discover" | "market-trends";

async function fetchHomeSet(params: Record<string, string>) {
  const search = new URLSearchParams(params);
  return getProperties(search, {
    cache: "force-cache",
    next: { revalidate: 180 }
  }).catch(() => ({ properties: [] as Property[] }));
}

function mergeProperties(...sets: Property[][]) {
  const seen = new Set<number>();
  const merged: Property[] = [];
  sets.flat().forEach((property) => {
    if (!property?.id || seen.has(property.id)) return;
    seen.add(property.id);
    merged.push(property);
  });
  return merged;
}

function featureLine(property: Property) {
  const beds = property.type ? titleCase(property.type) : "Commercial";
  const size = property.size ? `${property.size} sqft` : "Area on request";
  const listing = property.listing_type ? titleCase(property.listing_type) : "Listed";
  return `${beds} • ${listing} • ${size}`;
}

function propertyTimestamp(property: Property): number {
  const record = property as unknown as Record<string, unknown>;
  const raw = record.listed_at ?? record.created_at ?? 0;
  const ts = new Date(String(raw)).getTime();
  return Number.isFinite(ts) ? ts : 0;
}

function relativeUploadTime(property: Property): string {
  const ts = propertyTimestamp(property);
  if (!ts) return "Recently listed";
  const diffMs = Date.now() - ts;
  if (diffMs < 60_000) return "Listed just now";
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 60) return `Listed ${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Listed ${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `Listed ${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `Listed ${months}mo ago`;
  const years = Math.floor(months / 12);
  return `Listed ${years}y ago`;
}

export default async function HomePage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const rawMode = Array.isArray(resolvedSearchParams.mode) ? resolvedSearchParams.mode[0] : resolvedSearchParams.mode;
  const mode: HomeMode = rawMode === "discover" || rawMode === "market-trends" || rawMode === "for-you" ? rawMode : "for-you";

  const [featured, sale, newlyAdded, partners, currentUser, followedPartnerIds] = await Promise.all([
    fetchHomeSet({ limit: "8" }),
    fetchHomeSet({ limit: "8", listingType: "sale" }),
    fetchHomeSet({ limit: "8", verifiedOnly: "true" }),
    getPartners({ cache: "force-cache", next: { revalidate: 300 } }),
    getCurrentUser(),
    getFollowedPartnerIds()
  ]);
  if (["admin", "support"].includes(String(currentUser?.role ?? "").toLowerCase())) {
    redirect("/admin?tab=overview");
  }

  const baseFeed = mergeProperties(featured.properties, sale.properties, newlyAdded.properties);
  const followedSet = new Set(followedPartnerIds);
  const followedProperties = baseFeed.filter((property) => {
    const assigned = Array.isArray(property.assigned_brokers) ? property.assigned_brokers : [];
    return followedSet.has(Number(property.owner_id)) || followedSet.has(Number(property.assigned_broker_id)) || assigned.some((id) => followedSet.has(id));
  });
  const followedTypes = new Set(followedProperties.map((property) => String(property.type || "").toLowerCase()).filter(Boolean));
  const followedLocations = new Set(
    followedProperties
      .map((property) => String(property.locality || property.city || "").toLowerCase())
      .filter(Boolean)
  );
  const scoredFeed = [...baseFeed].sort((a, b) => {
    const scoreOf = (property: Property) => {
      let score = 0;
      const assigned = Array.isArray(property.assigned_brokers) ? property.assigned_brokers : [];
      if (followedSet.has(Number(property.owner_id)) || followedSet.has(Number(property.assigned_broker_id)) || assigned.some((id) => followedSet.has(id))) score += 100;
      if (followedTypes.has(String(property.type || "").toLowerCase())) score += 30;
      if (followedLocations.has(String(property.locality || property.city || "").toLowerCase())) score += 20;
      return score;
    };
    return scoreOf(b) - scoreOf(a);
  });
  const discoverFeed = [...baseFeed].sort((a, b) => {
    const aTs = propertyTimestamp(a);
    const bTs = propertyTimestamp(b);
    const recency = bTs - aTs;
    const aPriority = (a.is_matrix_verified ? 2 : 0) + (String(a.listing_type || "").toLowerCase() === "sale" ? 1 : 0);
    const bPriority = (b.is_matrix_verified ? 2 : 0) + (String(b.listing_type || "").toLowerCase() === "sale" ? 1 : 0);
    return bPriority - aPriority || recency;
  });
  const marketTrendFeed = [...baseFeed].sort((a, b) => {
    const score = (property: Property) => {
      const price = Number(property.final_price ?? property.price ?? property.rent ?? 0);
      const recentBoost = (() => {
        const ts = propertyTimestamp(property);
        if (ts <= 0) return 0;
        const days = Math.max(0, (Date.now() - ts) / (1000 * 60 * 60 * 24));
        return Math.max(0, 30 - days);
      })();
      const verifiedBoost = property.is_matrix_verified ? 35 : 0;
      const premiumBoost = String((property as unknown as Record<string, unknown>).verification_status || "").toLowerCase().includes("premium") ? 20 : 0;
      const valueBoost = Math.min(45, Math.log10(Math.max(1, price)) * 8);
      return recentBoost + verifiedBoost + premiumBoost + valueBoost;
    };
    return score(b) - score(a);
  });

  const selectedFeed =
    mode === "discover"
      ? discoverFeed
      : mode === "market-trends"
        ? marketTrendFeed
        : currentUser
          ? scoredFeed
          : baseFeed;
  const feedProperties = selectedFeed.slice(0, 12);
  const mapProperties = mergeProperties(featured.properties, sale.properties).slice(0, 8);
  const suggestedBrokers = partners
    .filter((partner) => {
      const role = String(partner.role || "").toLowerCase();
      return role.includes("broker") || role.includes("agent") || role.includes("external");
    })
    .slice(0, 4);
  const trendingSearches = Array.from(
    new Set(
      feedProperties
        .map((property) => property.locality || property.city || property.type || "")
        .filter((value) => Boolean(value))
    )
  ).slice(0, 4);
  const spotlight = feedProperties[0] ?? null;

  return (
    <div className="container" style={{ paddingTop: "1rem", paddingBottom: "2rem", width: "100%", maxWidth: "100%", marginInline: 0, paddingInline: "5px" }}>
      <style>{`
        .ms-home-layout {
          display: grid;
          grid-template-columns: 280px minmax(0, 1fr) 380px;
          gap: 1rem;
          align-items: stretch;
        }
        .ms-home-sticky {
          display: grid;
          gap: 1rem;
          align-content: start;
          align-items: start;
        }
        .ms-home-col-scroll {
          min-height: 0;
        }
        @media (min-width: 761px) {
          .ms-home-col-scroll {
            max-height: calc(100vh - 106px);
            overflow: auto;
            padding-right: .2rem;
            scrollbar-gutter: stable;
            -ms-overflow-style: none;
            scrollbar-width: none;
          }
          .ms-home-col-scroll::-webkit-scrollbar {
            width: 0;
            height: 0;
            display: none;
          }
        }
        .ms-home-panel {
          border: 1px solid var(--ms-line);
          border-radius: 10px;
          background: rgba(255,255,255,0.92);
          box-shadow: 0 8px 24px rgba(15, 23, 42, 0.06);
        }
        .ms-home-feed-card {
          border: 1px solid var(--ms-line);
          border-radius: 10px;
          overflow: hidden;
          background: rgba(255,255,255,0.94);
          box-shadow: 0 10px 28px rgba(15, 23, 42, 0.08);
        }
        .ms-home-feed-card + .ms-home-feed-card {
          margin-top: 1rem;
        }
        .ms-home-nav-scroll {
          display: grid;
          gap: .35rem;
        }
        .ms-home-mobile-mode-switch {
          display: none;
        }
        .ms-home-type-link {
          border-radius: 8px;
          border: 1px solid #cbd5e1;
          padding: .52rem .65rem;
          font-size: .92rem;
          font-weight: 700;
          letter-spacing: .01em;
          color: #0f172a;
          background: #e5e7eb;
        }
        [data-theme="dark"] .ms-home-type-link {
          border-color: #475569;
          color: #f8fafc;
          background: #334155;
        }
        .ms-home-price {
          font-size: 2rem;
          line-height: 1;
        }
        .ms-home-card-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: .8rem;
          padding: .85rem 1rem;
        }
        .ms-home-content {
          display: grid;
          gap: .65rem;
          padding: 1rem;
        }
        .ms-home-price-row {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: .7rem;
        }
        .ms-home-actions {
          display: grid;
          grid-template-columns: repeat(3, minmax(34px, 1fr));
          gap: .35rem;
        }
        .ms-home-actions .btn {
          min-height: 38px;
          width: 38px;
          height: 38px;
          padding: 0;
          border-radius: 999px;
          border-color: var(--ms-line);
          color: var(--ms-ink);
          background: rgba(255,255,255,.92);
        }
        .ms-home-actions .btn svg {
          width: 18px;
          height: 18px;
          display: block;
          flex: 0 0 auto;
          color: currentColor;
        }
        [data-theme="dark"] .ms-home-actions .btn {
          background: rgba(15, 23, 42, 0.9);
          border-color: #334155;
          color: #e2e8f0;
        }
        .ms-home-cta-row {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 52px;
          gap: .45rem;
          align-items: stretch;
        }
        .ms-home-chat-btn {
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          display: grid;
          place-items: center;
          color: #64748b;
          background: #e2e8f0;
        }
        [data-theme="dark"] .ms-home-chat-btn {
          border-color: #475569;
          color: #cbd5e1;
          background: #334155;
        }
        [data-theme="dark"] .ms-home-panel,
        [data-theme="dark"] .ms-home-feed-card {
          border-color: #334155;
          background: rgba(15, 23, 42, 0.9);
          box-shadow: 0 12px 30px rgba(2, 6, 23, 0.52);
        }
        @media (max-width: 1180px) {
          .ms-home-layout {
            grid-template-columns: 220px minmax(0, 1fr);
          }
          .ms-home-right {
            grid-column: 1 / -1;
          }
        }
        @media (max-width: 1023px) {
          .ms-home-layout {
            grid-template-columns: 1fr;
          }
          .ms-home-col-scroll {
            max-height: none;
            overflow: visible;
          }
          .ms-home-right {
            grid-column: auto;
          }
        }
        @media (max-width: 760px) {
          .ms-home-layout {
            grid-template-columns: 1fr;
            gap: .7rem;
          }
          .ms-home-col-scroll { max-height: none; overflow: visible; }
          .ms-home-layout > main { order: 1; }
          .ms-home-layout > .ms-home-sticky:not(.ms-home-right) { order: 2; }
          .ms-home-layout > .ms-home-right { order: 3; }
          .ms-home-mode-panel {
            display: none;
          }
          .ms-home-mobile-mode-switch {
            display: flex;
            gap: .45rem;
            overflow-x: auto;
            padding-bottom: .15rem;
            margin-bottom: .7rem;
            scrollbar-width: thin;
          }
          .ms-home-mobile-mode-switch a {
            flex: 0 0 auto;
            border: 1px solid #cbd5e1;
            border-radius: 10px;
            padding: .58rem .8rem;
            font-size: .9rem;
            font-weight: 850;
            color: #1e293b;
            background: #fff;
            white-space: nowrap;
          }
          .ms-home-mobile-mode-switch a.is-active {
            border-color: #93c5fd;
            background: rgba(59, 130, 246, 0.15);
            color: #0f172a;
          }
          .ms-home-nav-scroll {
            display: flex;
            overflow-x: auto;
            gap: .45rem;
            padding-bottom: .1rem;
            scrollbar-width: thin;
          }
          .ms-home-nav-scroll .ms-home-nav-btn {
            flex: 0 0 auto;
            min-width: 132px;
            margin-bottom: 0 !important;
            padding: .62rem .72rem !important;
            font-size: .93rem !important;
          }
          .ms-home-types-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .ms-home-feed-card {
            border-radius: 9px;
          }
          .ms-home-price {
            font-size: 1.45rem;
          }
          .ms-home-meta {
            font-size: .9rem !important;
          }
          .ms-home-title {
            font-size: 1rem !important;
            line-height: 1.3 !important;
          }
          .ms-home-card-head {
            padding: .7rem .75rem;
          }
          .ms-home-content {
            padding: .75rem;
            gap: .55rem;
          }
          .ms-home-price-row {
            gap: .45rem;
            align-items: center;
          }
          .ms-home-actions {
            grid-template-columns: repeat(3, 34px);
            justify-content: end;
          }
          .ms-home-actions .btn {
            min-height: 34px;
            width: 34px;
            height: 34px;
          }
          .ms-home-actions .btn svg {
            width: 16px;
            height: 16px;
          }
          .ms-home-cta-row {
            grid-template-columns: minmax(0, 1fr) 46px;
          }
          .ms-home-cta-row .btn {
            min-height: 42px;
            font-size: .92rem;
            padding: .5rem .65rem;
          }
          .ms-home-card-profile {
            min-width: 0;
          }
          .ms-home-card-profile strong,
          .ms-home-card-profile p {
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          .ms-home-meta {
            gap: .5rem !important;
          }
        }
      `}</style>

      <div className="ms-home-layout">
        <aside className="ms-home-sticky ms-home-col-scroll">
          <section className="ms-home-panel ms-home-mode-panel" style={{ padding: ".7rem" }}>
            <div className="ms-home-nav-scroll">
              {[
              { label: "For You", icon: Sparkles, key: "for-you" as HomeMode },
              { label: "Discover", icon: Compass, key: "discover" as HomeMode },
              { label: "Market Trends", icon: ChartLine, key: "market-trends" as HomeMode }
            ].map((item) => {
              const active = mode === item.key;
              return (
                <Link
                  key={item.label}
                  className="ms-home-nav-btn"
                  href={item.key === "for-you" ? "/" : `/?mode=${item.key}`}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: ".6rem",
                    border: 0,
                    borderRadius: 8,
                    marginBottom: ".35rem",
                    padding: ".8rem",
                    background: active ? "rgba(59, 130, 246, 0.18)" : "transparent",
                    color: "var(--ms-ink)",
                    textAlign: "left",
                    cursor: "pointer",
                    fontWeight: active ? 900 : 800,
                    fontSize: "1rem"
                  }}
                >
                  <item.icon size={18} aria-hidden />
                  {item.label}
                </Link>
              );
            })}
            </div>
          </section>

          <section className="ms-home-panel" style={{ padding: "1rem" }}>
            <h3 style={{ margin: "0 0 .75rem", fontSize: "1.15rem" }}>Quick Searches</h3>
            <div className="ms-home-types-grid" style={{ display: "grid", gap: ".45rem" }}>
                {[
                  { label: "All Listings", href: "/search" },
                  { label: "For Sale", href: "/search?listingType=sale" },
                  { label: "For Rent", href: "/search?listingType=rent" },
                  { label: "PG / Co-living", href: "/search?listingType=pg" },
                  { label: "Office", href: "/search?type=office" },
                  { label: "Retail", href: "/search?type=retail" },
                  { label: "Warehouse", href: "/search?type=warehouse" }
                ].map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  className="ms-home-type-link"
                  style={{
                    textDecoration: "none"
                  }}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </section>

          <section className="ms-home-panel" style={{ padding: "1rem" }}>
            <h3 style={{ margin: "0 0 .85rem", fontSize: "1.15rem" }}>Suggested Brokers</h3>
            <div style={{ display: "grid", gap: ".85rem" }}>
              {suggestedBrokers.map((broker, index) => {
                const name = String(broker.username || broker.name || `Broker ${index + 1}`);
                const firm = String(broker.agency_name || broker.city || broker.locality || "MatrixSpaces Partner");
                const avatar = assetPath(String(broker.avatar_url || ""), "/assets/no-photo.svg");
                const username = String(broker.username || "").trim();
                const portfolioHref = username ? `/${encodeURIComponent(username)}` : "/partners";
                return (
                  <div key={`${name}-${index}`} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: ".7rem" }}>
                    <Link href={portfolioHref} style={{ display: "flex", alignItems: "center", gap: ".6rem", color: "inherit", textDecoration: "none", minWidth: 0 }}>
                      <img src={avatar} alt={name} style={{ width: 40, height: 40, borderRadius: 999, border: "1px solid var(--ms-line)", objectFit: "cover" }} />
                      <div style={{ minWidth: 0 }}>
                        <strong style={{ display: "block", fontSize: ".95rem", lineHeight: 1.1 }}>{name}</strong>
                        <span style={{ fontSize: ".84rem", color: "var(--ms-muted)", fontWeight: 700 }}>{firm}</span>
                      </div>
                    </Link>
                    {broker.id ? (
                      <FollowPartnerButton
                        partnerId={Number(broker.id)}
                        initialFollowing={followedSet.has(Number(broker.id))}
                      />
                    ) : (
                      <Link href="/partners" style={{ color: "#1d4ed8", fontWeight: 800, fontSize: ".9rem" }}>Follow</Link>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        </aside>

        <main className="ms-home-col-scroll">
          <div className="ms-home-mobile-mode-switch">
            <Link href="/" className={mode === "for-you" ? "is-active" : ""}>For You</Link>
            <Link href="/?mode=discover" className={mode === "discover" ? "is-active" : ""}>Discover</Link>
            <Link href="/?mode=market-trends" className={mode === "market-trends" ? "is-active" : ""}>Market Trends</Link>
          </div>

          <section className="ms-home-panel" style={{ padding: ".85rem", marginBottom: "1rem" }}>
            <h3 style={{ margin: "0 0 .7rem", fontSize: "1.1rem" }}>Quick Search</h3>
            <HomeSearchPanel />
          </section>

          {feedProperties.map((property, index) => {
            const photos = parsePhotos(property.photos, property.photo || property.image_url);
            const title = property.title || `${titleCase(property.type)} space`;
            const location = property.locality || property.city || "Location on request";
            const partnerSeed = partners[index % Math.max(partners.length, 1)] as Record<string, unknown> | undefined;
            const headerPartnerId = Number(partnerSeed?.id ?? 0);
            const profileName = String(partnerSeed?.username || partnerSeed?.name || property.locality || property.city || "MatrixSpaces");
            const profileAvatar = assetPath(String(partnerSeed?.avatar_url || ""), "/assets/no-photo.svg");

            return (
              <article className="ms-home-feed-card" key={property.id}>
                <div className="ms-home-card-head">
                  <div style={{ display: "flex", alignItems: "center", gap: ".65rem" }}>
                    <img src={profileAvatar} alt={profileName} style={{ width: 38, height: 38, borderRadius: 999, border: "1px solid var(--ms-line)", objectFit: "cover" }} />
                    <div className="ms-home-card-profile">
                      <strong style={{ fontSize: ".98rem" }}>{profileName}</strong>
                      <p style={{ margin: ".15rem 0 0", fontSize: ".85rem", color: "var(--ms-muted)", fontWeight: 700 }}>
                        {relativeUploadTime(property)}
                      </p>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: ".7rem" }}>
                    {headerPartnerId > 0 ? (
                      <FollowPartnerButton
                        partnerId={headerPartnerId}
                        initialFollowing={followedSet.has(headerPartnerId)}
                        variant="button"
                      />
                    ) : null}
                    <button type="button" style={{ border: 0, background: "transparent", color: "var(--ms-muted)", cursor: "pointer" }}>
                      <Ellipsis size={18} aria-hidden />
                    </button>
                  </div>
                </div>

                <PropertyPhotoCarousel photos={photos} alt={title} href={`/property/${property.id}`} aspectRatio="16 / 11" className="ms-home-media" showCounter>
                  {property.is_matrix_verified ? (
                    <span style={{ position: "absolute", left: 14, top: 14, zIndex: 3, display: "inline-flex", alignItems: "center", gap: 5, borderRadius: 7, background: "#059669", color: "white", padding: ".35rem .6rem", fontWeight: 800, fontSize: ".82rem" }}>
                      <ShieldCheck size={14} aria-hidden />
                      Verified
                    </span>
                  ) : null}
                </PropertyPhotoCarousel>

                <div className="ms-home-content">
                  <div className="ms-home-price-row">
                    <strong className="ms-home-price">{money(property.final_price ?? property.price ?? property.rent)}</strong>
                    <div className="ms-home-actions">
                      <PropertyActions propertyId={property.id} title={title} />
                    </div>
                  </div>
                  <p className="ms-home-title" style={{ margin: 0, fontSize: "1.16rem", lineHeight: 1.35 }}>
                    {title} • {location}
                  </p>
                  <div className="ms-home-meta" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: ".75rem", color: "var(--ms-muted)", fontSize: ".98rem", fontWeight: 700 }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                      <BedDouble size={15} aria-hidden />
                      {featureLine(property)}
                    </span>
                  </div>
                  <div className="ms-home-cta-row">
                    <Link className="btn btn-primary" href={`/property/${property.id}`} style={{ borderRadius: 8 }}>
                      View Listing
                    </Link>
                    <Link className="ms-home-chat-btn" href={`/property/${property.id}#chat`}>
                      <MessageCircle size={18} aria-hidden />
                    </Link>
                  </div>
                </div>
              </article>
            );
          })}

        </main>

        <aside className="ms-home-right ms-home-sticky ms-home-col-scroll">
          <HomeRightRail
            properties={mapProperties.length ? mapProperties : feedProperties}
            trendingSearches={trendingSearches.length ? trendingSearches : ["Commercial", "Office", "Verified"]}
            spotlight={spotlight}
          />
        </aside>
      </div>
    </div>
  );
}
