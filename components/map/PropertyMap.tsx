"use client";

import { Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { GeoJSON as LeafletGeoJSON, LayerGroup, Map as LeafletMap, Marker } from "leaflet";
import { assetPath, parsePhotos } from "@/lib/format";
import { cleanMapTiles, streetMapTiles } from "@/lib/mapTiles";
import type { Property } from "@/types";
import type { NearbyPlace } from "@/services/places";

declare global {
  interface Window {
    L?: typeof import("leaflet");
  }
}

const LEAFLET_STYLESHEETS = [
  "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css",
  "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css"
];

const LEAFLET_SCRIPTS = [
  "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js",
  "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js"
];

const CLUSTER_STYLESHEETS = [
  "https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css",
  "https://cdn.jsdelivr.net/npm/leaflet.markercluster@1.5.3/dist/MarkerCluster.css"
];

const CLUSTER_DEFAULT_STYLESHEETS = [
  "https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css",
  "https://cdn.jsdelivr.net/npm/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css"
];

const CLUSTER_SCRIPTS = [
  "https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js",
  "https://cdn.jsdelivr.net/npm/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js"
];

function safeText(value: unknown, fallback = "") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function createPropertyPopupNode(property: Property, photo: string) {
  const anchor = document.createElement("a");
  anchor.href = `/property/${property.id}`;
  anchor.style.display = "block";
  anchor.style.minWidth = "210px";
  anchor.style.color = "#0f172a";
  anchor.style.textDecoration = "none";

  const image = document.createElement("img");
  image.src = photo;
  image.alt = "";
  image.style.width = "100%";
  image.style.height = "110px";
  image.style.objectFit = "cover";
  image.style.borderRadius = "8px";
  image.style.marginBottom = "8px";
  anchor.appendChild(image);

  const title = document.createElement("strong");
  title.textContent = safeText(property.title, safeText(property.locality, "MatrixSpaces property"));
  anchor.appendChild(title);

  const locality = document.createElement("div");
  locality.style.color = "#64748b";
  locality.style.fontSize = "12px";
  locality.style.marginTop = "4px";
  locality.textContent = safeText(property.locality);
  anchor.appendChild(locality);

  return anchor;
}

function createNearbyPlacePopupNode(place: NearbyPlace) {
  const wrapper = document.createElement("div");

  const title = document.createElement("strong");
  title.textContent = safeText(place.name, "Nearby place");
  wrapper.appendChild(title);

  const category = document.createElement("span");
  category.textContent = safeText(place.category);
  wrapper.appendChild(document.createElement("br"));
  wrapper.appendChild(category);

  return wrapper;
}

async function loadLeaflet() {
  if (typeof window === "undefined") return import("leaflet");
  if (window.L) return window.L;

  void loadFirstAvailableStylesheet("leaflet-cdn-css", LEAFLET_STYLESHEETS);
  await Promise.race([
    loadFirstAvailableScript("leaflet-cdn-js", LEAFLET_SCRIPTS),
    wait(2200).then(async () => {
      if (window.L) return;
      const leafletModule = await import("leaflet");
      window.L = leafletModule;
    })
  ]).catch(async () => {
    const leafletModule = await import("leaflet");
    window.L = leafletModule;
  });

  if (window.L) return window.L;
  throw new Error("Leaflet could not load from CDN or local package");
}

async function loadLeafletPlugins() {
  if (typeof window === "undefined") return;
  await loadLeaflet();
  await Promise.allSettled([
    loadFirstAvailableStylesheet("leaflet-cluster-css", CLUSTER_STYLESHEETS),
    loadFirstAvailableStylesheet("leaflet-cluster-default-css", CLUSTER_DEFAULT_STYLESHEETS),
    loadFirstAvailableScript("leaflet-cluster-js", CLUSTER_SCRIPTS)
  ]);
}

async function loadFirstAvailableStylesheet(id: string, hrefs: string[]) {
  for (const href of hrefs) {
    try {
      await loadStylesheetOnce(`${id}-${hashUrl(href)}`, href);
      return;
    } catch {
      // Try the next CDN.
    }
  }
}

async function loadFirstAvailableScript(id: string, sources: string[]) {
  let lastError: unknown;
  for (const src of sources) {
    try {
      await loadScriptOnce(`${id}-${hashUrl(src)}`, src);
      return;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error(`Failed to load ${id}`);
}

function hashUrl(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash.toString(36);
}

function loadStylesheetOnce(id: string, href: string) {
  const existing = document.getElementById(id) as HTMLLinkElement | null;
  if (existing) {
    if (existing.dataset.loaded === "true") return Promise.resolve();
    return withTimeout(
      new Promise<void>((resolve, reject) => {
        existing.addEventListener("load", () => resolve(), { once: true });
        existing.addEventListener("error", () => reject(new Error(`Failed to load ${href}`)), { once: true });
      }),
      4500,
      `Timed out loading ${href}`
    );
  }

  return withTimeout(new Promise<void>((resolve, reject) => {
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = href;
    link.crossOrigin = "";
    link.onload = () => {
      link.dataset.loaded = "true";
      resolve();
    };
    link.onerror = () => reject(new Error(`Failed to load ${href}`));
    document.head.appendChild(link);
  }), 4500, `Timed out loading ${href}`);
}

function loadScriptOnce(id: string, src: string) {
  const existing = document.getElementById(id) as HTMLScriptElement | null;
  if (existing) {
    if (existing.dataset.loaded === "true") return Promise.resolve();
    return withTimeout(
      new Promise<void>((resolve, reject) => {
        existing.addEventListener("load", () => resolve(), { once: true });
        existing.addEventListener("error", () => reject(new Error(`Failed to load ${src}`)), { once: true });
      }),
      4500,
      `Timed out loading ${src}`
    );
  }

  return withTimeout(new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.id = id;
    script.src = src;
    script.crossOrigin = "";
    script.async = true;
    script.onload = () => {
      script.dataset.loaded = "true";
      resolve();
    };
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  }), 4500, `Timed out loading ${src}`);
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string) {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function wait(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

type PlaceSearchResult = {
  name: string;
  center: import("leaflet").LatLng;
  bbox?: import("leaflet").LatLngBounds;
};

function excludeIndiaFromGlobalBoundaries(geoData: GeoJSON.FeatureCollection): GeoJSON.FeatureCollection {
  if (!Array.isArray(geoData.features)) return geoData;

  return {
    ...geoData,
    features: geoData.features.filter((feature) => {
      const properties = feature.properties ?? {};
      const name = String(properties.name ?? properties.NAME ?? "").toLowerCase();
      const alpha2 = String(properties["ISO3166-1-Alpha-2"] ?? properties.iso_a2 ?? properties.ISO_A2 ?? "").toUpperCase();
      const alpha3 = String(properties["ISO3166-1-Alpha-3"] ?? properties.iso_a3 ?? properties.ISO_A3 ?? "").toUpperCase();
      return (
        name !== "india" &&
        alpha2 !== "IN" &&
        alpha3 !== "IND"
      );
    })
  };
}

function isIndiaCoordinate(lat: number, lng: number) {
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= 6 && lat <= 38 && lng >= 68 && lng <= 98;
}

function fallbackCoordinatesForProperty(property: Property): [number, number] | null {
  const text = `${property.title ?? ""} ${property.locality ?? ""} ${property.city ?? ""} ${property.address ?? ""}`.toLowerCase();
  const places: Array<{ match: string[]; coords: [number, number] }> = [
    { match: ["greater noida"], coords: [28.4744, 77.5040] },
    { match: ["sector 51 noida", "noida sector 51"], coords: [28.5850, 77.3700] },
    { match: ["noida"], coords: [28.5355, 77.3910] },
    { match: ["gurugram", "gurgaon"], coords: [28.4595, 77.0266] },
    { match: ["ghaziabad"], coords: [28.6692, 77.4538] },
    { match: ["faridabad"], coords: [28.4089, 77.3178] },
    { match: ["new delhi", "delhi"], coords: [28.6139, 77.2090] }
  ];
  return places.find((place) => place.match.some((token) => text.includes(token)))?.coords ?? null;
}

function propertyCoordinates(property: Property): [number, number] | null {
  const lat = Number(property.latitude);
  const lng = Number(property.longitude);

  if (isIndiaCoordinate(lat, lng)) return [lat, lng];
  if (isIndiaCoordinate(lng, lat)) return [lng, lat];
  return fallbackCoordinatesForProperty(property);
}

export function PropertyMap({
  properties,
  height = 460,
  showNearbyPlaces = false,
  showSearchControl = true
}: {
  properties: Property[];
  height?: number;
  showNearbyPlaces?: boolean;
  showSearchControl?: boolean;
}) {
  const mapElementRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const clusterRef = useRef<LayerGroup | null>(null);
  const nearbyLayerRef = useRef<LayerGroup | null>(null);
  const countryBoundaryRef = useRef<LeafletGeoJSON | null>(null);
  const indiaBoundaryRef = useRef<LeafletGeoJSON | null>(null);
  const baseLayersRef = useRef<Record<"clean" | "street" | "satellite", import("leaflet").TileLayer | null>>({
    clean: null,
    street: null,
    satellite: null
  });
  const activeBaseLayerRef = useRef<"clean" | "street" | "satellite">("clean");
  const tileFailureCountsRef = useRef<Record<"clean" | "street" | "satellite", number>>({
    clean: 0,
    street: 0,
    satellite: 0
  });
  const tileFallbackAttemptedRef = useRef<Record<"clean" | "street" | "satellite", boolean>>({
    clean: false,
    street: false,
    satellite: false
  });
  const [nearbyPlaces, setNearbyPlaces] = useState<NearbyPlace[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<PlaceSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [tileNotice, setTileNotice] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  function clearTileFailures(layerName: "clean" | "street" | "satellite") {
    tileFailureCountsRef.current[layerName] = 0;
    if (activeBaseLayerRef.current === layerName) setTileNotice(false);
  }

  function switchBaseLayer(layerName: "clean" | "street" | "satellite") {
    const map = mapRef.current;
    const nextLayer = baseLayersRef.current[layerName];
    if (!map || !nextLayer) return;

    Object.values(baseLayersRef.current).forEach((layer) => {
      if (layer && map.hasLayer(layer)) map.removeLayer(layer);
    });

    nextLayer.addTo(map);
    activeBaseLayerRef.current = layerName;
    tileFailureCountsRef.current[layerName] = 0;
    setTileNotice(false);
  }

  function handleTileFailure(layerName: "clean" | "street" | "satellite") {
    if (activeBaseLayerRef.current !== layerName) return;

    const nextCount = tileFailureCountsRef.current[layerName] + 1;
    tileFailureCountsRef.current[layerName] = nextCount;

    if (nextCount < 4) return;

    if (layerName === "clean" && !tileFallbackAttemptedRef.current.clean) {
      tileFallbackAttemptedRef.current.clean = true;
      switchBaseLayer("street");
      return;
    }

    if (layerName === "street" && !tileFallbackAttemptedRef.current.street) {
      tileFallbackAttemptedRef.current.street = true;
      switchBaseLayer("satellite");
      return;
    }

    setTileNotice(true);
  }

  useEffect(() => {
    let cancelled = false;

    async function initMap() {
      if (!mapElementRef.current || mapRef.current) return;
      let L: typeof import("leaflet");
      try {
        L = await loadLeaflet();
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : "Leaflet CDN failed to load");
        return;
      }
      if (cancelled || !mapElementRef.current) return;

      const firstCoordinates = properties.reduce<[number, number] | null>((found, property) => found ?? propertyCoordinates(property), null);
      const center: [number, number] = firstCoordinates ?? [28.5492, 77.2527];

      const map = L.map(mapElementRef.current, { attributionControl: false }).setView(center, firstCoordinates ? 13 : 11);
      L.control.attribution({ position: "bottomright" }).addTo(map);
      const cleanLayer = L.tileLayer(cleanMapTiles.url, {
        attribution: cleanMapTiles.attribution,
        maxZoom: cleanMapTiles.maxZoom,
        subdomains: cleanMapTiles.subdomains
      })
        .on("tileerror", () => handleTileFailure("clean"))
        .on("tileload", () => clearTileFailures("clean"));
      const streetLayer = L.tileLayer(streetMapTiles.url, {
        attribution: streetMapTiles.attribution,
        maxZoom: streetMapTiles.maxZoom,
        subdomains: streetMapTiles.subdomains
      })
        .on("tileerror", () => handleTileFailure("street"))
        .on("tileload", () => clearTileFailures("street"));
      const satelliteLayer = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
        attribution: "Tiles &copy; Esri, Maxar, Earthstar Geographics, and the GIS User Community",
        maxZoom: 19
      })
        .on("tileerror", () => handleTileFailure("satellite"))
        .on("tileload", () => clearTileFailures("satellite"));
      baseLayersRef.current = {
        clean: cleanLayer,
        street: streetLayer,
        satellite: satelliteLayer
      };
      cleanLayer.addTo(map);
      L.control.layers({
        "Clean map": cleanLayer,
        "Street map": streetLayer,
        "Satellite": satelliteLayer
      }, undefined, {
        position: "topright",
        collapsed: false
      }).addTo(map);
      map.on("baselayerchange", (event: { layer: import("leaflet").Layer }) => {
        if (event.layer === cleanLayer) activeBaseLayerRef.current = "clean";
        else if (event.layer === streetLayer) activeBaseLayerRef.current = "street";
        else if (event.layer === satelliteLayer) activeBaseLayerRef.current = "satellite";

        setTileNotice(false);
      });

      mapRef.current = map;
      setMapReady(true);
      setTimeout(() => map.invalidateSize(), 120);
      void loadLeafletPlugins();
    }

    initMap();
    return () => {
      cancelled = true;
    };
  }, [properties]);

  useEffect(() => {
    if (!mapReady) return;

    const trimmedQuery = searchQuery.trim();
    if (trimmedQuery.length < 2) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => {
      setSearching(true);
      fetch(`/api/places/search?q=${encodeURIComponent(trimmedQuery)}`, { signal: controller.signal })
        .then((response) => response.json())
        .then((payload: { places?: Array<{ display_name: string; lat: string; lon: string }> }) => {
          if (controller.signal.aborted) return;
          const results = (payload.places ?? [])
            .map((place): PlaceSearchResult | null => {
              const lat = Number(place.lat);
              const lon = Number(place.lon);
              if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
              const center = window.L ? window.L.latLng(lat, lon) : ({ lat, lng: lon } as import("leaflet").LatLng);
              return {
                name: place.display_name,
                center,
                bbox: window.L ? window.L.latLngBounds(center, center) : undefined
              };
            })
            .filter((result): result is PlaceSearchResult => result !== null);
          setSearchResults(results);
        })
        .catch(() => {
          if (!controller.signal.aborted) setSearchResults([]);
        })
        .finally(() => {
          if (!controller.signal.aborted) setSearching(false);
        });
    }, 220);

    return () => {
      controller.abort();
      clearTimeout(timeout);
    };
  }, [mapReady, searchQuery]);

  useEffect(() => {
    let cancelled = false;

    async function syncMarkers() {
      if (!mapReady || !mapRef.current) return;
      const L = await loadLeaflet();
      if (cancelled || !mapRef.current) return;
      const map = mapRef.current;

      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      clusterRef.current?.remove();
      clusterRef.current = typeof L.markerClusterGroup === "function"
        ? L.markerClusterGroup({
          showCoverageOnHover: false,
          maxClusterRadius: 48,
          iconCreateFunction(cluster: { getChildCount: () => number }) {
            const count = cluster.getChildCount();
            const size = count >= 100 ? 50 : count >= 10 ? 44 : 38;
            const fontSize = count >= 100 ? 13 : count >= 10 ? 14 : 15;
            return L.divIcon({
              className: "ms-map-cluster",
              iconSize: [size, size],
              html: `
                <div style="
                  width:${size}px;
                  height:${size}px;
                  border-radius:999px;
                  display:grid;
                  place-items:center;
                  background: linear-gradient(180deg, rgba(245,158,11,.98), rgba(249,115,22,.98));
                  border: 2px solid rgba(255,255,255,.96);
                  box-shadow: 0 12px 26px rgba(15,23,42,.28);
                  color: white;
                  font-weight: 900;
                  line-height: 1;
                  letter-spacing: -0.02em;
                ">
                  <span style="font-size:${fontSize}px">${count}</span>
                </div>`
            });
          }
        })
        : L.layerGroup();
      const clusterLayer = clusterRef.current;
      clusterLayer.addTo(map);

      const bounds: [number, number][] = [];
      const icon = L.icon({
        iconUrl: "/assets/property.png",
        iconSize: [34, 34],
        iconAnchor: [17, 34],
        popupAnchor: [0, -30]
      });

      properties.forEach((property) => {
        const coords = propertyCoordinates(property);
        if (!coords) return;
        const [lat, lng] = coords;

        const photo = assetPath(parsePhotos(property.photos, property.image_url || property.photo)[0]);
        const marker = L.marker([lat, lng], { icon })
          .bindPopup(createPropertyPopupNode(property, photo))
          .addTo(clusterLayer);
        markersRef.current.push(marker);
        bounds.push([lat, lng]);
      });

      if (bounds.length > 1) map.fitBounds(bounds, { padding: [30, 30] });
      else if (bounds.length === 1) map.setView(bounds[0], 14);
    }

    syncMarkers();
    return () => {
      cancelled = true;
    };
  }, [properties, mapReady]);

  useEffect(() => {
    let cancelled = false;

    async function syncBoundaries() {
      if (!mapReady || !mapRef.current) return;
      const L = await loadLeaflet();
      if (cancelled || !mapRef.current) return;

      const map = mapRef.current;
      try {
        const [countriesResponse, indiaResponse] = await Promise.all([
          fetch("/assets/country-boundaries-cleaned.geojson"),
          fetch("/assets/india-official-boundary.geojson")
        ]);
        if (!countriesResponse.ok || !indiaResponse.ok) throw new Error("Boundary GeoJSON not found");

        const [countries, india] = await Promise.all([
          countriesResponse.json(),
          indiaResponse.json()
        ]);
        if (cancelled || !mapRef.current) return;

        countryBoundaryRef.current?.remove();
        indiaBoundaryRef.current?.remove();

        countryBoundaryRef.current = L.geoJSON(excludeIndiaFromGlobalBoundaries(countries as GeoJSON.FeatureCollection), {
          style: {
            color: "#2563eb",
            weight: 1.6,
            opacity: 0.9,
            fillOpacity: 0,
            dashArray: "5 5"
          },
          interactive: false
        }).addTo(map);

        indiaBoundaryRef.current = L.geoJSON(india, {
          style: {
            color: "#2563eb",
            weight: 1.6,
            opacity: 1,
            fillColor: "#2563eb",
            fillOpacity: 0.04,
            dashArray: "5 5"
          },
          interactive: false
        }).addTo(map);

        countryBoundaryRef.current.bringToFront();
        indiaBoundaryRef.current.bringToFront();

      } catch (error) {
        console.warn(error instanceof Error ? error.message : "Boundary GeoJSON failed");
      }
    }

    syncBoundaries();
    return () => {
      cancelled = true;
    };
  }, [mapReady]);

  useEffect(() => {
    let cancelled = false;

    async function syncNearbyPlaces() {
      if (!showNearbyPlaces || !mapReady || !mapRef.current) return;
      const centerCoordinates = properties.reduce<[number, number] | null>((found, property) => found ?? propertyCoordinates(property), null);
      if (!centerCoordinates) return;

      const [lat, lon] = centerCoordinates;

      const [L, response] = await Promise.all([
        loadLeaflet(),
        fetch(`/api/places/nearby?lat=${lat}&lon=${lon}&radius=10000`).then((res) => res.json()).catch(() => ({ places: [] }))
      ]);

      if (cancelled || !mapRef.current) return;
      const places = (response.places ?? []) as NearbyPlace[];
      setNearbyPlaces(places);

      nearbyLayerRef.current?.remove();
      nearbyLayerRef.current = L.layerGroup().addTo(mapRef.current);

      places.slice(0, 32).forEach((place) => {
        const marker = L.circleMarker([place.lat, place.lon], {
          radius: 6,
          color: "#0f172a",
          weight: 1,
          fillColor: "#f59e0b",
          fillOpacity: 0.82
        }).bindPopup(createNearbyPlacePopupNode(place));
        marker.addTo(nearbyLayerRef.current!);
      });
    }

    syncNearbyPlaces();
    return () => {
      cancelled = true;
    };
  }, [properties, showNearbyPlaces, mapReady]);

  return (
    <div className="surface" style={{ borderRadius: 28, overflow: "hidden" }}>
      <div style={{ position: "relative" }}>
        <div style={{ position: "absolute", left: 12, top: 82, zIndex: 520 }}>
          {showSearchControl && !searchOpen ? (
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              aria-label="Open place search"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 44,
                height: 44,
                borderRadius: 999,
                border: "1px solid rgba(226,232,240,.96)",
                background: "rgba(255,255,255,.96)",
                boxShadow: "0 16px 36px rgba(15,23,42,.14)",
                color: "var(--ms-heading)",
                cursor: "pointer",
                backdropFilter: "blur(10px)"
              }}
            >
              <Search size={18} aria-hidden />
            </button>
          ) : showSearchControl ? (
            <div
              style={{
                width: "min(88vw, 300px)",
                display: "grid",
                gap: ".45rem",
                padding: ".65rem",
                borderRadius: 18,
                background: "rgba(255,255,255,.94)",
                border: "1px solid rgba(226,232,240,.96)",
                boxShadow: "0 16px 36px rgba(15,23,42,.14)",
                backdropFilter: "blur(10px)"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: ".5rem" }}>
                <label style={{ flex: 1, display: "grid", gap: ".3rem" }}>
                  <span style={{ fontSize: ".78rem", fontWeight: 800, color: "var(--ms-muted)" }}>Search places</span>
                  <input
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Search city, sector, landmark..."
                    style={{
                      width: "100%",
                      borderRadius: 14,
                      border: "1px solid rgba(203,213,225,.95)",
                      background: "white",
                      padding: ".75rem .85rem",
                      fontSize: ".95rem",
                      outline: "none",
                      color: "var(--ms-heading)",
                      boxShadow: "inset 0 1px 0 rgba(255,255,255,.6)"
                    }}
                  />
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setSearchOpen(false);
                    setSearchQuery("");
                    setSearchResults([]);
                    setSearching(false);
                  }}
                  aria-label="Close search"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    border: "1px solid rgba(226,232,240,.96)",
                    background: "white",
                    color: "var(--ms-heading)",
                    cursor: "pointer"
                  }}
                >
                  <X size={18} aria-hidden />
                </button>
              </div>
              {searchQuery.trim().length >= 2 ? (
                <div style={{ display: "grid", gap: ".35rem", maxHeight: 260, overflow: "auto" }}>
                  {searching ? (
                    <div style={{ padding: ".4rem .2rem", fontSize: ".82rem", color: "var(--ms-muted)", fontWeight: 700 }}>Searching places…</div>
                  ) : null}
                  {!searching && searchResults.length === 0 ? (
                    <div style={{ padding: ".4rem .2rem", fontSize: ".82rem", color: "var(--ms-muted)", fontWeight: 700 }}>No places found</div>
                  ) : null}
                  {searchResults.slice(0, 6).map((place) => (
                    <button
                      key={`${place.name}-${place.center.lat}-${place.center.lng}`}
                      type="button"
                      onClick={() => {
                        const map = mapRef.current;
                        if (!map) return;
                        map.flyTo([place.center.lat, place.center.lng], 15, { duration: 0.7 });
                        setSearchQuery(place.name);
                        setSearchResults([]);
                        setSearchOpen(false);
                      }}
                      style={{
                        textAlign: "left",
                        border: "1px solid rgba(226,232,240,.95)",
                        borderRadius: 14,
                        background: "rgba(248,250,252,.95)",
                        padding: ".65rem .75rem",
                        cursor: "pointer",
                        color: "var(--ms-heading)"
                      }}
                    >
                      <div style={{ fontSize: ".88rem", fontWeight: 800, lineHeight: 1.25 }}>{place.name}</div>
                      <div style={{ marginTop: ".15rem", fontSize: ".74rem", fontWeight: 700, color: "var(--ms-muted)" }}>
                        {place.center.lat.toFixed(4)}, {place.center.lng.toFixed(4)}
                      </div>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
        <div
          ref={mapElementRef}
          aria-label="Property map"
          style={{
            height,
            minHeight: 280,
            overflow: "hidden"
          }}
        />
        {!mapReady ? (
          <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", background: "rgba(255,255,255,.72)", color: "var(--ms-muted)", fontWeight: 800 }}>
            {loadError || "Loading map..."}
          </div>
        ) : null}
        {tileNotice ? (
          <div style={{ position: "absolute", left: 12, right: 12, bottom: 12, zIndex: 500, borderRadius: 16, background: "rgba(15,23,42,.84)", color: "white", padding: ".65rem .8rem", fontSize: ".82rem", fontWeight: 700 }}>
            Map tiles are being blocked or could not load on this network.
          </div>
        ) : null}
      </div>
      {showNearbyPlaces && nearbyPlaces.length ? (
        <div style={{ display: "flex", gap: ".45rem", overflowX: "auto", borderTop: "1px solid rgba(226,232,240,.8)", padding: ".65rem" }}>
          {nearbyPlaces.slice(0, 10).map((place) => (
            <span key={place.id} style={{ flex: "0 0 auto", borderRadius: 999, background: "rgba(15,23,42,.06)", padding: ".4rem .65rem", color: "var(--ms-muted)", fontSize: ".78rem", fontWeight: 800 }}>
              {place.name}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
