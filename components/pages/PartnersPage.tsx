"use client";

import { useEffect, useMemo, useState } from "react";
import { BadgeCheck, Building2, MapPin, Search } from "lucide-react";
import { FollowPartnerButton } from "@/components/home/FollowPartnerButton";
import { PropertyPhotoCarousel } from "@/components/property/PropertyPhotoCarousel";
import { s3BaseUrl } from "@/lib/config";
import { assetPath, money, parsePhotos, titleCase } from "@/lib/format";
import type { Property } from "@/types";

interface PartnerRecord {
  id?: number | string;
  name?: string | null;
  username?: string | null;
  role?: string | null;
  avatar_url?: string | null;
  profile_photo?: string | null;
  profile_photo_url?: string | null;
  photo_url?: string | null;
  image_url?: string | null;
  company_logo?: string | null;
  city?: string | null;
  locality?: string | null;
  properties?: Property[] | null;
}

const fallbackAvatar = "https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_960_720.png";

type PartnerImageSource = {
  sources: string[];
};

function roleLabel(role?: string | null): string {
  if (role === "builder" || role === "dealer") return "Builder / Developer";
  if (role === "broker" || role === "agent") return "Broker";
  if (role === "external_sales") return "Sales Agent";
  return role || "Partner";
}

function roleMatches(role: string | null | undefined, selectedRole: string): boolean {
  if (selectedRole === "all") return true;
  if (selectedRole === "builder") return role === "builder" || role === "dealer";
  if (selectedRole === "broker") return role === "broker" || role === "agent";
  if (selectedRole === "external_sales") return role === "external_sales";
  return true;
}

