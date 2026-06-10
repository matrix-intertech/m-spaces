"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowUpRight,
  Building2,
  Camera,
  Globe,
  Mail,
  MapPin,
  Phone,
  Share2,
  Star,
  X
} from "lucide-react";
import { FollowPartnerButton } from "@/components/home/FollowPartnerButton";
import { PropertyActions } from "@/components/property/PropertyActions";
import { PropertyPhotoCarousel } from "@/components/property/PropertyPhotoCarousel";
import { assetPath, money, parsePhotos, titleCase } from "@/lib/format";
import type { PortfolioPayload } from "@/components/pages/PortfolioPage";
import type { Property } from "@/types";

type PortfolioTab = "properties" | "projects" | "completed" | "about";
type PortfolioRecord = Record<string, unknown>;

function stringField(record: PortfolioRecord, key: string): string {
  const value = record[key];
  return typeof value === "string" && value.trim() ? value : "";
}

function numberField(record: PortfolioRecord, key: string): string {
  const value = record[key];
  return typeof value === "number" || typeof value === "string" ? String(value) : "";
}

function externalUrl(value?: string | null): string {
  const clean = value?.trim();
  if (!clean) return "";
  if (clean.startsWith("<")) return "";
  return /^https?:\/\//.test(clean) ? clean : `https://${clean}`;
}

function recordPhotos(record: PortfolioRecord): string[] {
  const fallback = stringField(record, "image_url") || stringField(record, "photo");
  return parsePhotos(record.photos as Property["photos"], fallback);
}

function projectTitle(record: PortfolioRecord): string {
  return stringField(record, "name") || stringField(record, "title") || "MatrixSpaces project";
}

function PropertyShowcaseCard({ property }: { property: Property }) {
  const photos = parsePhotos(property.photos, property.photo || property.image_url);
  const title = property.title || `${titleCase(property.type)} Space in ${property.locality || property.city || "India"}`;
  const price = money(property.final_price ?? property.price ?? property.rent);

  return (
    <article className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
      <PropertyPhotoCarousel
        photos={photos}
        alt={title}
        href={`/property/${property.id}`}
        aspectRatio="16 / 11"
        sizes="(max-width: 768px) 100vw, 360px"
      >
        <span className="absolute left-3 top-3 z-[3] rounded-md bg-white/90 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-slate-900 shadow-sm">
          {titleCase(property.listing_type) || "Available"}
        </span>
      </PropertyPhotoCarousel>
      <div className="grid gap-3 p-4">
        <div>
          <Link href={`/property/${property.id}`}>
            <h3 className="line-clamp-1 text-base font-black text-slate-950 hover:text-red-600">{title}</h3>
          </Link>
          <p className="mt-1 flex items-center gap-1 text-xs font-bold text-slate-500">
            <MapPin size={14} aria-hidden />
            {property.locality || property.city || "Location on request"}
          </p>
        </div>
        <div className="flex items-center justify-between gap-3">
          <strong className="text-base font-black text-red-700">{price}</strong>
          <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">
            {property.size ? `${property.size} sq.ft` : titleCase(property.type)}
          </span>
        </div>
        <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2">
          <Link className="btn btn-primary" href={`/property/${property.id}`}>
            View
          </Link>
          <PropertyActions propertyId={property.id} title={title} />
        </div>
      </div>
    </article>
  );
}

function ProjectShowcaseCard({
  item,
  label,
  onImageClick
}: {
  item: PortfolioRecord;
  label: string;
  onImageClick: (image: string) => void;
}) {
  const title = projectTitle(item);
  const photos = recordPhotos(item);
  const image = assetPath(photos[0], "/assets/property.png");
  const type = stringField(item, "type") || label;
  const location = stringField(item, "location") || stringField(item, "locality") || "Location on request";
  const status = stringField(item, "status") || numberField(item, "completion_year") || "Showcase";
  const description = stringField(item, "description") || "Project details are available from this MatrixSpaces partner.";
  const rera = stringField(item, "rera_id");
  const amenities = stringField(item, "amenities");

  return (
    <article className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
      <button
        type="button"
        onClick={() => onImageClick(image)}
        className="relative block aspect-[16/10] w-full overflow-hidden bg-slate-100 text-left"
        aria-label={`Open ${title} image`}
      >
        <Image
          src={image}
          alt={title}
          fill
          className="object-cover transition-transform duration-700 hover:scale-105"
          sizes="(max-width: 768px) 100vw, 360px"
        />
        <span className="absolute left-3 top-3 rounded-md bg-white/90 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-slate-900 shadow-sm">
          {type}
        </span>
        <span className="absolute right-3 top-3 rounded-md bg-slate-950/80 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-white shadow-sm">
          {status}
        </span>
      </button>
      <div className="grid gap-3 p-4">
        <div>
          <h3 className="line-clamp-1 text-base font-black text-slate-950">{title}</h3>
          <p className="mt-1 flex items-center gap-1 text-xs font-bold text-slate-500">
            <MapPin size={14} aria-hidden />
            {location}
          </p>
        </div>
        <p className="line-clamp-2 text-sm font-medium leading-6 text-slate-600">{description}</p>
        <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3">
          {rera ? <span className="rounded-md bg-red-50 px-2 py-1 text-[10px] font-black text-red-700">RERA {rera}</span> : null}
          {amenities ? <span className="rounded-md bg-slate-100 px-2 py-1 text-[10px] font-black text-slate-600">{amenities}</span> : null}
        </div>
      </div>
    </article>
  );
}

