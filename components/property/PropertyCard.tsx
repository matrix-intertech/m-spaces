"use client";

import Link from "next/link";
import { BadgeCheck, Building2, CalendarDays, Clock3, ExternalLink, Landmark, MapPin, MessageCircle, PlayCircle, ShieldCheck, Sparkles } from "lucide-react";
import { PropertyActions } from "@/components/property/PropertyActions";
import { PropertyPhotoCarousel } from "@/components/property/PropertyPhotoCarousel";
import { backendBaseUrl } from "@/lib/config";
import { assetPath, money, parsePhotos, titleCase } from "@/lib/format";
import type { Property } from "@/types";

function firstMeaningfulText(...values: Array<string | null | undefined>) {
  return values.find((value) => typeof value === "string" && value.trim().length > 0)?.trim() ?? "";
}

function normalizePhone(value?: string | null) {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

function propertyTypeLabel(property: Property) {
  return titleCase(property.type) || "Commercial Space";
}

function listingLabel(property: Property) {
  return String(property.listing_type || "").toLowerCase() === "rent" ? "Rent" : String(property.listing_type || "").toLowerCase() === "sale" ? "Buy" : "Listing";
}

function managerMeta(property: Property) {
  if (property.assigned_broker_id || (Array.isArray(property.assigned_brokers) && property.assigned_brokers.length > 0)) {
    return {
      title: "Managed by Broker Network",
      description: "Broker-managed listing with assisted coordination",
      icon: Building2
    };
  }

  if (property.owner_id) {
    return {
      title: "Owner Listed",
      description: "Direct listing surfaced through MatrixSpaces",
      icon: Landmark
    };
  }

  return {
    title: "MatrixSpaces Listing",
    description: "Discovery-ready opportunity curated on the platform",
    icon: Sparkles
  };
}

function freshnessBadge(property: Property) {
  const timestamp = property.listed_at || property.created_at || property.updated_at;
  if (!timestamp) return null;
  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime())) return null;
  const ageInDays = (Date.now() - parsed.getTime()) / (1000 * 60 * 60 * 24);
  if (ageInDays <= 7) return "New Listing";
  if (ageInDays <= 21) return "Fresh Match";
  return null;
}

function buildBadges(property: Property, photoCount: number) {
  const badges: Array<{ label: string; tone: "green" | "red" | "slate" | "amber"; icon?: typeof BadgeCheck }> = [];
  if (property.is_matrix_verified) badges.push({ label: "Verified Property", tone: "green", icon: BadgeCheck });
  if (property.owner_id && !property.assigned_broker_id) badges.push({ label: "Verified Owner", tone: "slate", icon: ShieldCheck });
  if (property.assigned_broker_id || (Array.isArray(property.assigned_brokers) && property.assigned_brokers.length > 0)) {
    badges.push({ label: "Managed Listing", tone: "red", icon: Building2 as typeof BadgeCheck });
  }
  if (photoCount > 1) badges.push({ label: `${photoCount} Photos`, tone: "slate" });
  if (property.video_url) badges.push({ label: "Video Tour", tone: "amber", icon: PlayCircle as typeof BadgeCheck });
  const freshness = freshnessBadge(property);
  if (freshness) badges.push({ label: freshness, tone: "amber" });
  return badges.slice(0, 5);
}

function badgeClasses(tone: "green" | "red" | "slate" | "amber") {
  if (tone === "green") return "border-green-200 bg-green-50 text-green-700";
  if (tone === "red") return "border-red-200 bg-red-50 text-red-700";
  if (tone === "amber") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-slate-200 bg-white text-slate-600";
}

