import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BadgeCheck, Building2, CalendarCheck, CheckCircle2, Compass, Home, IndianRupee, Layers3, MapPin, MessageCircle, Ruler, ShieldCheck, Tag, Wind } from "lucide-react";
import { StartChatButton } from "@/components/chat/StartChatButton";
import { AreaConverter } from "@/components/property/AreaConverter";
import { PropertyMapIsland } from "@/components/map/PropertyMapIsland";
import { PropertyPhotoCarousel } from "@/components/property/PropertyPhotoCarousel";
import { backendBaseUrl } from "@/lib/config";
import { formatIndianNumber, money, parsePhotos, titleCase } from "@/lib/format";
import { cleanPropertyDescription, extractPropertyFacts } from "@/lib/propertyFacts";
import { getCsrfToken, getCurrentUser, getProperty } from "@/services/api";
import type { Property } from "@/types";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const property = await getProperty(id);
  return {
    title: property?.title ?? "Property Details",
    description: cleanPropertyDescription(property?.description ?? property?.condition) || `MatrixSpaces property ${id}`
  };
}

function parseAmenities(value: Property["amenities"]): string[] {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.filter(Boolean);
    } catch {
      return value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    }
  }
  return [];
}

function factLabel(value: string | number | null | undefined, fallback = "On request") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function parseNumericValue(value: unknown) {
  const text = String(value ?? "").replace(/,/g, "").trim();
  const match = text.match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const amount = Number(match[0]);
  return Number.isFinite(amount) ? amount : null;
}

function formatCompactRupees(value: unknown) {
  const amount = parseNumericValue(value);
  if (!amount || amount <= 0) return "Price on request";
  const absolute = Math.abs(amount);
  if (absolute >= 1_00_00_000) return `₹ ${formatIndianNumber(amount / 1_00_00_000)} Cr`;
  if (absolute >= 1_00_000) return `₹ ${formatIndianNumber(amount / 1_00_000)} Lac`;
  return money(amount);
}

function isNegotiable(value: string) {
  const normalized = value.trim().toLowerCase();
  return normalized === "yes" || normalized === "true" || normalized === "negotiable";
}

function priceSuffix(listingType: string | null | undefined) {
  return listingType === "rent" ? " /month" : "";
}

