"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import type { PlaceSuggestion } from "@/services/places";

export function PlaceAutocomplete({
  defaultValue = "",
  defaultLat = "",
  defaultLng = ""
}: {
  defaultValue?: string;
  defaultLat?: string;
  defaultLng?: string;
}) {
  const [query, setQuery] = useState(defaultValue);
  const [lat, setLat] = useState(defaultLat);
  const [lng, setLng] = useState(defaultLng);
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (query.trim().length < 3) {
      setSuggestions([]);
      return;
    }
    timerRef.current = setTimeout(async () => {
      const response = await fetch(`/api/places/search?q=${encodeURIComponent(query)}`).then((res) => res.json()).catch(() => ({ places: [] }));
      setSuggestions(response.places ?? []);
      setOpen(true);
    }, 350);
  }, [query]);

  return (
    <label style={{ position: "relative" }}>
      <span style={{ display: "block", marginBottom: ".3rem", fontWeight: 700 }}>Place</span>
      <span style={{ position: "relative", display: "block" }}>
        <MapPin size={17} aria-hidden style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--ms-muted)" }} />
        <input
          className="field"
          name="locality"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setLat("");
            setLng("");
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search city, sector, landmark..."
          style={{ paddingLeft: 38 }}
        />
      </span>
      <input type="hidden" name="lat" value={lat} />
      <input type="hidden" name="lng" value={lng} />
      {open && suggestions.length ? (
        <div
          className="surface"
          style={{
            position: "absolute",
            right: 0,
            left: 0,
            top: "calc(100% + 6px)",
            zIndex: 30,
            maxHeight: 260,
            overflowY: "auto",
            borderRadius: 18,
            padding: ".35rem"
          }}
        >
          {suggestions.map((place) => (
            <button
              key={`${place.lat}-${place.lon}-${place.display_name}`}
              type="button"
              onClick={() => {
                setQuery(place.display_name);
                setLat(place.lat);
                setLng(place.lon);
                setOpen(false);
              }}
              style={{
                display: "block",
                width: "100%",
                border: 0,
                borderRadius: 14,
                background: "transparent",
                padding: ".65rem",
                textAlign: "left",
                cursor: "pointer",
                color: "var(--ms-ink)"
              }}
            >
              <strong style={{ display: "block", fontSize: ".86rem" }}>{place.display_name.split(",").slice(0, 2).join(",")}</strong>
              <span style={{ color: "var(--ms-muted)", fontSize: ".75rem" }}>{place.display_name}</span>
            </button>
          ))}
        </div>
      ) : null}
    </label>
  );
}
