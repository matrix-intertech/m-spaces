import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site-url";

const SITEMAP_PAGE_SIZE = 100;

type SitemapChangeFrequency = NonNullable<MetadataRoute.Sitemap[number]["changeFrequency"]>;

type PropertyRecord = {
  id: number | string;
  created_at?: string | Date | null;
  listed_at?: string | Date | null;
  updated_at?: string | Date | null;
};

type PartnerRecord = {
  username?: string | null;
  created_at?: string | Date | null;
  updated_at?: string | Date | null;
};

type PropertyResult = {
  properties: PropertyRecord[];
  pagination?: {
    totalPages?: number;
  };
};

type PublicDataModule = {
  fetchPartners: () => Promise<PartnerRecord[]>;
  fetchProperties: (query: Record<string, string | number>) => Promise<PropertyResult>;
};

const { fetchPartners, fetchProperties } = require("../server/public-data") as PublicDataModule;

export const revalidate = 3600;

function toDate(value?: string | Date | null) {
  if (!value) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function buildUrlEntry(
  siteUrl: string,
  path: string,
  changeFrequency: SitemapChangeFrequency,
  priority: number,
  lastModified = new Date(),
): MetadataRoute.Sitemap[number] {
  return {
    url: `${siteUrl}${path}`,
    lastModified,
    changeFrequency,
    priority,
  };
}

async function getDynamicPropertyEntries(siteUrl: string) {
  const entries: MetadataRoute.Sitemap = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages) {
    const result = await fetchProperties({ limit: SITEMAP_PAGE_SIZE, page });
    const properties = Array.isArray(result?.properties) ? result.properties : [];

    for (const property of properties) {
      if (!property?.id) continue;

      entries.push(
        buildUrlEntry(
          siteUrl,
          `/property/${property.id}`,
          "daily",
          0.8,
          toDate(property.updated_at) ?? toDate(property.listed_at) ?? toDate(property.created_at) ?? new Date(),
        ),
      );
    }

    totalPages = Math.max(page, Number(result?.pagination?.totalPages ?? page));
    page += 1;
  }

  return entries;
}

async function getDynamicPartnerEntries(siteUrl: string) {
  const partners = await fetchPartners();

  return partners
    .filter((partner) => typeof partner?.username === "string" && partner.username.trim().length > 0)
    .map((partner) =>
      buildUrlEntry(
        siteUrl,
        `/portfolio/${partner.username!.trim()}`,
        "weekly",
        0.7,
        toDate(partner.updated_at) ?? toDate(partner.created_at) ?? new Date(),
      ),
    );
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getSiteUrl();
  const staticRoutes = [
    { path: "", changeFrequency: "daily", priority: 1 },
    { path: "/about", changeFrequency: "monthly", priority: 0.8 },
    { path: "/commercial-real-estate-india", changeFrequency: "weekly", priority: 0.9 },
    { path: "/contact", changeFrequency: "monthly", priority: 0.8 },
    { path: "/list-property", changeFrequency: "weekly", priority: 0.7 },
    { path: "/partner-signup", changeFrequency: "weekly", priority: 0.7 },
    { path: "/partners", changeFrequency: "weekly", priority: 0.8 },
    { path: "/property", changeFrequency: "daily", priority: 0.9 },
    { path: "/report", changeFrequency: "monthly", priority: 0.5 },
    { path: "/requirements", changeFrequency: "weekly", priority: 0.7 },
    { path: "/search", changeFrequency: "daily", priority: 0.9 },
    { path: "/services", changeFrequency: "weekly", priority: 0.8 },
    { path: "/terms-conditions", changeFrequency: "yearly", priority: 0.4 },
    { path: "/privacy-policy", changeFrequency: "yearly", priority: 0.4 },
  ] as const;

  const staticEntries = staticRoutes.map((route) =>
    buildUrlEntry(siteUrl, route.path, route.changeFrequency, route.priority),
  );

  try {
    const [propertyEntries, partnerEntries] = await Promise.all([
      getDynamicPropertyEntries(siteUrl),
      getDynamicPartnerEntries(siteUrl),
    ]);

    const dedupedEntries = new Map<string, MetadataRoute.Sitemap[number]>();

    for (const entry of [...staticEntries, ...propertyEntries, ...partnerEntries]) {
      dedupedEntries.set(entry.url, entry);
    }

    return Array.from(dedupedEntries.values());
  } catch (error) {
    console.error("[sitemap] Failed to generate dynamic entries.", error);
    return staticEntries;
  }
}