export default async function PropertyDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [property, currentUser, csrfToken] = await Promise.all([getProperty(id), getCurrentUser(), getCsrfToken()]);
  if (!property) notFound();

  const photos = parsePhotos(property.photos, property.photo || property.image_url);
  const title = property.title || `${titleCase(property.type)} Space in ${property.locality || property.city || "India"}`;
  const facts = extractPropertyFacts(property.condition);
  const price = formatCompactRupees(property.final_price ?? property.price ?? property.rent);
  const areaValue = parseNumericValue(property.size);
  const priceValue = parseNumericValue(property.final_price ?? property.price ?? property.rent);
  const pricePerSqft = areaValue && priceValue ? Math.round(priceValue / areaValue) : null;
  const location = property.address || [property.locality, property.city].filter(Boolean).join(", ") || "Location available on request";
  const amenities = parseAmenities(property.amenities);
  const description = cleanPropertyDescription(property.condition);
  const addressLine = property.title || titleCase(property.type) || "MatrixSpaces property";
  const addressSubLine = [property.locality, property.city].filter(Boolean).join(", ") || "Location available on request";
  const propertyFacts = [
    {
      label: "Area",
      icon: Ruler,
      value: areaValue ? `Carpet area: ${formatIndianNumber(areaValue)} sq.ft` : factLabel(property.size),
      converter: areaValue ? <AreaConverter value={areaValue} /> : null
    },
    {
      label: "Configuration",
      icon: Building2,
      value: factLabel(facts.configuration)
    },
    {
      label: "Price",
      icon: IndianRupee,
      value: `${price}${priceSuffix(property.listing_type)}`,
      subtext: pricePerSqft ? `@ ₹ ${formatIndianNumber(pricePerSqft)} per sqft${isNegotiable(facts.negotiable) ? " (Negotiable)" : ""}` : isNegotiable(facts.negotiable) ? "Negotiable" : ""
    },
    {
      label: "Address",
      icon: Home,
      value: addressLine,
      subtext: addressSubLine
    },
    {
      label: "Floor Number",
      icon: Layers3,
      value: factLabel(facts.floorNumber && facts.totalFloors ? `${facts.floorNumber} of ${facts.totalFloors} floors` : facts.floorNumber || facts.totalFloors)
    },
    {
      label: "Facing",
      icon: Compass,
      value: factLabel(facts.facing || property.facing)
    },
    {
      label: "Overlooking",
      icon: Wind,
      value: factLabel(facts.overlooking)
    },
    {
      label: "Property Age",
      icon: CalendarCheck,
      value: factLabel(facts.propertyAge)
    }
  ];
  const sidebarFacts = [
    { label: "Property Type", value: titleCase(property.type) || "Commercial", icon: Building2 },
    { label: "Area", value: property.size ? `${property.size} sq.ft` : "On request", icon: Ruler },
    { label: "Listing", value: titleCase(property.listing_type) || "Available", icon: Tag },
    { label: "Condition", value: titleCase(property.condition) || titleCase(property.status) || "Listed", icon: CheckCircle2 }
  ];
  const askingPriceLabel =
    property.listing_type === "rent"
      ? "Monthly rent"
      : property.listing_type === "lease"
        ? "Lease amount"
        : "Asking price";

  return (
    <main className="bg-slate-50/70 pb-16 pt-6 md:pt-10">
      <div className="container grid gap-6">
        <section className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_380px] lg:items-start">
          <div className="grid gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-black uppercase tracking-wide text-slate-700 shadow-sm">
                <Tag className="h-4 w-4 text-red-600" aria-hidden />
                {titleCase(property.listing_type) || "Available"}
              </span>
              {property.is_matrix_verified ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-black uppercase tracking-wide text-emerald-700">
                  <ShieldCheck className="h-4 w-4" aria-hidden />
                  Matrix verified
                </span>
              ) : null}
              <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-black uppercase tracking-wide shadow-sm border ${property.ownership_type === "self_owned" ? "border-blue-200 bg-blue-50 text-blue-700" : "border-amber-200 bg-amber-50 text-amber-700"}`}>
                <Home className="h-4 w-4" aria-hidden />
                {property.ownership_type === "self_owned" ? "Owner Property" : "Managed Property"}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-black uppercase tracking-wide text-slate-600 shadow-sm">
                <BadgeCheck className="h-4 w-4 text-[#D4AF37]" aria-hidden />
                ID #{property.id}
              </span>
            </div>

            <div>
              <h1 className="m-0 max-w-5xl text-3xl font-black leading-tight tracking-tight text-slate-950 md:text-5xl">{title}</h1>
              <p className="mt-3 flex max-w-3xl items-start gap-2 text-base font-semibold leading-relaxed text-slate-600">
                <MapPin className="mt-0.5 h-5 w-5 flex-none text-red-600" aria-hidden />
                {location}
              </p>
            </div>

            <PropertyPhotoCarousel
              photos={photos}
              alt={title}
              priority
              sizes="(max-width: 1024px) 100vw, 760px"
              aspectRatio="16 / 10"
              minHeight={360}
              borderRadius={8}
              className="surface"
            >
              <span className="absolute bottom-4 right-4 z-[3] rounded-full bg-slate-950/76 px-3 py-1.5 text-xs font-black text-white backdrop-blur">
                {Math.max(photos.length, 1)} photos
              </span>
            </PropertyPhotoCarousel>
          </div>

          <aside className="surface grid gap-5 rounded-lg p-5 lg:mt-[6.5rem] lg:sticky lg:top-24">
            <div className="grid gap-1">
              <span className="text-xs font-black uppercase tracking-wide text-slate-500">{askingPriceLabel}</span>
              <strong className="text-3xl font-black text-slate-950">{price}</strong>
            </div>

            <dl className="grid grid-cols-2 gap-3">
              {sidebarFacts.map((fact) => {
                const Icon = fact.icon;
                return (
                  <div key={fact.label} className="rounded-lg border border-slate-200 bg-white p-3">
                    <dt className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wide text-slate-500">
                      <Icon className="h-4 w-4 text-red-600" aria-hidden />
                      {fact.label}
                    </dt>
                    <dd className="mt-1 text-sm font-black text-slate-900">{fact.value}</dd>
                  </div>
                );
              })}
            </dl>

            <div className="grid gap-3 border-t border-slate-200 pt-5">
              <StartChatButton propertyId={property.id} />
              {currentUser ? (
                <form action={`${backendBaseUrl}/property/${property.id}/request-contact`} method="post" className="grid gap-3">
                  <input type="hidden" name="_csrf" value={csrfToken} />
                  <label className="grid gap-1.5 text-sm font-bold text-slate-700">
                    Email
                    <input className="field" name="requester_email" type="email" defaultValue={currentUser.email || ""} placeholder="you@example.com" required />
                  </label>
                  <button className="btn btn-primary w-full rounded-md" type="submit">
                    <MessageCircle size={18} aria-hidden />
                    Contact owner
                  </button>
                </form>
              ) : (
                <a className="btn btn-primary w-full rounded-md" href="/login">
                  <MessageCircle size={18} aria-hidden />
                  Login to contact owner
                </a>
              )}
              <form action={`${backendBaseUrl}/visits/schedule`} method="post">
                <input type="hidden" name="propertyId" value={property.id} />
                <button className="btn btn-secondary w-full rounded-md" type="submit">
                  <CalendarCheck size={18} aria-hidden />
                  Schedule visit
                </button>
              </form>
            </div>
          </aside>
        </section>

        <section className="grid gap-6">
          <div className="surface rounded-lg p-5 md:p-6">
            <h2 className="m-0 text-2xl font-black text-slate-950">Property Details</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {propertyFacts.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-slate-400">
                      <Icon className="h-4 w-4 text-red-600" aria-hidden />
                      {item.label}
                    </div>
                    <p className="mt-2 text-sm font-black leading-6 text-slate-950">{item.value}</p>
                    {"subtext" in item && item.subtext ? (
                      <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">{item.subtext}</p>
                    ) : null}
                    {"converter" in item && item.converter ? item.converter : null}
                  </div>
                );
              })}
            </div>
            {description ? (
              <div className="mt-5 border-t border-slate-200 pt-5">
                <h3 className="m-0 text-sm font-black uppercase tracking-wide text-slate-500">Description</h3>
                <p className="mt-3 text-base font-medium leading-8 text-slate-600">{description}</p>
              </div>
            ) : null}
          </div>
        </section>

        {amenities.length ? (
          <section className="surface rounded-lg p-5 md:p-6">
            <h2 className="m-0 text-2xl font-black text-slate-950">Amenities</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {amenities.map((amenity) => (
                <span key={amenity} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-3 text-sm font-bold text-slate-700">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" aria-hidden />
                  {amenity}
                </span>
              ))}
            </div>
          </section>
        ) : null}

        <section className="grid gap-3">
          <div>
            <h2 className="m-0 text-2xl font-black text-slate-950">Location</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">{location}</p>
          </div>
          <PropertyMapIsland properties={[property]} showNearbyPlaces />
        </section>
      </div>
    </main>
  );
}