export function PortfolioShowcase({ portfolio }: { portfolio: PortfolioPayload }) {
  const { agent, properties, projects = [], builderPortfolio = [] } = portfolio;
  const [activeTab, setActiveTab] = useState<PortfolioTab>(properties.length ? "properties" : projects.length ? "projects" : "about");
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [shareMessage, setShareMessage] = useState("");

  const displayName = agent.name || agent.username || "MatrixSpaces Partner";
  const roleLabel =
    agent.role === "external_sales"
      ? "Sales Agent"
      : agent.role === "dealer"
        ? "Authorized Dealer"
        : titleCase(agent.role) || "MatrixSpaces Partner";
  const parentRoleLabel = String(agent.parent_role || "").toLowerCase();
  const parentDisplayName = agent.parent_name || agent.parent_username || agent.parent_agency_name || "";
  const parentPortfolioHref = agent.parent_username ? `/${encodeURIComponent(agent.parent_username)}` : "";
  const managerLine =
    agent.role === "external_sales" && parentDisplayName && (parentRoleLabel === "broker" || parentRoleLabel === "dealer")
      ? `Under ${parentRoleLabel === "dealer" ? "Dealer" : "Broker"}: ${parentDisplayName}`
      : "";
  const cover = assetPath(agent.cover_url || "/assets/home.png", "/assets/home.png");
  const avatar = assetPath(agent.avatar_url || "/assets/no-photo.svg", "/assets/no-photo.svg");
  const website = externalUrl(agent.company_website);
  const googleBusiness = externalUrl(agent.google_business_link);
  const phoneDigits = agent.phone?.replace(/\D/g, "") ?? "";
  const whatsapp = phoneDigits ? `https://wa.me/${phoneDigits}` : "";

  const galleryImages = useMemo(() => {
    const projectImages = [...projects, ...builderPortfolio].flatMap((item) => recordPhotos(item).map((photo) => assetPath(photo, "")));
    const propertyImages = properties.flatMap((property) =>
      parsePhotos(property.photos, property.photo || property.image_url).map((photo) => assetPath(photo, ""))
    );
    return Array.from(new Set([...propertyImages, ...projectImages].filter(Boolean))).slice(0, 12);
  }, [builderPortfolio, projects, properties]);

  const tabs: Array<{ key: PortfolioTab; label: string; count?: number }> = [
    { key: "properties", label: "Properties", count: properties.length },
    { key: "projects", label: "Live Projects", count: projects.length },
    { key: "completed", label: "Completed", count: builderPortfolio.length },
    { key: "about", label: "About" }
  ];

  async function sharePortfolio() {
    setShareMessage("");
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: `${displayName} - MatrixSpaces`, text: `View ${displayName}'s portfolio`, url });
        setShareMessage("Shared");
      } else {
        await navigator.clipboard.writeText(url);
        setShareMessage("Link copied");
      }
    } catch {
      setShareMessage("Share cancelled");
    }
  }

  return (
    <div className="bg-slate-50 pb-16">
      <section className="relative min-h-[430px] overflow-hidden">
        <Image src={cover} alt="" fill priority className="object-cover" sizes="100vw" />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950/90 via-slate-950/60 to-slate-950/20" />
        <div className="container relative z-10 grid min-h-[430px] content-end py-10 text-white">
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-end">
              <Image
                src={avatar}
                alt={displayName}
                width={144}
                height={144}
                className="h-32 w-32 rounded-lg border-4 border-white bg-white object-cover shadow-xl sm:h-36 sm:w-36"
              />
              <div className="max-w-3xl">
                <span className="inline-flex rounded-md bg-white/15 px-3 py-1 text-xs font-black uppercase tracking-wider backdrop-blur">
                  {roleLabel}
                </span>
                <h1 className="mt-3 text-4xl font-black leading-none text-white md:text-6xl">{displayName}</h1>
                {agent.agency_name ? <p className="mt-2 text-xl font-bold text-white/85">{agent.agency_name}</p> : null}
                {managerLine ? (
                  parentPortfolioHref ? (
                    <p className="mt-2 text-sm font-black uppercase tracking-wide text-white/75">
                      {parentRoleLabel === "dealer" ? "Under Dealer: " : "Under Broker: "}
                      <Link
                        href={parentPortfolioHref}
                        className="underline decoration-white/40 underline-offset-4 transition hover:text-white hover:decoration-white"
                      >
                        {parentDisplayName}
                      </Link>
                    </p>
                  ) : (
                    <p className="mt-2 text-sm font-black uppercase tracking-wide text-white/75">{managerLine}</p>
                  )
                ) : null}
                <p className="mt-3 flex flex-wrap items-center gap-2 text-sm font-semibold text-white/80">
                  <MapPin size={16} aria-hidden />
                  {[agent.locality, agent.city].filter(Boolean).join(", ") || "India"}
                  {agent.rera_number ? <span className="rounded bg-white/15 px-2 py-1 text-xs">RERA {agent.rera_number}</span> : null}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {agent.id ? <FollowPartnerButton partnerId={Number(agent.id)} variant="button" /> : null}
              <button
                type="button"
                onClick={sharePortfolio}
                className="inline-flex h-11 items-center gap-2 rounded-lg border border-white/30 bg-white/15 px-4 text-sm font-black text-white backdrop-blur transition hover:bg-white hover:text-slate-950"
              >
                <Share2 size={17} aria-hidden />
                Share
              </button>
              {shareMessage ? <span className="text-xs font-bold text-white/80">{shareMessage}</span> : null}
            </div>
          </div>
        </div>
      </section>

      <main className="container -mt-8 grid gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="relative z-20 grid gap-4">
          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-black text-slate-950">Contact</h2>
            <div className="mt-4 grid gap-3 text-sm font-bold text-slate-700">
              {agent.email ? (
                <a className="flex items-center gap-2 hover:text-red-600" href={`mailto:${agent.email}`}>
                  <Mail size={17} aria-hidden />
                  {agent.email}
                </a>
              ) : null}
              {agent.phone ? (
                <a className="flex items-center gap-2 hover:text-red-600" href={`tel:${agent.phone}`}>
                  <Phone size={17} aria-hidden />
                  {agent.phone}
                </a>
              ) : null}
              {website ? (
                <a className="flex items-center gap-2 hover:text-red-600" href={website} target="_blank" rel="noopener noreferrer">
                  <Globe size={17} aria-hidden />
                  Website
                </a>
              ) : null}
              {whatsapp ? (
                <a className="btn btn-primary mt-2" href={whatsapp} target="_blank" rel="noopener noreferrer">
                  WhatsApp
                  <ArrowUpRight size={16} aria-hidden />
                </a>
              ) : null}
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-black text-slate-950">Snapshot</h2>
            <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-slate-50 p-3">
                <dt className="text-[10px] font-black uppercase tracking-wide text-slate-500">Properties</dt>
                <dd className="mt-1 text-2xl font-black text-slate-950">{properties.length}</dd>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <dt className="text-[10px] font-black uppercase tracking-wide text-slate-500">Projects</dt>
                <dd className="mt-1 text-2xl font-black text-slate-950">{projects.length}</dd>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <dt className="text-[10px] font-black uppercase tracking-wide text-slate-500">Done</dt>
                <dd className="mt-1 text-2xl font-black text-slate-950">{builderPortfolio.length}</dd>
              </div>
            </dl>
          </section>

          {googleBusiness ? (
            <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2">
                <Star size={18} className="text-amber-500" aria-hidden />
                <h2 className="text-lg font-black text-slate-950">Client Reviews</h2>
              </div>
              <a className="btn btn-secondary mt-4 w-full" href={googleBusiness} target="_blank" rel="noopener noreferrer">
                Open Google Reviews
                <ArrowUpRight size={16} aria-hidden />
              </a>
            </section>
          ) : null}
        </aside>

        <div className="relative z-20 grid gap-6">
          {galleryImages.length ? (
            <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="flex items-center gap-2 text-lg font-black text-slate-950">
                  <Camera size={18} aria-hidden />
                  Gallery
                </h2>
                <span className="text-xs font-black uppercase tracking-wide text-slate-400">{galleryImages.length} photos</span>
              </div>
              <div className="grid grid-cols-4 gap-2 md:grid-cols-6">
                {galleryImages.map((image, index) => (
                  <button
                    key={image}
                    type="button"
                    onClick={() => setSelectedImage(image)}
                    className={`relative overflow-hidden rounded-lg bg-slate-100 ${index === 0 ? "col-span-2 row-span-2 aspect-square" : "aspect-square"}`}
                    aria-label={`Open gallery image ${index + 1}`}
                  >
                    <Image src={image} alt="" fill className="object-cover transition-transform duration-500 hover:scale-105" sizes="160px" />
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="flex gap-2 overflow-x-auto border-b border-slate-100 px-4 pt-4">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`whitespace-nowrap border-b-2 px-3 py-3 text-sm font-black transition-colors ${
                    activeTab === tab.key ? "border-red-600 text-red-600" : "border-transparent text-slate-500 hover:text-slate-950"
                  }`}
                >
                  {tab.label}
                  {tab.count !== undefined ? <span className="ml-2 rounded bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600">{tab.count}</span> : null}
                </button>
              ))}
            </div>

            <div className="p-4 md:p-6">
              {activeTab === "properties" ? (
                properties.length ? (
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {properties.map((property) => (
                      <PropertyShowcaseCard key={property.id} property={property} />
                    ))}
                  </div>
                ) : (
                  <EmptyState title="No managed properties yet" />
                )
              ) : null}

              {activeTab === "projects" ? (
                projects.length ? (
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {projects.map((project, index) => (
                      <ProjectShowcaseCard key={String(project.id ?? `project-${index}`)} item={project} label="Project" onImageClick={setSelectedImage} />
                    ))}
                  </div>
                ) : (
                  <EmptyState title="No live projects yet" />
                )
              ) : null}

              {activeTab === "completed" ? (
                builderPortfolio.length ? (
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {builderPortfolio.map((project, index) => (
                      <ProjectShowcaseCard key={String(project.id ?? `completed-${index}`)} item={project} label="Completed" onImageClick={setSelectedImage} />
                    ))}
                  </div>
                ) : (
                  <EmptyState title="No completed projects yet" />
                )
              ) : null}

              {activeTab === "about" ? (
                <div className="grid gap-5">
                  <div className="rounded-lg bg-slate-50 p-5">
                    <h2 className="text-xl font-black text-slate-950">About</h2>
                    <p className="mt-3 max-w-3xl text-sm font-medium leading-7 text-slate-600">
                      {agent.about || "This MatrixSpaces portfolio is connected to live listings, projects, and partner profile data."}
                    </p>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    {agent.facebook ? <SocialLink label="Facebook" href={agent.facebook} /> : null}
                    {agent.instagram ? <SocialLink label="Instagram" href={agent.instagram} /> : null}
                    {agent.linkedin ? <SocialLink label="LinkedIn" href={agent.linkedin} /> : null}
                    {website ? <SocialLink label="Website" href={website} /> : null}
                  </div>
                </div>
              ) : null}
            </div>
          </section>
        </div>
      </main>

      {selectedImage ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/90 p-4" role="dialog" aria-modal="true">
          <button
            type="button"
            onClick={() => setSelectedImage(null)}
            className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-lg bg-white text-slate-950 shadow-lg"
            aria-label="Close gallery image"
          >
            <X size={20} aria-hidden />
          </button>
          <div className="relative h-[82vh] w-full max-w-6xl overflow-hidden rounded-lg bg-slate-900">
            <Image src={selectedImage} alt="" fill className="object-contain" sizes="100vw" />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function EmptyState({ title }: { title: string }) {
  return (
    <div className="grid place-items-center gap-2 rounded-lg border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
      <Building2 size={28} className="text-slate-300" aria-hidden />
      <h3 className="text-lg font-black text-slate-900">{title}</h3>
      <p className="text-sm font-medium text-slate-500">New portfolio data will appear here when it is added from the dashboard.</p>
    </div>
  );
}

function SocialLink({ label, href }: { label: string; href: string }) {
  return (
    <a
      href={externalUrl(href)}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 shadow-sm hover:border-red-200 hover:text-red-600"
    >
      {label}
      <ArrowUpRight size={16} aria-hidden />
    </a>
  );
}
