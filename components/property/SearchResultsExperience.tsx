"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Clock3, List, Map as MapIcon, MapPinned, Sparkles, X } from "lucide-react";
import { PropertyMapIsland } from "@/components/map/PropertyMapIsland";
import { PropertyGrid } from "@/components/property/PropertyGrid";
import { SearchFilters } from "@/components/search/SearchFilters";
import { assetPath, formatIndianNumber, parsePhotos, titleCase } from "@/lib/format";
import type { Pagination, Property } from "@/types";

type SearchParamValue = string | string[] | undefined;

function normalizeValue(value: SearchParamValue) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function buildHref(searchParams: Record<string, SearchParamValue> | undefined, page: number) {
  const params = new URLSearchParams();
  Object.entries(searchParams ?? {}).forEach(([key, value]) => {
    if (key === "page") return;
    if (Array.isArray(value)) {
      value.filter(Boolean).forEach((item) => params.append(key, item));
      return;
    }
    if (value) params.set(key, value);
  });
  params.set("page", String(page));
  return `/search?${params.toString()}`;
}

function appliedFilters(searchParams?: Record<string, SearchParamValue>) {
  const values = [
    normalizeValue(searchParams?.locality) ? { label: normalizeValue(searchParams?.locality), key: "locality" } : null,
    normalizeValue(searchParams?.search) ? { label: `Keyword: ${normalizeValue(searchParams?.search)}`, key: "search" } : null,
    normalizeValue(searchParams?.type) ? { label: `Type: ${titleCase(normalizeValue(searchParams?.type))}`, key: "type" } : null,
    normalizeValue(searchParams?.listingType)
      ? {
          label:
            normalizeValue(searchParams?.listingType) === "sale"
              ? "Buy"
              : normalizeValue(searchParams?.listingType) === "pg"
                ? "PG / Co-living"
                : "Rent",
          key: "listingType"
        }
      : null,
    normalizeValue(searchParams?.minPrice) ? { label: `Min ${normalizeValue(searchParams?.minPrice)}`, key: "minPrice" } : null,
    normalizeValue(searchParams?.maxPrice) ? { label: `Max ${normalizeValue(searchParams?.maxPrice)}`, key: "maxPrice" } : null,
    normalizeValue(searchParams?.size) ? { label: `Area ${normalizeValue(searchParams?.size)}`, key: "size" } : null,
    normalizeValue(searchParams?.condition) ? { label: titleCase(normalizeValue(searchParams?.condition)), key: "condition" } : null,
    normalizeValue(searchParams?.verifiedOnly) === "true" ? { label: "Verified only", key: "verifiedOnly" } : null
  ];
  return values.filter((value): value is { label: string; key: string } => Boolean(value));
}

function queryWithout(searchParams: Record<string, SearchParamValue> | undefined, keyToRemove: string) {
  const params = new URLSearchParams();
  Object.entries(searchParams ?? {}).forEach(([key, value]) => {
    if (key === keyToRemove) return;
    if (keyToRemove === "locality" && (key === "lat" || key === "lng")) return;
    if (Array.isArray(value)) {
      value.filter(Boolean).forEach((item) => params.append(key, item));
      return;
    }
    if (value) params.set(key, value);
  });
  return params.toString() ? `/search?${params.toString()}` : "/search";
}

function localityInsights(properties: Property[]) {
  const localityMap = new globalThis.Map<string, number>();
  properties.forEach((property) => {
    const locality = String(property.locality || property.city || "").trim();
    if (!locality) return;
    localityMap.set(locality, (localityMap.get(locality) ?? 0) + 1);
  });
  return Array.from(localityMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([name, count]) => ({ name, count }));
}

function recommendationImage(property: Property) {
  return assetPath(parsePhotos(property.photos, property.photo || property.image_url)[0], "/assets/no-photo.svg");
}

