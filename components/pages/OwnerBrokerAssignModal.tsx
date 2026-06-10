"use client";

import { useMemo, useState } from "react";
import { backendBaseUrl } from "@/lib/config";

type DashboardRecord = Record<string, any>;

function brokerRoleLabel(role: string) {
  if (role === "external_sales") return "Sales Agent";
  if (role === "builder") return "Builder";
  if (role === "agent") return "Agent";
  return "Broker";
}

function brokerMatchesLocality(broker: DashboardRecord, propertyLocality: string) {
  if (broker.role === "external_sales") return true;
  if (!broker.locality) return true;
  const brokerLocalities = String(broker.locality)
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  return brokerLocalities.includes(propertyLocality.trim().toLowerCase());
}

function brokerSearchText(broker: DashboardRecord) {
  const rating = broker.rating ? `${Number(broker.rating).toFixed(1)} ${broker.review_count || 0} reviews` : "new";
  return `${broker.username || ""} ${broker.account_number || ""} ${brokerRoleLabel(broker.role)} ${broker.locality || ""} ${rating}`.toLowerCase();
}

export function OwnerBrokerAssignModal({
  property,
  brokers,
  onClose
}: {
  property: DashboardRecord;
  brokers: DashboardRecord[];
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const visibleBrokers = useMemo(() => {
    const propertyLocality = String(property?.locality || "");
    const searchTerm = search.trim().toLowerCase();
    return brokers
      .filter((broker) => brokerMatchesLocality(broker, propertyLocality))
      .filter((broker) => (searchTerm ? brokerSearchText(broker).includes(searchTerm) : true));
  }, [brokers, property, search]);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-md p-6 relative flex flex-col max-h-[90vh]">
        <button onClick={onClose} type="button" className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 z-10">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <h2 className="text-xl font-bold mb-2 text-gray-900">Assign Broker</h2>
        <p className="text-sm text-gray-600 mb-4">Select a local broker for {property?.locality || "this property"}.</p>

        <div className="sticky top-0 bg-white pb-3 border-b border-gray-100 z-10">
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search broker..."
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-red-500"
          />
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar pt-2 space-y-2">
          <form action={`${backendBaseUrl}/owner/property/${property.id}/assign-broker`} method="POST" className="m-0">
            <input type="hidden" name="broker_id" value="" />
            <button type="submit" className="w-full text-left px-3 py-2 text-sm font-bold text-red-600 hover:bg-red-50 rounded border border-red-200 transition-colors flex items-center justify-between">
              <span>Revert to Self Managed (Remove All)</span>
              <i className="fas fa-trash-alt" />
            </button>
          </form>

          {visibleBrokers.length ? (
            visibleBrokers.map((broker) => {
              const ratingText = broker.rating ? `${Number(broker.rating).toFixed(1)} (${broker.review_count || 0} reviews)` : "New";
              const displayText = `${broker.username || "Broker"}${broker.account_number ? ` [${broker.account_number}]` : ""} (${brokerRoleLabel(broker.role)})`;
              return (
                <form key={broker.id} action={`${backendBaseUrl}/owner/property/${property.id}/assign-broker`} method="POST" className="m-0">
                  <input type="hidden" name="broker_id" value={broker.id} />
                  <button type="submit" className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded border border-gray-200 transition-colors flex justify-between items-center gap-3">
                    <span className="min-w-0">
                      <span className="block font-bold truncate">{displayText}</span>
                      <span className="block text-[10px] text-gray-500 truncate">
                        {ratingText} {broker.locality ? `- ${broker.locality}` : ""}
                      </span>
                    </span>
                    <i className="fas fa-plus text-gray-400" />
                  </button>
                </form>
              );
            })
          ) : (
            <div className="px-3 py-2 text-sm text-gray-400 italic">No local brokers found for {property?.locality || "this locality"}.</div>
          )}
        </div>
      </div>
    </div>
  );
}
