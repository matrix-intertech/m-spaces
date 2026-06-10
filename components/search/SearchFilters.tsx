import Link from "next/link";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { PlaceAutocomplete } from "@/components/search/PlaceAutocomplete";

type SearchParamValue = string | string[] | undefined;

function normalizeValue(value: SearchParamValue) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function buildQueryWithout(searchParams: Record<string, SearchParamValue> | undefined, keyToRemove?: string) {
  const query = new URLSearchParams();
  Object.entries(searchParams ?? {}).forEach(([key, value]) => {
    if (key === keyToRemove) return;
    if (keyToRemove === "locality" && (key === "lat" || key === "lng")) return;
    if (Array.isArray(value)) {
      value.filter(Boolean).forEach((item) => query.append(key, item));
      return;
    }
    if (value) query.set(key, value);
  });
  return query.toString() ? `/search?${query.toString()}` : "/search";
}

export function SearchFilters({ searchParams }: { searchParams?: Record<string, SearchParamValue> }) {
  const getValue = (key: string) => normalizeValue(searchParams?.[key]);
  const appliedFilters = [
    getValue("locality") ? { key: "locality", label: getValue("locality") } : null,
    getValue("type") ? { key: "type", label: `Type: ${getValue("type")}` } : null,
    getValue("listingType")
      ? {
          key: "listingType",
          label: getValue("listingType") === "sale" ? "Buy" : getValue("listingType") === "pg" ? "PG / Co-living" : "Rent"
        }
      : null,
    getValue("minPrice") ? { key: "minPrice", label: `Min ${getValue("minPrice")}` } : null,
    getValue("maxPrice") ? { key: "maxPrice", label: `Max ${getValue("maxPrice")}` } : null,
    getValue("size") ? { key: "size", label: `Area: ${getValue("size")}` } : null,
    getValue("condition") ? { key: "condition", label: getValue("condition") } : null,
    getValue("verifiedOnly") === "true" ? { key: "verifiedOnly", label: "Verified only" } : null,
    getValue("sortBy") ? { key: "sortBy", label: `Sort: ${getValue("sortBy").replace("_", " ")}` } : null
  ].filter((item): item is { key: string; label: string } => Boolean(item));

  return (
    <div>
      <form action="/search" className="surface grid gap-4 rounded-[26px] border border-white/80 px-4 py-4 md:px-5">
        <div className="grid gap-3 xl:grid-cols-[minmax(220px,1.4fr)_minmax(180px,.95fr)_minmax(180px,.95fr)_minmax(150px,.8fr)_minmax(130px,.7fr)_minmax(130px,.7fr)_auto]">
          <div className="grid gap-1.5">
            <span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Locality</span>
            <PlaceAutocomplete defaultValue={getValue("locality")} defaultLat={getValue("lat")} defaultLng={getValue("lng")} />
          </div>

          <label className="grid gap-1.5">
            <span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Keyword</span>
            <input className="field" name="search" defaultValue={getValue("search")} placeholder="Office, retail, coworking..." />
          </label>

          <label className="grid gap-1.5">
            <span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Type</span>
            <select className="field" name="type" defaultValue={getValue("type")}>
              <option value="">Any type</option>
              <option value="office">Office</option>
              <option value="retail">Retail</option>
              <option value="warehouse">Warehouse</option>
              <option value="coworking">Coworking</option>
            </select>
          </label>

          <label className="grid gap-1.5">
            <span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Purpose</span>
            <select className="field" name="listingType" defaultValue={getValue("listingType")}>
              <option value="">Any</option>
              <option value="rent">Rent</option>
              <option value="sale">Buy</option>
              <option value="pg">PG / Co-living</option>
            </select>
          </label>

          <label className="grid gap-1.5">
            <span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Min Budget</span>
            <input className="field" name="minPrice" inputMode="numeric" defaultValue={getValue("minPrice")} placeholder="0" />
          </label>

          <label className="grid gap-1.5">
            <span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Max Budget</span>
            <input className="field" name="maxPrice" inputMode="numeric" defaultValue={getValue("maxPrice")} placeholder="Any" />
          </label>

          <button className="btn btn-primary mt-auto rounded-[18px] px-5" type="submit">
            <Search size={18} aria-hidden />
            Search
          </button>
        </div>

        <div className="grid gap-3 xl:grid-cols-[minmax(150px,.8fr)_minmax(170px,.95fr)_minmax(180px,.95fr)_auto_auto] xl:items-end">
          <label className="grid gap-1.5">
            <span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Area / Size</span>
            <input className="field" name="size" defaultValue={getValue("size")} placeholder="e.g. 2000" />
          </label>

          <label className="grid gap-1.5">
            <span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Condition</span>
            <input className="field" name="condition" defaultValue={getValue("condition")} placeholder="Ready, furnished, shell..." />
          </label>

          <label className="grid gap-1.5">
            <span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Sort By</span>
            <select className="field" name="sortBy" defaultValue={getValue("sortBy")}>
              <option value="">Relevant</option>
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="price_asc">Price low to high</option>
              <option value="price_desc">Price high to low</option>
            </select>
          </label>

          <label className="inline-flex min-h-[46px] cursor-pointer items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-4 text-sm font-bold text-slate-700">
            <input name="verifiedOnly" type="checkbox" value="true" defaultChecked={getValue("verifiedOnly") === "true"} />
            <SlidersHorizontal className="h-4 w-4 text-red-600" aria-hidden />
            Verified Only
          </label>

          <div className="flex flex-wrap gap-2 xl:justify-end">
            <Link href="/search" className="btn btn-secondary rounded-full px-4">
              <X className="h-4 w-4" aria-hidden />
              Clear all
            </Link>
          </div>
        </div>

        {appliedFilters.length ? (
          <div className="flex flex-wrap items-center gap-2 border-t border-slate-200/80 pt-3">
            <span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Applied Filters</span>
            {appliedFilters.map((filter) => (
              <Link
                key={filter.key}
                href={buildQueryWithout(searchParams, filter.key)}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-black text-slate-600 transition-colors hover:border-red-200 hover:text-red-700"
              >
                {filter.label}
                <X className="h-3.5 w-3.5" aria-hidden />
              </Link>
            ))}
          </div>
        ) : null}
      </form>
    </div>
  );
}