export function SearchResultsExperience({
  title,
  subtitle,
  properties,
  pagination,
  searchParams,
  recommendedProperties = [],
  recentlyViewedProperties = []
}: {
  title: string;
  subtitle: string;
  properties: Property[];
  pagination?: Pagination;
  searchParams?: Record<string, SearchParamValue>;
  recommendedProperties?: Property[];
  recentlyViewedProperties?: Property[];
}) {
  const [viewMode, setViewMode] = useState<"split" | "map">("split");
  const [isWideDesktop, setIsWideDesktop] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 1280px)");
    const sync = () => setIsWideDesktop(mediaQuery.matches);
    sync();
    mediaQuery.addEventListener("change", sync);
    return () => mediaQuery.removeEventListener("change", sync);
  }, []);

  const chips = useMemo(() => appliedFilters(searchParams), [searchParams]);
  const hotspots = useMemo(() => localityInsights(properties), [properties]);
  const activeLocality = normalizeValue(searchParams?.locality) || normalizeValue(searchParams?.search) || "India";
  const total = pagination?.total ?? properties.length;
  const totalPages = Math.max(pagination?.totalPages ?? 1, 1);
  const currentPage = pagination?.page ?? 1;
  const showList = viewMode !== "map";
  const showDesktopSplitRail = viewMode === "split" && isWideDesktop;
  const paginationWindow = Array.from({ length: totalPages }, (_, index) => index + 1).filter((page) => {
    if (totalPages <= 7) return true;
    return Math.abs(page - currentPage) <= 1 || page === 1 || page === totalPages;
  });

  const recommendationRail = (
    <div className="grid gap-4">
      {recommendedProperties.length ? (
        <section className="surface rounded-[28px] border border-white/75 p-5">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-red-600" aria-hidden />
            <h3 className="m-0 text-lg font-black text-slate-950">Recommended Nearby</h3>
          </div>
          <p className="mt-2 text-sm font-medium text-slate-500">Based on your recent activity and viewed inventory.</p>
          <div className="mt-4 grid gap-3">
            {recommendedProperties.slice(0, 3).map((property) => (
              <Link key={property.id} href={`/property/${property.id}`} className="grid grid-cols-[88px_minmax(0,1fr)] gap-3 rounded-[20px] border border-slate-200 bg-white p-3 transition-transform hover:-translate-y-0.5">
                <img src={recommendationImage(property)} alt={property.title || "Property"} className="h-[88px] w-[88px] rounded-2xl object-cover" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-slate-950">{property.title || property.type || "Property"}</p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">{property.locality || property.city || "Location on request"}</p>
                  <p className="mt-2 text-sm font-black text-red-700">{property.final_price ? formatIndianNumber(property.final_price) : "Price on request"}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {recentlyViewedProperties.length ? (
        <section className="surface rounded-[28px] border border-white/75 p-5">
          <h3 className="m-0 text-lg font-black text-slate-950">Recently Viewed</h3>
          <p className="mt-2 text-sm font-medium text-slate-500">Jump back into properties you were already exploring.</p>
          <div className="mt-4 grid gap-3">
            {recentlyViewedProperties.slice(0, 3).map((property) => (
              <Link key={property.id} href={`/property/${property.id}`} className="rounded-[18px] border border-slate-200 bg-white p-3 transition-colors hover:border-red-200">
                <p className="m-0 text-sm font-black text-slate-950">{property.title || property.type || "Property"}</p>
                <p className="mt-1 text-xs font-semibold text-slate-500">{property.locality || property.city || "Location on request"}</p>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );

  return (
    <div className="container grid gap-5 py-6 md:py-8">
      <section className="surface rounded-[30px] border border-white/75 px-5 py-5 md:px-6">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
          <div className="grid gap-3">
            <div>
              <p className="m-0 text-[11px] font-black uppercase tracking-[0.24em] text-red-700">Property Discovery Feed</p>
              <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950 md:text-4xl">{title}</h2>
              <p className="mt-2 max-w-3xl text-sm font-medium leading-7 text-slate-500">{subtitle}</p>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-sm font-semibold text-slate-600">
              <span className="rounded-full bg-red-50 px-3 py-1 text-red-700">{formatIndianNumber(total)} properties found</span>
              <span>{activeLocality}</span>
              <span className="inline-flex items-center gap-1">
                <Clock3 className="h-4 w-4 text-red-600" aria-hidden />
                Live results
              </span>
            </div>

            {chips.length ? (
              <div className="flex flex-wrap gap-2">
                {chips.map((chip) => (
                  <Link
                    key={chip.key}
                    href={queryWithout(searchParams, chip.key)}
                    className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-black text-slate-600 transition-colors hover:border-red-200 hover:text-red-700"
                  >
                    {chip.label}
                    <X className="h-3.5 w-3.5" aria-hidden />
                  </Link>
                ))}
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2 lg:justify-end">
            <button type="button" onClick={() => setViewMode("split")} className={`btn rounded-full px-4 ${viewMode === "split" ? "btn-primary" : "btn-secondary"}`}>
              <MapPinned className="h-4 w-4" aria-hidden />
              Split View
            </button>
            <button type="button" onClick={() => setViewMode("map")} className={`btn rounded-full px-4 ${viewMode === "map" ? "btn-primary" : "btn-secondary"}`}>
              <MapIcon className="h-4 w-4" aria-hidden />
              Map View
            </button>
          </div>
        </div>
      </section>

      <SearchFilters searchParams={searchParams} />

      <section className="surface flex flex-wrap items-center gap-3 rounded-[24px] border border-white/75 px-5 py-4">
        <span className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Trending Localities</span>
        {hotspots.length ? hotspots.map((spot) => (
          <span key={spot.name} className="rounded-full bg-white px-3 py-1 text-xs font-black text-slate-600">
            {spot.name} - {spot.count}
          </span>
        )) : <span className="text-sm font-semibold text-slate-500">Add a locality filter to focus the feed.</span>}
      </section>

      {viewMode === "map" ? (
        <section className="grid gap-4">
          <div className="surface overflow-hidden rounded-[30px] border border-white/80 p-4">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div className="grid gap-1">
                <p className="m-0 text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Discovery Map</p>
                <p className="m-0 text-lg font-black text-slate-950">Opportunity clusters around {activeLocality}</p>
                <p className="m-0 text-sm font-medium leading-6 text-slate-500">
                  Use the map to understand locality spread, nearby listing pockets, and where the strongest matches are concentrated.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-black text-red-700">{properties.length} pins</span>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-slate-600">Interactive search</span>
              </div>
            </div>
            <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-white">
              <PropertyMapIsland properties={properties} height={720} showSearchControl />
            </div>
          </div>
          {recommendationRail}
        </section>
      ) : (
        <section className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="grid gap-4">
            {showList ? <PropertyGrid properties={properties} variant="grid" /> : null}

            {pagination ? (
              <div className="surface flex flex-wrap items-center justify-between gap-3 rounded-[26px] border border-white/75 px-5 py-4">
                <p className="m-0 text-sm font-semibold text-slate-500">
                  Page {currentPage} of {totalPages}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Link
                    href={buildHref(searchParams, Math.max(1, currentPage - 1))}
                    aria-disabled={currentPage <= 1}
                    className={`btn rounded-full px-4 ${currentPage <= 1 ? "pointer-events-none opacity-50" : "btn-secondary"}`}
                  >
                    Previous
                  </Link>
                  {paginationWindow.map((page, index) => {
                    const prevPage = paginationWindow[index - 1];
                    const showGap = typeof prevPage === "number" && page - prevPage > 1;
                    return (
                      <div key={page} className="contents">
                        {showGap ? <span className="self-center px-1 text-sm font-black text-slate-400">...</span> : null}
                        <Link href={buildHref(searchParams, page)} className={`btn rounded-full px-4 ${page === currentPage ? "btn-primary" : "btn-secondary"}`}>
                          {page}
                        </Link>
                      </div>
                    );
                  })}
                  <Link
                    href={buildHref(searchParams, Math.min(totalPages, currentPage + 1))}
                    aria-disabled={currentPage >= totalPages}
                    className={`btn rounded-full px-4 ${currentPage >= totalPages ? "pointer-events-none opacity-50" : "btn-secondary"}`}
                  >
                    Next
                  </Link>
                </div>
              </div>
            ) : null}
          </div>

          <div className="grid content-start gap-4">
            {showDesktopSplitRail ? (
              <aside className="surface sticky top-[110px] self-start overflow-hidden rounded-[30px] border border-white/80 p-4">
                <div className="mb-4 grid gap-2">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="m-0 text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Discovery Map</p>
                      <p className="mt-1 text-base font-black text-slate-950">Quick locality scan</p>
                    </div>
                    <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-black text-red-700">{properties.length} pins</span>
                  </div>
                </div>
                <div className="overflow-hidden rounded-[22px] border border-slate-200 bg-white">
                  <PropertyMapIsland properties={properties} height={520} showSearchControl={false} />
                </div>
              </aside>
            ) : null}

            {recommendationRail}
          </div>
        </section>
      )}
    </div>
  );
}
