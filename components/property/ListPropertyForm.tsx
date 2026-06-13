"use client";

import { useEffect, useState } from "react";
import { LocationPickerMap } from "@/components/map/LocationPickerMap";
import { backendBaseUrl } from "@/lib/config";
import type { PlaceSuggestion } from "@/services/places";
import type { User } from "@/types";

const managedRoles = new Set(["admin", "support", "builder", "broker", "agent", "external_sales"]);

export function ListPropertyForm({ user }: { user: User }) {
  const role = String(user.role || "").toLowerCase();
  const canChooseOwnership = managedRoles.has(role);
  const [listingType, setListingType] = useState("rent");
  const [propertyType, setPropertyType] = useState("Office");
  const [isOwnerProperty, setIsOwnerProperty] = useState(!canChooseOwnership);
  const [locality, setLocality] = useState("");
  const [localitySuggestions, setLocalitySuggestions] = useState<PlaceSuggestion[]>([]);
  const [localityOpen, setLocalityOpen] = useState(false);
  const [localityLoading, setLocalityLoading] = useState(false);

  const ownerName = String(user.name || user.username || "");
  const ownerPhone = String(user.phone || "");
  const ownerEmail = String(user.email || "");
  const ownerRoleLabel =
    role === "external_sales"
      ? user.sales_agent_type === "associated"
        ? "associated sales agent"
        : "independent sales agent"
      : role.replace(/_/g, " ");

  useEffect(() => {
    const query = locality.trim();
    if (query.length < 2) {
      setLocalitySuggestions([]);
      setLocalityLoading(false);
      return;
    }

    setLocalityLoading(true);
    const timer = window.setTimeout(async () => {
      const response = await fetch(`/api/places/search?q=${encodeURIComponent(query)}`)
        .then((res) => res.json())
        .catch(() => ({ places: [] }));
      setLocalitySuggestions((response.places ?? []) as PlaceSuggestion[]);
      setLocalityLoading(false);
      setLocalityOpen(true);
    }, 280);

    return () => window.clearTimeout(timer);
  }, [locality]);

  return (
    <form
      action={`${backendBaseUrl}/property/add`}
      method="post"
      encType="multipart/form-data"
      className="surface"
      style={{ display: "grid", gap: ".9rem", borderRadius: 8, padding: "1.25rem" }}
    >
      <input name="isOwner" type="hidden" value={isOwnerProperty ? "true" : "false"} />

      {canChooseOwnership ? (
        <section className="surface" style={{ display: "grid", gap: ".75rem", borderRadius: 8, padding: "1rem", border: "1px solid var(--ms-line)" }}>
          <label style={{ display: "inline-flex", alignItems: "center", gap: ".6rem", fontWeight: 800 }}>
            <input type="checkbox" checked={isOwnerProperty} onChange={(event) => setIsOwnerProperty(event.target.checked)} />
            I am the owner of this property
          </label>
          {isOwnerProperty ? (
            <div style={{ borderRadius: 8, background: "rgba(59, 130, 246, 0.08)", color: "var(--ms-muted)", padding: ".85rem" }}>
              <div style={{ fontWeight: 800, color: "var(--ms-ink)" }}>Owner details will use your logged-in {ownerRoleLabel || "user"} profile.</div>
              <div style={{ marginTop: ".35rem", fontSize: ".95rem" }}>
                {ownerName || "Profile"} {ownerEmail ? `· ${ownerEmail}` : ""} {ownerPhone ? `· ${ownerPhone}` : ""}
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {canChooseOwnership && !isOwnerProperty ? (
        <section className="surface" style={{ display: "grid", gap: ".75rem", borderRadius: 8, padding: "1rem", border: "1px solid var(--ms-line)" }}>
          <h2 style={{ margin: 0, fontSize: "1rem" }}>Owner Details</h2>
          <div style={{ display: "grid", gap: ".8rem", gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
            <label>
              <span style={{ display: "block", marginBottom: ".3rem", fontWeight: 700 }}>Owner name</span>
              <input className="field" name="owner_name" type="text" required />
            </label>
            <label>
              <span style={{ display: "block", marginBottom: ".3rem", fontWeight: 700 }}>Owner mobile number</span>
              <input className="field" name="owner_mobile" type="tel" inputMode="tel" required />
            </label>
            <label>
              <span style={{ display: "block", marginBottom: ".3rem", fontWeight: 700 }}>Owner email address</span>
              <input className="field" name="owner_email" type="email" required />
            </label>
          </div>
        </section>
      ) : null}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: ".8rem" }}>
        <label>
          <span style={{ display: "block", marginBottom: ".3rem", fontWeight: 700 }}>Title</span>
          <input className="field" name="title" required />
        </label>
        <label>
          <span style={{ display: "block", marginBottom: ".3rem", fontWeight: 700 }}>Locality</span>
          <div style={{ position: "relative" }}>
            <input
              className="field"
              name="locality"
              value={locality}
              onChange={(event) => setLocality(event.target.value)}
              onFocus={() => setLocalityOpen(true)}
              onBlur={() => window.setTimeout(() => setLocalityOpen(false), 140)}
              placeholder="Search city, sector, landmark..."
              required
            />
            {localityOpen ? (
              <div
                className="surface"
                style={{
                  position: "absolute",
                  top: "calc(100% + 6px)",
                  left: 0,
                  right: 0,
                  zIndex: 20,
                  borderRadius: 14,
                  padding: ".25rem",
                  maxHeight: 220,
                  overflowY: "auto"
                }}
              >
                {localityLoading ? (
                  <div style={{ padding: ".55rem .6rem", color: "var(--ms-muted)", fontSize: ".82rem", fontWeight: 700 }}>
                    Searching localities...
                  </div>
                ) : localitySuggestions.length ? (
                  localitySuggestions.map((place) => (
                    <button
                      key={`${place.lat}-${place.lon}-${place.display_name}`}
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => {
                        setLocality(place.display_name);
                        setLocalityOpen(false);
                      }}
                      style={{
                        display: "block",
                        width: "100%",
                        border: 0,
                        background: "transparent",
                        textAlign: "left",
                        borderRadius: 10,
                        padding: ".52rem .56rem",
                        cursor: "pointer"
                      }}
                    >
                      <strong style={{ display: "block", fontSize: ".85rem", color: "var(--ms-ink)" }}>
                        {place.display_name.split(",").slice(0, 2).join(",")}
                      </strong>
                      <span style={{ color: "var(--ms-muted)", fontSize: ".74rem" }}>{place.display_name}</span>
                    </button>
                  ))
                ) : locality.trim().length >= 2 ? (
                  <div style={{ padding: ".55rem .6rem", color: "var(--ms-muted)", fontSize: ".82rem", fontWeight: 700 }}>
                    No matching localities found.
                  </div>
                ) : (
                  <div style={{ padding: ".55rem .6rem", color: "var(--ms-muted)", fontSize: ".82rem", fontWeight: 700 }}>
                    Start typing to search places.
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </label>
        <label>
          <span style={{ display: "block", marginBottom: ".3rem", fontWeight: 700 }}>Property type</span>
          <select className="field" name="type" value={propertyType} onChange={(event) => setPropertyType(event.target.value)}>
            <option value="Office">Office Space</option>
            <option value="Warehouse">Warehouse</option>
            <option value="Retail">Retail</option>
            <option value="Bank Space">Bank Space</option>
            <option value="Gym Space">Gym Space</option>
            <option value="Villa">Villa</option>
            <option value="Mansion">Mansion</option>
            <option value="Luxury Flat">Luxury Flat</option>
            <option value="House">House</option>
            <option value="Others">Others</option>
          </select>
        </label>
        <label>
          <span style={{ display: "block", marginBottom: ".3rem", fontWeight: 700 }}>Other property type</span>
          <input className="field" name="typeOther" placeholder="Only needed if Property type = Others" disabled={propertyType !== "Others"} required={propertyType === "Others"} />
        </label>
        <label>
          <span style={{ display: "block", marginBottom: ".3rem", fontWeight: 700 }}>Listing type</span>
          <select className="field" name="listingType" value={listingType} onChange={(event) => setListingType(event.target.value)}>
            <option value="rent">Rent</option>
            <option value="sale">Sale</option>
            <option value="lease">Lease</option>
            <option value="pg">PG / Co-living</option>
          </select>
        </label>
        <label>
          <span style={{ display: "block", marginBottom: ".3rem", fontWeight: 700 }}>Final price</span>
          <input className="field" name="final_price" inputMode="numeric" />
        </label>
        <label>
          <span style={{ display: "block", marginBottom: ".3rem", fontWeight: 700 }}>Size</span>
          <input className="field" name="size" placeholder="Carpet area in sq.ft" />
        </label>
        <label>
          <span style={{ display: "block", marginBottom: ".3rem", fontWeight: 700 }}>Configuration</span>
          <input className="field" name="configuration" placeholder="e.g. 2 Bedrooms, 2 Bathrooms, 1 Balcony" />
        </label>
        <label>
          <span style={{ display: "block", marginBottom: ".3rem", fontWeight: 700 }}>Floor Number</span>
          <input className="field" name="floor_number" placeholder="e.g. 4th" />
        </label>
        <label>
          <span style={{ display: "block", marginBottom: ".3rem", fontWeight: 700 }}>Total Floors</span>
          <input className="field" name="total_floors" placeholder="e.g. 4 Floors" />
        </label>
        <label>
          <span style={{ display: "block", marginBottom: ".3rem", fontWeight: 700 }}>Overlooking</span>
          <input className="field" name="overlooking" placeholder="e.g. Main Road" />
        </label>
        <label>
          <span style={{ display: "block", marginBottom: ".3rem", fontWeight: 700 }}>Property Age</span>
          <input className="field" name="property_age" placeholder="e.g. 0 to 1 Year Old" />
        </label>
        <label>
          <span style={{ display: "block", marginBottom: ".3rem", fontWeight: 700 }}>Contact phone</span>
          <input className="field" name="contact" inputMode="tel" defaultValue={isOwnerProperty ? ownerPhone : ""} />
        </label>
      </div>

      <section className="surface" style={{ display: "grid", gap: ".85rem", borderRadius: 8, padding: "1rem" }}>
        <h2 style={{ margin: 0, fontSize: "1rem" }}>Location</h2>
        <LocationPickerMap latName="latitude" lngName="longitude" />
      </section>

      <label>
        <span style={{ display: "block", marginBottom: ".3rem", fontWeight: 700 }}>Description</span>
        <textarea className="field" name="condition" rows={5} />
      </label>

      {listingType === "pg" ? (
        <section className="surface" style={{ display: "grid", gap: ".85rem", borderRadius: 8, padding: "1rem" }}>
          <h2 style={{ margin: 0, fontSize: "1rem" }}>PG / Co-living Details</h2>
          <div style={{ display: "grid", gap: ".8rem", gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
            <label>
              <span style={{ display: "block", marginBottom: ".3rem", fontWeight: 700 }}>Room Sharing</span>
              <input className="field" name="pg_sharing" placeholder="e.g. Single, Double, Triple, Quad+" />
            </label>
            <label>
              <span style={{ display: "block", marginBottom: ".3rem", fontWeight: 700 }}>Tenant Preference</span>
              <input className="field" name="pg_tenant" placeholder="e.g. Boys, Girls, Anyone" />
            </label>
            <label>
              <span style={{ display: "block", marginBottom: ".3rem", fontWeight: 700 }}>Food Included</span>
              <input className="field" name="pg_food" placeholder="e.g. Yes, Veg Only, No" />
            </label>
            <label>
              <span style={{ display: "block", marginBottom: ".3rem", fontWeight: 700 }}>Amenities</span>
              <input className="field" name="pg_amenities" placeholder="Comma-separated, e.g. WiFi, AC, Laundry" />
            </label>
          </div>
        </section>
      ) : (
        <section className="surface" style={{ display: "grid", gap: ".85rem", borderRadius: 8, padding: "1rem" }}>
          <h2 style={{ margin: 0, fontSize: "1rem" }}>Property Overview Details</h2>
          <div style={{ display: "grid", gap: ".8rem", gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
            <label>
              <span style={{ display: "block", marginBottom: ".3rem", fontWeight: 700 }}>Furnishing</span>
              <select className="field" name="furnishing" defaultValue="Unfurnished">
                <option value="Unfurnished">Unfurnished</option>
                <option value="Semi-Furnished">Semi-Furnished</option>
                <option value="Fully-Furnished">Fully-Furnished</option>
              </select>
            </label>
            <label>
              <span style={{ display: "block", marginBottom: ".3rem", fontWeight: 700 }}>Parking</span>
              <select className="field" name="parking" defaultValue="None">
                <option value="None">None</option>
                <option value="Available">Available</option>
                <option value="Reserved">Reserved</option>
              </select>
            </label>
            <label>
              <span style={{ display: "block", marginBottom: ".3rem", fontWeight: 700 }}>Bathrooms</span>
              <input className="field" name="bathrooms" inputMode="numeric" placeholder="e.g. 2" />
            </label>
            <label>
              <span style={{ display: "block", marginBottom: ".3rem", fontWeight: 700 }}>Facing</span>
              <select className="field" name="facing" defaultValue="">
                <option value="">Select</option>
                <option value="North">North</option>
                <option value="South">South</option>
                <option value="East">East</option>
                <option value="West">West</option>
                <option value="North-East">North-East</option>
                <option value="North-West">North-West</option>
                <option value="South-East">South-East</option>
                <option value="South-West">South-West</option>
              </select>
            </label>
          </div>
        </section>
      )}

      <label style={{ display: "inline-flex", alignItems: "center", gap: ".5rem", color: "var(--ms-muted)", fontWeight: 700 }}>
        <input name="negotiable" type="checkbox" value="on" />
        Price is negotiable
      </label>
      <label>
        <span style={{ display: "block", marginBottom: ".3rem", fontWeight: 700 }}>Photos</span>
        <input className="field" name="photos" type="file" accept="image/*" multiple />
      </label>
      <label style={{ display: "inline-flex", alignItems: "center", gap: ".5rem", color: "var(--ms-muted)", fontWeight: 700 }}>
        <input name="ownership_declaration" type="checkbox" value="on" required />
        {canChooseOwnership && !isOwnerProperty
          ? "I confirm I am authorized by the owner to list this property."
          : "I confirm I am authorized to list this property."}
      </label>
      <button className="btn btn-primary" type="submit">
        Submit listing
      </button>
    </form>
  );
}
