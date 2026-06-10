"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, Marker } from "leaflet";
import { streetMapTiles } from "@/lib/mapTiles";
import type { PlaceSuggestion } from "@/services/places";

const DEFAULT_LAT = 28.6139;
const DEFAULT_LNG = 77.209;

export function LocationPickerMap({
  latName = "lat",
  lngName = "lng",
  defaultLat = DEFAULT_LAT,
  defaultLng = DEFAULT_LNG,
  onChange
}: {
  latName?: string;
  lngName?: string;
  defaultLat?: number;
  defaultLng?: number;
  onChange?: (coords: { lat: number; lng: number }) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const [lat, setLat] = useState(defaultLat);
  const [lng, setLng] = useState(defaultLng);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function bootMap() {
      if (!containerRef.current || mapRef.current) return;

      try {
        const L = await import("leaflet");
        if (cancelled || !containerRef.current) return;

        L.Icon.Default.mergeOptions({
          iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
          iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
          shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png"
        });

        const map = L.map(containerRef.current).setView([defaultLat, defaultLng], 12);
        L.tileLayer(streetMapTiles.url, {
          attribution: streetMapTiles.attribution,
          maxZoom: streetMapTiles.maxZoom,
          subdomains: streetMapTiles.subdomains
        }).addTo(map);

        const marker = L.marker([defaultLat, defaultLng], { draggable: true }).addTo(map);
        mapRef.current = map;
        markerRef.current = marker;

        const setPoint = (nextLat: number, nextLng: number) => {
          setLat(nextLat);
          setLng(nextLng);
          onChange?.({ lat: nextLat, lng: nextLng });
        };

        marker.on("dragend", () => {
          const point = marker.getLatLng();
          setPoint(point.lat, point.lng);
        });

        map.on("click", (event) => {
          marker.setLatLng(event.latlng);
          setPoint(event.latlng.lat, event.latlng.lng);
        });

        setPoint(defaultLat, defaultLng);
        window.setTimeout(() => map.invalidateSize(), 80);
        window.setTimeout(() => map.invalidateSize(), 350);
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : "Map failed to load");
      }
    }

    void bootMap();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, [defaultLat, defaultLng, onChange]);

  async function searchPlaces() {
    const trimmed = query.trim();
    if (trimmed.length < 3) {
      setSuggestions([]);
      return;
    }
    const response = await fetch(`/api/places/search?q=${encodeURIComponent(trimmed)}`)
      .then((res) => res.json())
      .catch(() => ({ places: [] }));
    setSuggestions(response.places ?? []);
  }

  function selectPlace(place: PlaceSuggestion) {
    const nextLat = Number(place.lat);
    const nextLng = Number(place.lon);
    if (!Number.isFinite(nextLat) || !Number.isFinite(nextLng)) return;

    markerRef.current?.setLatLng([nextLat, nextLng]);
    mapRef.current?.setView([nextLat, nextLng], 16);
    setLat(nextLat);
    setLng(nextLng);
    setQuery(place.display_name);
    setSuggestions([]);
    onChange?.({ lat: nextLat, lng: nextLng });
  }

  return (
    <div className="grid gap-2">
      <div className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void searchPlaces();
            }
          }}
          className="w-full border border-gray-300 rounded-md px-3 py-2 bg-white focus:outline-none focus:border-red-500 shadow-sm text-sm"
          placeholder="Search city, sector, landmark..."
        />
        <button type="button" onClick={() => void searchPlaces()} className="bg-gray-900 text-white px-4 py-2 rounded-md text-xs font-bold hover:bg-gray-800">
          Search
        </button>
      </div>

      {suggestions.length ? (
        <div className="rounded-md border border-gray-200 bg-white shadow-sm max-h-40 overflow-y-auto">
          {suggestions.map((place) => (
            <button
              key={`${place.lat}-${place.lon}-${place.display_name}`}
              type="button"
              onClick={() => selectPlace(place)}
              className="block w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
            >
              <span className="font-bold text-gray-900">{place.display_name.split(",").slice(0, 2).join(", ")}</span>
              <span className="block text-gray-500 truncate">{place.display_name}</span>
            </button>
          ))}
        </div>
      ) : null}

      <div ref={containerRef} className="w-full h-64 rounded-md border border-gray-300 z-10 relative overflow-hidden bg-gray-100" />
      {loadError ? <p className="text-xs font-bold text-red-600">{loadError}</p> : null}
      <input type="hidden" name={latName} value={lat} />
      <input type="hidden" name={lngName} value={lng} />
      <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500">
        Selected: {lat.toFixed(5)}, {lng.toFixed(5)}
      </p>
    </div>
  );
}