function cleanImagePath(path: string): string {
  return path
    .trim()
    .replace(/^['"]|['"]$/g, "")
    .replace(/\\/g, "/")
    .replace(/[\r\n]/g, "");
}

function isUsableImagePath(value: string | null | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0 && !value.includes("undefined");
}

function uniqueSources(sources: Array<string | null | undefined>): string[] {
  return Array.from(new Set(sources.filter(isUsableImagePath)));
}

function s3UploadCandidates(uploadKey: string, kind: "avatar" | "logo"): string[] {
  const cleanKey = uploadKey.replace(/^\/+/, "");
  if (!cleanKey) return [];

  const preferredFolders = kind === "logo" ? ["logos", "properties", "profiles"] : ["properties", "profiles", "logos"];
  return [
    ...preferredFolders.map((folder) => `${s3BaseUrl}/${folder}/${cleanKey}`),
    `${s3BaseUrl}/${cleanKey}`
  ];
}

function uploadedPartnerImage(partner: PartnerRecord): PartnerImageSource {
  const imageCandidate = [
    { value: partner.avatar_url, kind: "avatar" as const },
    { value: partner.profile_photo_url, kind: "avatar" as const },
    { value: partner.profile_photo, kind: "avatar" as const },
    { value: partner.photo_url, kind: "avatar" as const },
    { value: partner.image_url, kind: "avatar" as const },
    { value: partner.company_logo, kind: "logo" as const }
  ].find((candidate) => isUsableImagePath(candidate.value));

  const rawPath = imageCandidate?.value;
  const kind = imageCandidate?.kind ?? "avatar";

  if (!rawPath) return { sources: [fallbackAvatar] };

  const clean = cleanImagePath(rawPath);
  if (!clean || clean === "null" || clean.includes("undefined")) return { sources: [fallbackAvatar] };
  if (/^(https?:|data:|blob:)/.test(clean)) return { sources: [clean, fallbackAvatar] };
  if (clean.startsWith("//")) return { sources: [`https:${clean}`, fallbackAvatar] };

  if (clean.startsWith("/uploads/") || clean.startsWith("uploads/")) {
    const localPath = clean.startsWith("/") ? clean : `/${clean}`;
    const uploadKey = clean.replace(/^\/?uploads\//, "");
    const resolved = assetPath(clean, fallbackAvatar);

    return {
      sources: uniqueSources([
        resolved !== localPath && resolved !== fallbackAvatar ? resolved : null,
        ...s3UploadCandidates(uploadKey, kind),
        localPath,
        fallbackAvatar
      ])
    };
  }

  if (clean.startsWith("/")) return { sources: [clean, fallbackAvatar] };
  if (clean.startsWith("assets/")) return { sources: [`/${clean}`, fallbackAvatar] };

  const resolved = assetPath(clean, fallbackAvatar);
  if (resolved !== `/uploads/${clean}` && resolved !== fallbackAvatar) {
    return {
      sources: uniqueSources([resolved, `/uploads/${clean}`, fallbackAvatar])
    };
  }

  return {
    sources: uniqueSources([
      ...s3UploadCandidates(clean, kind),
      `/uploads/${clean.replace(/^\/+/, "")}`,
      fallbackAvatar
    ])
  };
}

function PartnerAvatar({ partner, alt }: { partner: PartnerRecord; alt: string }) {
  const source = useMemo(() => uploadedPartnerImage(partner), [partner]);
  const sourceKey = source.sources.join("|");
  const [sourceIndex, setSourceIndex] = useState(0);

  useEffect(() => {
    setSourceIndex(0);
  }, [sourceKey]);

  const src = source.sources[sourceIndex] ?? fallbackAvatar;

  return (
    <img
      src={src}
      alt={alt}
      className="mb-4 h-24 w-24 rounded-full border-4 border-white object-cover shadow-md"
      onError={() => {
        setSourceIndex((currentIndex) => Math.min(currentIndex + 1, source.sources.length - 1));
      }}
    />
  );
}

function partnerPropertyPhotos(properties: Property[]): string[] {
  return properties.flatMap((property) => parsePhotos(property.photos, property.photo || property.image_url));
}

function PartnerPropertyCarousel({
  partner,
  username,
  displayName
}: {
  partner: PartnerRecord;
  username: string;
  displayName: string;
}) {
  const properties = Array.isArray(partner.properties) ? partner.properties : [];
  const photos = partnerPropertyPhotos(properties);
  const featuredProperty = properties[0];
  const featuredTitle = featuredProperty?.title || `${titleCase(featuredProperty?.type)} space`;
  const portfolioHref = `/portfolio/${encodeURIComponent(username)}`;

  return (
    <PropertyPhotoCarousel
      photos={photos}
      alt={`${displayName} properties`}
      href={portfolioHref}
      sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 310px"
      aspectRatio="16 / 10"
      borderRadius={8}
      className="surface w-full"
    >
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[3] bg-gradient-to-t from-slate-950/82 via-slate-950/22 to-transparent p-3 text-left text-white">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-1 text-[11px] font-black uppercase tracking-wide text-slate-900">
            <Building2 className="h-3.5 w-3.5" aria-hidden />
            {properties.length ? `${properties.length} listed` : "Portfolio"}
          </span>
          {featuredProperty?.is_matrix_verified ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/90 px-2 py-1 text-[11px] font-black text-white">
              <BadgeCheck className="h-3.5 w-3.5" aria-hidden />
              Verified
            </span>
          ) : null}
        </div>
        {featuredProperty ? (
          <div className="grid gap-0.5">
            <p className="truncate text-sm font-black">{featuredTitle}</p>
            <p className="truncate text-xs font-bold text-white/82">
              {featuredProperty.locality || featuredProperty.city || "Location on request"} · {money(featuredProperty.final_price ?? featuredProperty.price ?? featuredProperty.rent)}
            </p>
          </div>
        ) : (
          <p className="text-sm font-black">Portfolio preview</p>
        )}
      </div>
    </PropertyPhotoCarousel>
  );
}

export function PartnersPage({ partners }: { partners: PartnerRecord[] }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRole, setSelectedRole] = useState("all");

  const filteredPartners = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    return partners.filter((partner) => {
      const searchText = `${partner.name ?? ""} ${partner.username ?? ""} ${partner.locality ?? ""} ${partner.city ?? ""}`.toLowerCase();
      return searchText.includes(normalizedSearch) && roleMatches(partner.role, selectedRole);
    });
  }, [partners, searchTerm, selectedRole]);

  return (
    <div className="relative flex flex-col justify-center overflow-hidden pb-16 pt-16 md:pb-24 md:pt-24">
      <div className="absolute inset-0 z-0">
        <div
          className="h-full w-full bg-cover bg-center opacity-10"
          style={{
            backgroundImage:
              "url('https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=2000&q=80')"
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-white/90 via-white/70 to-white/90 backdrop-blur-sm" />
      </div>

      <div className="container relative z-10" style={{ maxWidth: 1180 }}>
        <section className="mb-12 text-center">
          <h1 className="mb-6 text-4xl font-black tracking-tight text-[#111827] md:text-6xl">
            Our <span className="text-[#D4AF37]">Partners</span>
          </h1>
          <p className="mx-auto max-w-3xl text-lg font-medium text-[#6B7280] md:text-xl">
            Connect with our network of verified agents, dealers, and brokers across the country.
          </p>
          <div className="mt-8">
            <a
              href="/partner-signup"
              className="inline-flex items-center justify-center rounded-xl bg-red-600 px-8 py-3 font-bold text-white shadow-md transition-all hover:-translate-y-0.5 hover:bg-red-700 hover:shadow-lg active:scale-95"
            >
              Join as a Partner
            </a>
          </div>
        </section>

        <section className="mx-auto mb-12 max-w-4xl">
          <div className="flex flex-col gap-4 md:flex-row">
            <label className="relative flex-grow">
              <Search className="absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" aria-hidden />
              <span className="sr-only">Search partners</span>
              <input
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search by locality, city, or name..."
                className="w-full rounded-2xl border border-white/60 bg-white/70 py-4 pl-14 pr-4 font-medium shadow-lg backdrop-blur-xl transition-all focus:border-[#D4AF37] focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/50"
              />
            </label>
            <label className="md:w-64">
              <span className="sr-only">Filter by role</span>
              <select
                value={selectedRole}
                onChange={(event) => setSelectedRole(event.target.value)}
                className="w-full rounded-2xl border border-white/60 bg-white/70 px-4 py-4 font-medium text-slate-700 shadow-lg backdrop-blur-xl transition-all focus:border-[#D4AF37] focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/50"
              >
                <option value="all">All Roles</option>
                <option value="builder">Builder / Developer</option>
                <option value="broker">Broker</option>
                <option value="external_sales">Sales Agent</option>
              </select>
            </label>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredPartners.map((partner, index) => {
            const username = partner.username || `partner-${index + 1}`;
            const displayName = partner.name || username;
            return (
              <article
                key={String(partner.id ?? username)}
                className="flex flex-col overflow-hidden rounded-lg border border-[#E5E7EB] bg-white text-center shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-[#D4AF37]/40 hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)]"
              >
                <PartnerPropertyCarousel partner={partner} username={username} displayName={displayName} />
                <div className="flex flex-1 flex-col items-center p-5">
                  <PartnerAvatar partner={partner} alt={displayName} />
                  <h3 className="text-lg font-bold text-slate-900">{username}</h3>
                  <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">{roleLabel(partner.role)}</p>
                  <p className="mb-4 flex items-center gap-1 text-sm text-slate-600">
                    <MapPin className="h-4 w-4 text-slate-400" aria-hidden />
                    {partner.locality || partner.city || "Location not set"}
                  </p>
                  <div className="mt-auto grid w-full gap-2">
                    {partner.id ? <FollowPartnerButton partnerId={Number(partner.id)} variant="button" /> : null}
                    <a
                      href={`/portfolio/${encodeURIComponent(username)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex w-full items-center justify-center rounded-md bg-[#D4AF37] px-4 py-2 text-sm font-bold text-white shadow-[0_4px_14px_rgba(212,175,55,0.4)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#e5c250] active:scale-95"
                    >
                      View Portfolio
                    </a>
                  </div>
                </div>
              </article>
            );
          })}

          {!filteredPartners.length ? (
            <div className="col-span-full py-12 text-center text-slate-500">
              <p className="text-lg font-bold">No partners found</p>
              <p>Try adjusting your search terms.</p>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
