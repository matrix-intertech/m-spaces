import { PropertyGrid } from "@/components/property/PropertyGrid";
import { SearchResultsExperience } from "@/components/property/SearchResultsExperience";
import type { Pagination, Property } from "@/types";

export function ListingPage({
  title,
  subtitle,
  properties,
  pagination,
  searchParams,
  showFilters = true,
  recommendedProperties = [],
  recentlyViewedProperties = []
}: {
  title: string;
  subtitle: string;
  properties: Property[];
  pagination?: Pagination;
  searchParams?: Record<string, string | string[] | undefined>;
  showFilters?: boolean;
  recommendedProperties?: Property[];
  recentlyViewedProperties?: Property[];
}) {
  if (!showFilters) {
    return (
      <div className="container grid gap-5 py-8">
        <section className="surface rounded-[30px] border border-white/75 px-5 py-5 md:px-6">
          <span className="inline-flex rounded-full bg-white/70 px-3 py-1 text-[11px] font-black uppercase tracking-[0.22em] text-red-700">MatrixSpaces Discovery</span>
          <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950 md:text-4xl">{title}</h1>
          <p className="mt-2 max-w-3xl text-sm font-medium leading-7 text-slate-500">{subtitle}</p>
        </section>
        <PropertyGrid properties={properties} variant="list" />
      </div>
    );
  }

  return (
    <SearchResultsExperience
      title={title}
      subtitle={subtitle}
      properties={properties}
      pagination={pagination}
      searchParams={searchParams}
      recommendedProperties={recommendedProperties}
      recentlyViewedProperties={recentlyViewedProperties}
    />
  );
}