export function PropertyCard({ property, variant = "grid" }: { property: Property; variant?: "grid" | "list" }) {
  const photos = parsePhotos(property.photos, property.photo || property.image_url);
  const photoCount = Math.max(photos.length, 1);
  const title = property.title || `${propertyTypeLabel(property)} in ${property.locality || property.city || "India"}`;
  const price = money(property.final_price ?? property.price ?? property.rent);
  const manager = managerMeta(property);
  const badges = buildBadges(property, photoCount);
  const whatsappPhone = normalizePhone(property.contact);
  const whatsappHref = whatsappPhone
    ? `https://wa.me/${whatsappPhone}?text=${encodeURIComponent(`Hi, I'm interested in ${title} on MatrixSpaces.`)}`
    : null;
  const configurationText = firstMeaningfulText(property.configuration, property.facing, property.floor_number ? `Floor ${property.floor_number}` : undefined);
  const availabilityText = firstMeaningfulText(property.possession_status, property.status ? titleCase(property.status) : undefined, property.property_age);
  const descriptionText = firstMeaningfulText(property.description, property.condition);

  if (variant === "list") {
    const ManagerIcon = manager.icon;

    return (
      <article className="surface overflow-hidden rounded-[28px] border border-white/70">
        <div className="grid gap-0 lg:grid-cols-[minmax(280px,360px)_minmax(0,1fr)]">
          <PropertyPhotoCarousel
            photos={photos}
            alt={title}
            href={`/property/${property.id}`}
            sizes="(max-width: 1024px) 100vw, 360px"
            aspectRatio="4 / 3"
            minHeight={260}
            className="h-full min-h-[260px]"
            showCounter
          >
            <div className="absolute inset-x-0 bottom-0 z-[2] bg-gradient-to-t from-slate-950/75 via-slate-950/25 to-transparent px-4 pb-4 pt-10">
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full bg-white/95 px-3 py-1 text-[11px] font-black uppercase tracking-wide text-slate-900">
                  {listingLabel(property)}
                </span>
                {property.type ? (
                  <span className="rounded-full bg-white/15 px-3 py-1 text-[11px] font-black uppercase tracking-wide text-white backdrop-blur">
                    {propertyTypeLabel(property)}
                  </span>
                ) : null}
              </div>
            </div>
          </PropertyPhotoCarousel>

          <div className="grid gap-5 p-5 lg:p-6">
            <div className="flex flex-wrap gap-2">
              {badges.map((badge) => {
                const Icon = badge.icon;
                return (
                  <span key={badge.label} className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-wide ${badgeClasses(badge.tone)}`}>
                    {Icon ? <Icon className="h-3.5 w-3.5" aria-hidden /> : null}
                    {badge.label}
                  </span>
                );
              })}
            </div>

            <div className="grid gap-2">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="grid gap-2">
                  <Link href={`/property/${property.id}`} className="group inline-flex items-center gap-2">
                    <h3 className="m-0 text-2xl font-black leading-tight text-slate-950 transition-colors group-hover:text-red-700">{title}</h3>
                    <ExternalLink className="h-4 w-4 text-slate-400 transition-colors group-hover:text-red-600" aria-hidden />
                  </Link>
                  <p className="m-0 flex items-center gap-2 text-sm font-semibold text-slate-500">
                    <MapPin className="h-4 w-4 text-red-600" aria-hidden />
                    {property.locality || property.city || "Location shared after inquiry"}
                  </p>
                </div>

                <div className="rounded-2xl border border-red-100 bg-red-50/80 px-4 py-3 text-right">
                  <p className="m-0 text-[11px] font-black uppercase tracking-[0.2em] text-red-600">
                    {String(property.listing_type || "").toLowerCase() === "rent" ? "Monthly Rent" : "Asking Price"}
                  </p>
                  <strong className="mt-1 block text-2xl font-black text-slate-950">{price}</strong>
                </div>
              </div>

              {descriptionText ? (
                <p className="m-0 max-w-4xl text-sm font-medium leading-7 text-slate-600">
                  {descriptionText.length > 180 ? `${descriptionText.slice(0, 177)}...` : descriptionText}
                </p>
              ) : null}
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="m-0 text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Area</p>
                <p className="mt-2 text-sm font-black text-slate-900">{property.size ? `${property.size} sq.ft` : "On request"}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="m-0 text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Configuration</p>
                <p className="mt-2 text-sm font-black text-slate-900">{configurationText || propertyTypeLabel(property)}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="m-0 text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Availability</p>
                <p className="mt-2 text-sm font-black text-slate-900">{availabilityText || "Available now"}</p>
              </div>
            </div>

            <div className="grid gap-4 rounded-[24px] border border-slate-200 bg-white/80 p-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                  <ManagerIcon className="h-5 w-5" aria-hidden />
                </div>
                <div>
                  <p className="m-0 text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Managed By</p>
                  <p className="mt-1 text-sm font-black text-slate-950">{manager.title}</p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">{manager.description}</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Link href={`/property/${property.id}`} className="btn btn-primary rounded-full px-5">
                  View Details
                </Link>
                <form action={`${backendBaseUrl}/visits/schedule`} method="post">
                  <input type="hidden" name="propertyId" value={property.id} />
                  <button type="submit" className="btn btn-secondary rounded-full px-5">
                    <CalendarDays size={18} aria-hidden />
                    Schedule Visit
                  </button>
                </form>
                <Link href={`/property/${property.id}#contact`} className="btn btn-secondary rounded-full px-5">
                  <MessageCircle size={18} aria-hidden />
                  Contact Manager
                </Link>
                {whatsappHref ? (
                  <Link href={whatsappHref} target="_blank" rel="noreferrer" className="btn btn-secondary rounded-full px-5">
                    WhatsApp
                  </Link>
                ) : null}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3 text-xs font-bold text-slate-500">
                <span className="inline-flex items-center gap-1">
                  <Clock3 className="h-4 w-4 text-red-600" aria-hidden />
                  Discovery-ready card
                </span>
                {property.project_name ? (
                  <span className="inline-flex items-center gap-1">
                    <Building2 className="h-4 w-4 text-red-600" aria-hidden />
                    {property.project_name}
                  </span>
                ) : null}
              </div>
              <PropertyActions propertyId={property.id} title={title} compact />
            </div>
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className="ms-card overflow-hidden rounded-[26px] border border-white/70">
      <PropertyPhotoCarousel photos={photos} alt={title} href={`/property/${property.id}`} showCounter>
        <span
          className="absolute bottom-3 right-3 z-[3] rounded-full bg-slate-950/80 px-3 py-1 text-[11px] font-black uppercase tracking-wide text-white backdrop-blur"
        >
          {listingLabel(property)}
        </span>
        {property.is_matrix_verified ? (
          <span className="absolute left-3 top-3 z-[3] inline-flex items-center gap-1 rounded-full bg-white/95 px-3 py-1 text-[11px] font-black uppercase tracking-wide text-slate-900">
            <BadgeCheck className="h-4 w-4 text-green-600" aria-hidden />
            Verified
          </span>
        ) : null}
      </PropertyPhotoCarousel>

      <div className="grid gap-4 p-4">
        <div className="grid gap-2">
          <Link href={`/property/${property.id}`}>
            <h3 className="m-0 text-lg font-black leading-tight text-slate-950">{title}</h3>
          </Link>
          <p className="m-0 flex items-center gap-2 text-sm font-semibold text-slate-500">
            <MapPin className="h-4 w-4 text-red-600" aria-hidden />
            {property.locality || property.city || "Location on request"}
          </p>
        </div>

        <div className="flex items-center justify-between gap-3">
          <strong className="text-lg font-black text-red-700">{price}</strong>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">
            {property.size ? `${property.size} sq.ft` : propertyTypeLabel(property)}
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          {buildBadges(property, photoCount).slice(0, 2).map((badge) => (
            <span key={badge.label} className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${badgeClasses(badge.tone)}`}>
              {badge.label}
            </span>
          ))}
        </div>

        <div className="flex gap-2">
          <Link className="btn btn-primary flex-1 rounded-full" href={`/property/${property.id}`}>
            View Details
          </Link>
          <PropertyActions propertyId={property.id} title={title} compact />
        </div>
      </div>
    </article>
  );
}
