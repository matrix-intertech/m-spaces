import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BadgeCheck, Building2, CalendarCheck, CheckCircle2, Compass, Home, IndianRupee, Layers3, MapPin, MessageCircle, Ruler, ShieldCheck, Tag, Wind } from "lucide-react";
import { StartChatButton } from "@/components/chat/StartChatButton";
import { AreaConverter } from "@/components/property/AreaConverter";
import { PropertyShowcaseGallery } from "@/components/property/PropertyShowcaseGallery";
import { PropertyMapIsland } from "@/components/map/PropertyMapIsland";
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

function formatMonthYear(value: string | null | undefined) {
  if (!value) return "Currently available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Currently available";
  return new Intl.DateTimeFormat("en-IN", {
    month: "short",
    year: "numeric",
  }).format(date);
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
  const description = cleanPropertyDescription(property.description ?? property.condition);
  const addressLine = property.title || titleCase(property.type) || "MatrixSpaces property";
  const addressSubLine = [property.locality, property.city].filter(Boolean).join(", ") || "Location available on request";
  const listedSince = formatMonthYear(property.listed_at ?? property.created_at);
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
  const locationSpecificationFact = {
    label: "Location",
    icon: MapPin,
    value: property.locality || property.city || "On request",
    subtext: location
  };
  const specificationFacts = [
    ...propertyFacts.slice(0, 1),
    locationSpecificationFact,
    ...propertyFacts.slice(1),
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
  const overviewCards = [
    { label: askingPriceLabel, value: price, helper: pricePerSqft ? `Approx. Rs ${formatIndianNumber(pricePerSqft)} / sq.ft` : "Pricing available on request" },
    { label: "Availability", value: titleCase(property.status) || "Listed", helper: `Live since ${listedSince}` },
    { label: "Property type", value: titleCase(property.type) || "Commercial", helper: titleCase(property.ownership_type || "managed").replace(/_/g, " ") },
    { label: "Area", value: areaValue ? `${formatIndianNumber(areaValue)} sq.ft` : factLabel(property.size), helper: property.locality || property.city || "Location shared on request" }
  ];
  const standoutPoints = [
    property.is_matrix_verified ? "Matrix-verified listing with cleaner trust signals for faster shortlisting." : "Active live listing ready for immediate enquiry and visit coordination.",
    areaValue ? `Roughly ${formatIndianNumber(areaValue)} sq.ft of usable footprint for commercial planning.` : "Size details can be confirmed directly with the property manager.",
    pricePerSqft ? `Pricing works out to around Rs ${formatIndianNumber(pricePerSqft)} per sq.ft for a quicker value benchmark.` : `${askingPriceLabel} is available for direct commercial discussion.`,
    facts.floorNumber || facts.totalFloors ? `Positioned at ${factLabel(facts.floorNumber && facts.totalFloors ? `${facts.floorNumber} of ${facts.totalFloors} floors` : facts.floorNumber || facts.totalFloors)}.` : null,
  ].filter((item): item is string => Boolean(item));
  const sectionLinks = [
    { href: "#overview", label: "Overview" },
    { href: "#specifications", label: "Specifications" },
    ...(amenities.length ? [{ href: "#amenities", label: "Amenities" }] : []),
    { href: "#location", label: "Location" },
  ];

  return (
    <main className="bg-[linear-gradient(180deg,rgba(255,255,255,1)_0%,rgba(250,248,242,0.92)_100%)] pb-16 pt-6 md:pt-10">
      <div className="container grid gap-6">
        <section className="grid gap-6">
          <div className="grid gap-5">
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

            <div className="grid gap-3">
              <div>
                <h1 className="m-0 max-w-5xl text-3xl font-black leading-tight tracking-tight text-slate-950 md:text-[3.4rem]">{title}</h1>
                <p className="mt-3 flex max-w-3xl items-start gap-2 text-base font-semibold leading-relaxed text-slate-600">
                  <MapPin className="mt-0.5 h-5 w-5 flex-none text-red-600" aria-hidden />
                  {location}
                </p>
              </div>
            </div>

            <PropertyShowcaseGallery
              photos={photos}
              alt={title}
              priority
              sidebar={
                <section className="overflow-hidden rounded-xl border border-[#e6dcc8] bg-white shadow-[0_22px_60px_-34px_rgba(15,23,42,0.28)]">
                  <div className="border-b border-[#efe5d2] bg-[#fffaf0] px-5 py-4">
                    <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">{askingPriceLabel}</p>
                    <div className="mt-2 flex items-end justify-between gap-4">
                      <strong className="text-4xl font-black text-slate-950">{price}</strong>
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-black uppercase tracking-wide text-slate-600 shadow-sm">
                        {listedSince}
                      </span>
                    </div>
                  </div>

                  <div className="grid gap-4 p-5">
                    <dl className="grid grid-cols-2 gap-3">
                      {sidebarFacts.map((fact) => {
                        const Icon = fact.icon;
                        return (
                          <div key={fact.label} className="rounded-xl border border-slate-200 bg-[#fffdf8] p-3">
                            <dt className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wide text-slate-500">
                              <Icon className="h-4 w-4 text-red-600" aria-hidden />
                              {fact.label}
                            </dt>
                            <dd className="mt-2 text-sm font-black leading-6 text-slate-900">{fact.value}</dd>
                          </div>
                        );
                      })}
                    </dl>

                  </div>
                </section>
              }
            />

            <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-stretch">
              <div className="grid gap-4">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {overviewCards.map((card) => (
                    <div
                      key={card.label}
                      className="rounded-xl border border-[#e6dcc8] bg-[#fffdf8] px-5 py-4 shadow-[0_18px_50px_-32px_rgba(15,23,42,0.24)]"
                    >
                      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">{card.label}</p>
                      <p className="mt-2 text-lg font-black text-slate-950">{card.value}</p>
                      <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">{card.helper}</p>
                    </div>
                  ))}
                </div>

                <article id="overview" className="surface rounded-xl p-5 md:p-6">
                  <h2 className="m-0 text-2xl font-black text-slate-950">About this property</h2>
                  <p className="mt-4 text-base font-medium leading-8 text-slate-600">
                    {description || `${titleCase(property.type) || "Commercial"} property in ${property.locality || property.city || "a strategic market"} with active MatrixSpaces listing support.`}
                  </p>
                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-slate-200 bg-white p-4">
                      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Address snapshot</p>
                      <p className="mt-2 text-sm font-black leading-6 text-slate-900">{addressLine}</p>
                      <p className="mt-1 text-sm font-medium leading-6 text-slate-500">{addressSubLine}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white p-4">
                      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Commercial fit</p>
                      <p className="mt-2 text-sm font-black leading-6 text-slate-900">{titleCase(property.type) || "Commercial"} use case</p>
                      <p className="mt-1 text-sm font-medium leading-6 text-slate-500">
                        {titleCase(property.listing_type) || "Active"} listing with {property.is_matrix_verified ? "verification support" : "live platform visibility"}.
                      </p>
                    </div>
                  </div>
                </article>

                <section id="specifications" className="surface rounded-xl p-5 md:p-6">
                  <h2 className="m-0 text-2xl font-black text-slate-950">Specifications</h2>
                  <div className="mt-4 grid auto-rows-fr gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {specificationFacts.map((item) => {
                      const Icon = item.icon;
                      const hasConverter = "converter" in item && item.converter;

                      if (hasConverter) {
                        return <div key={item.label} className="h-full">{item.converter}</div>;
                      }

                      return (
                        <div key={item.label} className="flex h-full min-h-[128px] flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-slate-400">
                            <Icon className="h-4 w-4 text-red-600" aria-hidden />
                            {item.label}
                          </div>
                          <p className="mt-3 text-sm font-black leading-6 text-slate-950">{item.value}</p>
                          {"subtext" in item && item.subtext ? (
                            <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">{item.subtext}</p>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </section>
              </div>

              <aside className="grid h-full gap-3 xl:grid-rows-[auto_auto_1fr]">
                <div className="rounded-xl border border-slate-200 bg-slate-50/90 p-4">
                  <h2 className="m-0 text-base font-black text-slate-950">Why this property stands out</h2>
                  <ul className="mt-3 grid gap-2.5">
                    {standoutPoints.slice(0, 3).map((point) => (
                      <li key={point} className="flex items-start gap-2 text-sm font-medium leading-5.5 text-slate-600">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 flex-none text-emerald-600" aria-hidden />
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm">
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

                <div className="surface h-full rounded-xl p-3.5">
                  <h2 className="m-0 text-lg font-black text-slate-950">Quick read</h2>
                  <div className="mt-3 grid h-[calc(100%-2rem)] auto-rows-fr gap-2">
                    {propertyFacts.slice(0, 4).map((item) => {
                      const Icon = item.icon;
                      return (
                        <div key={item.label} className="h-full rounded-xl border border-slate-200 bg-white px-3 py-2.5">
                          <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">
                            <Icon className="h-4 w-4 text-red-600" aria-hidden />
                            {item.label}
                          </div>
                          <p className="mt-1 text-sm font-black leading-5 text-slate-900">{item.value}</p>
                          {"subtext" in item && item.subtext ? (
                            <p className="mt-0.5 text-xs font-semibold leading-4.5 text-slate-500">{item.subtext}</p>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>

              </aside>
            </section>
          </div>
        </section>

        {amenities.length ? (
          <section id="amenities" className="surface rounded-xl p-5 md:p-6">
            <h2 className="m-0 text-2xl font-black text-slate-950">Amenities</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {amenities.map((amenity) => (
                <span key={amenity} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 text-sm font-bold text-slate-700">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" aria-hidden />
                  {amenity}
                </span>
              ))}
            </div>
          </section>
        ) : null}

        <section id="location" className="grid gap-4">
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <PropertyMapIsland properties={[property]} showNearbyPlaces />
          </div>
        </section>
      </div>
    </main>
  );
}
