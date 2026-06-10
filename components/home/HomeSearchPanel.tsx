"use client";

import { useState } from "react";
import { Building2, Crosshair, Home, Search, Store, Users } from "lucide-react";
import { PlaceAutocomplete } from "@/components/search/PlaceAutocomplete";

const tabs = [
  { label: "Buy", listingType: "sale", type: "", icon: Home },
  { label: "Rent", listingType: "rent", type: "", icon: Building2 },
  { label: "Commercial", listingType: "", type: "office", icon: Store },
  { label: "PG", listingType: "pg", type: "", icon: Building2 },
  { label: "Partners", href: "/partners", listingType: "", type: "", icon: Users }
];

export function HomeSearchPanel() {
  const [activeTab, setActiveTab] = useState(tabs[1]);

  function useNearMe() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((position) => {
      const params = new URLSearchParams({
        lat: String(position.coords.latitude),
        lng: String(position.coords.longitude),
        limit: "12"
      });
      window.location.href = `/search?${params.toString()}`;
    });
  }

  return (
    <form action={activeTab.href ?? "/search"} className="ms-home-search-form">
      <div className="ms-home-search-tabs">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const selected = activeTab.label === tab.label;
          return (
            <button
              key={tab.label}
              type="button"
              onClick={() => {
                if (tab.href) window.location.href = tab.href;
                else setActiveTab(tab);
              }}
              className={`btn ${selected ? "btn-primary" : "btn-secondary"}`}
              style={{ minHeight: 40, padding: ".5rem .8rem", flex: "0 0 auto" }}
            >
              <Icon size={16} aria-hidden />
              {tab.label}
            </button>
          );
        })}
      </div>

      <input type="hidden" name="listingType" value={activeTab.listingType} />
      <input type="hidden" name="type" value={activeTab.type} />

      <div className="ms-home-search-row">
        <PlaceAutocomplete />
        <button className="btn btn-primary" type="submit" title="Search">
          <Search size={18} aria-hidden />
          Search
        </button>
      </div>

      <div className="ms-home-search-actions">
        <button className="btn btn-secondary" type="button" onClick={useNearMe}>
          <Crosshair size={17} aria-hidden />
          Near me
        </button>
        {["Office", "Retail", "Warehouse", "Coworking"].map((label) => (
          <a key={label} className="btn btn-secondary" href={`/search?type=${encodeURIComponent(label.toLowerCase())}`}>
            {label}
          </a>
        ))}
      </div>
    </form>
  );
}
