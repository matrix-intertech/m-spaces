import { PropertyCard } from "@/components/property/PropertyCard";
import type { Property } from "@/types";

export function PropertyGrid({ properties, variant = "grid" }: { properties: Property[]; variant?: "grid" | "list" }) {
  if (!properties.length) {
    return (
      <div className="surface rounded-[28px] px-6 py-10 text-center">
        <h2 className="mt-0 text-2xl font-black text-slate-950">No properties found</h2>
        <p className="mx-auto mt-2 max-w-xl text-sm font-medium leading-7 text-slate-500">
          Try widening your budget, changing the locality, or exploring newly added spaces in nearby business hubs.
        </p>
      </div>
    );
  }

  return variant === "list" ? (
    <div className="grid gap-4">
      {properties.map((property) => (
        <PropertyCard key={property.id} property={property} variant="list" />
      ))}
    </div>
  ) : (
    <div className="grid-auto">
      {properties.map((property) => (
        <PropertyCard key={property.id} property={property} />
      ))}
    </div>
  );
}
