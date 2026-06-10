import type { Metadata } from "next";
import { ListingPage } from "@/components/property/ListingPage";
import { getProperties, getUserPropertyCollection } from "@/services/api";
import { toUrlSearchParams, type SearchParamsInput } from "@/utils/searchParams";

export const metadata: Metadata = {
  title: "Search Properties"
};

export default async function SearchPage({ searchParams }: { searchParams: Promise<SearchParamsInput> }) {
  const resolvedSearchParams = await searchParams;
  const params = toUrlSearchParams(resolvedSearchParams);
  params.set("limit", params.get("limit") ?? "12");
  const [{ properties, pagination }, recommendedProperties, recentlyViewedProperties] = await Promise.all([
    getProperties(params).catch(() => ({ properties: [], pagination: undefined })),
    getUserPropertyCollection("/recommended"),
    getUserPropertyCollection("/recently-viewed")
  ]);

  return (
    <ListingPage
      title="Search properties"
      subtitle="Discover verified commercial spaces, managed listings, and local inventory with map-first browsing, trust signals, and quick conversion actions."
      properties={properties}
      pagination={pagination}
      searchParams={resolvedSearchParams}
      recommendedProperties={recommendedProperties}
      recentlyViewedProperties={recentlyViewedProperties}
    />
  );
}
