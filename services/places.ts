export interface PlaceSuggestion {
  display_name: string;
  lat: string;
  lon: string;
  type?: string;
  importance?: number;
}

export interface NearbyPlace {
  id: number;
  name: string;
  lat: number;
  lon: number;
  category: string;
}

type PhotonFeature = {
  geometry?: {
    coordinates?: [number, number];
  };
  properties?: {
    name?: string;
    street?: string;
    district?: string;
    city?: string;
    county?: string;
    state?: string;
    country?: string;
    countrycode?: string;
    osm_key?: string;
    osm_value?: string;
  };
};

const PLACE_CACHE_TTL_MS = 1000 * 60 * 20;
const EMPTY_PLACE_CACHE_TTL_MS = 1000 * 20;
const NEARBY_CACHE_TTL_MS = 1000 * 60 * 30;
const placeSearchCache = new Map<string, { expiresAt: number; places: PlaceSuggestion[] }>();
const nearbyPlacesCache = new Map<string, { expiresAt: number; places: NearbyPlace[] }>();
const placeSearchInFlight = new Map<string, Promise<PlaceSuggestion[]>>();
const nearbyPlacesInFlight = new Map<string, Promise<NearbyPlace[]>>();

function readCache<T>(cache: Map<string, { expiresAt: number; places: T[] }>, key: string) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    cache.delete(key);
    return null;
  }
  return entry.places;
}

function writeCache<T>(cache: Map<string, { expiresAt: number; places: T[] }>, key: string, places: T[], ttlMs: number) {
  cache.set(key, { expiresAt: Date.now() + ttlMs, places });
}

async function fetchWithTimeout(input: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function compact(parts: Array<string | undefined>) {
  return parts.map((part) => part?.trim()).filter(Boolean).join(", ");
}

function photonDisplayName(feature: PhotonFeature) {
  const properties = feature.properties ?? {};
  return compact([
    properties.name,
    properties.street,
    properties.district,
    properties.city,
    properties.county,
    properties.state,
    properties.country
  ]);
}

const STATIC_IN_LOCALITIES: PlaceSuggestion[] = [
  { display_name: "Connaught Place, New Delhi, India", lat: "28.6315", lon: "77.2167", type: "suburb" },
  { display_name: "Saket, New Delhi, India", lat: "28.5245", lon: "77.2066", type: "suburb" },
  { display_name: "Nehru Place, New Delhi, India", lat: "28.5494", lon: "77.2513", type: "commercial" },
  { display_name: "Noida Sector 18, Noida, Uttar Pradesh, India", lat: "28.5708", lon: "77.3260", type: "suburb" },
  { display_name: "Noida Sector 62, Noida, Uttar Pradesh, India", lat: "28.6304", lon: "77.3722", type: "suburb" },
  { display_name: "Cyber City, Gurugram, Haryana, India", lat: "28.4949", lon: "77.0896", type: "commercial" },
  { display_name: "MG Road, Gurugram, Haryana, India", lat: "28.4800", lon: "77.0800", type: "road" },
  { display_name: "Indiranagar, Bengaluru, Karnataka, India", lat: "12.9784", lon: "77.6408", type: "suburb" },
  { display_name: "Koramangala, Bengaluru, Karnataka, India", lat: "12.9352", lon: "77.6245", type: "suburb" },
  { display_name: "Bandra, Mumbai, Maharashtra, India", lat: "19.0544", lon: "72.8406", type: "suburb" },
  { display_name: "Andheri, Mumbai, Maharashtra, India", lat: "19.1136", lon: "72.8697", type: "suburb" },
  { display_name: "Gachibowli, Hyderabad, Telangana, India", lat: "17.4435", lon: "78.3772", type: "suburb" }
];

export async function searchPlaces(query: string): Promise<PlaceSuggestion[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const cacheKey = trimmed.toLowerCase();
  const cached = readCache(placeSearchCache, cacheKey);
  if (cached) return cached;
  const inFlight = placeSearchInFlight.get(cacheKey);
  if (inFlight) return inFlight;

  const request = (async () => {
    const params = new URLSearchParams({
      q: trimmed,
      limit: "8",
      lang: "en",
      lat: "28.6139",
      lon: "77.2090"
    });

    let places: PlaceSuggestion[] = [];

    try {
      const response = await fetchWithTimeout(`https://photon.komoot.io/api/?${params.toString()}`, {
        headers: {
          Accept: "application/json",
          "Accept-Language": "en",
          "User-Agent": "matrixspaces-frontend/2.0 (+https://matrixspaces.com)"
        }
      }, 4000);

      if (response.ok) {
        const payload = (await response.json()) as { features?: PhotonFeature[] };
        places = (payload.features ?? [])
          .filter((feature) => {
            const countryCode = feature.properties?.countrycode;
            return !countryCode || countryCode.toUpperCase() === "IN";
          })
          .map((feature): PlaceSuggestion | null => {
            const coordinates = feature.geometry?.coordinates;
            const displayName = photonDisplayName(feature);
            if (!coordinates || coordinates.length < 2 || !displayName) return null;
            return {
              display_name: displayName,
              lat: String(coordinates[1]),
              lon: String(coordinates[0]),
              type: feature.properties?.osm_value || feature.properties?.osm_key
            } satisfies PlaceSuggestion;
          })
          .filter((place): place is PlaceSuggestion => place !== null);
      }
    } catch {
      places = [];
    }

    if (!places.length) {
      try {
        const fallbackParams = new URLSearchParams({
          q: trimmed,
          format: "jsonv2",
          addressdetails: "1",
          limit: "8",
          countrycodes: "in"
        });
        const fallback = await fetchWithTimeout(`https://nominatim.openstreetmap.org/search?${fallbackParams.toString()}`, {
          headers: {
            Accept: "application/json",
            "Accept-Language": "en",
            "User-Agent": "matrixspaces-frontend/2.0 (+https://matrixspaces.com)"
          }
        }, 5000);
        if (fallback.ok) {
          const rows = (await fallback.json()) as Array<{
            display_name?: string;
            lat?: string;
            lon?: string;
            type?: string;
          }>;
          places = rows
            .map((row): PlaceSuggestion | null => {
              if (!row.display_name || !row.lat || !row.lon) return null;
              return {
                display_name: row.display_name,
                lat: row.lat,
                lon: row.lon,
                type: row.type
              };
            })
            .filter((place): place is PlaceSuggestion => place !== null);
        }
      } catch {
        // Keep the final local fallback below.
      }
    }

    if (!places.length) {
      const q = cacheKey;
      places = STATIC_IN_LOCALITIES.filter((place) => place.display_name.toLowerCase().includes(q)).slice(0, 8);
    }

    writeCache(placeSearchCache, cacheKey, places, places.length ? PLACE_CACHE_TTL_MS : EMPTY_PLACE_CACHE_TTL_MS);
    return places;
  })();

  placeSearchInFlight.set(cacheKey, request);
  try {
    return await request;
  } finally {
    placeSearchInFlight.delete(cacheKey);
  }
}

export async function getNearbyPlaces(lat: number, lon: number, radius = 10000): Promise<NearbyPlace[]> {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return [];
  const safeRadius = Math.min(Math.max(Math.round(radius), 250), 10000);
  const cacheKey = `${lat.toFixed(3)}:${lon.toFixed(3)}:${safeRadius}`;
  const cached = readCache(nearbyPlacesCache, cacheKey);
  if (cached) return cached;
  const inFlight = nearbyPlacesInFlight.get(cacheKey);
  if (inFlight) return inFlight;

  const request = (async () => {
    const query = `
      [out:json][timeout:12];
      (
        nwr(around:${safeRadius},${lat},${lon})["amenity"~"restaurant|cafe|bank|hospital|school|parking|fuel|pharmacy|cinema"];
        nwr(around:${safeRadius},${lat},${lon})["shop"~"supermarket|mall|convenience"];
        nwr(around:${safeRadius},${lat},${lon})["public_transport"];
        nwr(around:${safeRadius},${lat},${lon})["railway"="station"];
      );
      out center 40;
    `;

    const response = await fetchWithTimeout("https://overpass-api.de/api/interpreter", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
      body: new URLSearchParams({ data: query })
    }, 7000).catch(() => null);

    if (!response || !response.ok) return [];
    const data = await response.json();
    const places = (data.elements ?? [])
      .map((item: { id: number; lat?: number; lon?: number; center?: { lat?: number; lon?: number }; tags?: Record<string, string> }) => ({
        id: item.id,
        name: item.tags?.name || item.tags?.amenity || item.tags?.shop || item.tags?.railway || "Nearby place",
        lat: item.lat ?? item.center?.lat,
        lon: item.lon ?? item.center?.lon,
        category: item.tags?.amenity || item.tags?.shop || item.tags?.railway || item.tags?.public_transport || "place"
      }))
      .filter((item: NearbyPlace) => Number.isFinite(item.lat) && Number.isFinite(item.lon));
    writeCache(nearbyPlacesCache, cacheKey, places, NEARBY_CACHE_TTL_MS);
    return places;
  })();

  nearbyPlacesInFlight.set(cacheKey, request);
  try {
    return await request;
  } finally {
    nearbyPlacesInFlight.delete(cacheKey);
  }
}
