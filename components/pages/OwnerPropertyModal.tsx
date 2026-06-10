"use client";

import { FormEvent, type ReactNode, useEffect, useState } from "react";
import { LocationPickerMap } from "@/components/map/LocationPickerMap";
import { backendBaseUrl } from "@/lib/config";
import { cleanPropertyDescription, extractPropertyFacts } from "@/lib/propertyFacts";

type DashboardRecord = Record<string, any>;

const listingTypes = [
  { value: "rent", label: "For Rent" },
  { value: "sale", label: "For Sale" },
  { value: "lease", label: "For Lease" },
  { value: "pg", label: "PG / Co-living" }
];

const propertyTypes = [
  { value: "Office", label: "Office Space" },
  { value: "Warehouse", label: "Warehouse" },
  { value: "Retail", label: "Retail" },
  { value: "Bank Space", label: "Bank Space" },
  { value: "Gym Space", label: "Gym Space" },
  { value: "Villa", label: "Villa" },
  { value: "Mansion", label: "Mansion" },
  { value: "Luxury Flat", label: "Luxury Flat" },
  { value: "House", label: "House" },
  { value: "Others", label: "Others" }
];

const roomSharingOptions = ["Single", "Double", "Triple", "Quad+"];
const tenantOptions = ["Boys", "Girls", "Anyone"];
const foodOptions = ["Yes", "Veg Only", "No"];
const amenityOptions = ["WiFi", "AC", "Laundry", "Cleaning", "TV", "Fridge"];

function asText(value: unknown) {
  return value === null || value === undefined ? "" : String(value);
}

function cleanCondition(condition: unknown) {
  return cleanPropertyDescription(condition);
}

function extractOverview(condition: unknown, listingType: string) {
  const value = asText(condition);
  const overview = {
    furnishing: "Unfurnished",
    parking: "None",
    bathrooms: "",
    facing: "",
    pg_sharing: "",
    pg_tenant: "",
    pg_food: "",
    pg_amenities: ""
  };

  if (!value.includes("--- Overview ---")) return overview;
  const overviewText = value.split("--- Overview ---")[1] || "";
  const read = (label: string) => overviewText.match(new RegExp(`${label}:\\s*(.*)`))?.[1]?.trim() ?? "";

  if (listingType === "pg") {
    overview.pg_sharing = read("Room Sharing");
    overview.pg_tenant = read("Tenant");
    overview.pg_food = read("Food");
    overview.pg_amenities = read("Amenities");
    return overview;
  }

  overview.furnishing = read("Furnishing") || overview.furnishing;
  overview.parking = read("Parking") || overview.parking;
  overview.bathrooms = read("Bathrooms") || overview.bathrooms;
  overview.facing = read("Facing") || overview.facing;
  return overview;
}

function optionClass(selected: boolean) {
  return `px-3 py-1.5 border rounded-full text-xs font-bold transition-all focus:outline-none ${
    selected ? "bg-red-50 border-red-500 text-red-700" : "bg-white border-gray-300 text-gray-600 hover:bg-gray-50 hover:border-red-500"
  }`;
}

function smallOptionClass(selected: boolean) {
  return `px-2 py-1 border rounded text-[10px] font-bold transition-all focus:outline-none ${
    selected ? "bg-red-50 border-red-500 text-red-700" : "bg-white border-gray-300 text-gray-600 hover:bg-gray-50 hover:border-red-500"
  }`;
}

function ChoiceButtons({
  options,
  value,
  onChange,
  small = false
}: {
  options: Array<string | { value: string; label: string }>;
  value: string;
  onChange: (value: string) => void;
  small?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const optionValue = typeof option === "string" ? option : option.value;
        const label = typeof option === "string" ? option : option.label;
        return (
          <button key={optionValue} type="button" onClick={() => onChange(optionValue)} className={small ? smallOptionClass(value === optionValue) : optionClass(value === optionValue)}>
            {label}
          </button>
        );
      })}
    </div>
  );
}

function ModalFrame({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto relative custom-scrollbar border border-gray-200">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 z-10 bg-white rounded-full p-1" type="button">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <div className="p-6 md:p-7">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">{title}</h2>
          {children}
        </div>
      </div>
    </div>
  );
}

export function OwnerPropertyModal({
  mode,
  property,
  onClose
}: {
  mode: "add" | "edit";
  property?: DashboardRecord | null;
  onClose: () => void;
}) {
  const [listingType, setListingType] = useState("rent");
  const [propertyType, setPropertyType] = useState("Office");
  const [typeOther, setTypeOther] = useState("");
  const [pgSharing, setPgSharing] = useState("");
  const [pgTenant, setPgTenant] = useState("");
  const [pgFood, setPgFood] = useState("");
  const [pgAmenities, setPgAmenities] = useState<string[]>([]);
  const propertyFacts = extractPropertyFacts(property?.condition);

  useEffect(() => {
    const nextListingType = asText(property?.listing_type) || "rent";
    const rawType = asText(property?.type) || "Office";
    const matchedType = propertyTypes.some((option) => option.value === rawType) ? rawType : "Others";
    const overview = extractOverview(property?.condition, nextListingType);

    setListingType(mode === "add" ? "rent" : nextListingType);
    setPropertyType(mode === "add" ? "Office" : matchedType);
    setTypeOther(mode === "add" || matchedType !== "Others" ? "" : rawType);
    setPgSharing(overview.pg_sharing);
    setPgTenant(overview.pg_tenant);
    setPgFood(overview.pg_food);
    setPgAmenities(overview.pg_amenities ? overview.pg_amenities.split(",").map((item) => item.trim()).filter(Boolean) : []);
  }, [mode, property]);

  const overview = extractOverview(property?.condition, listingType);
  const isPg = listingType === "pg";
  const title = mode === "add" ? "List New Property" : "Edit Property";
  const submitLabel = mode === "add" ? "Submit Listing" : "Save Changes";

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (!listingType) {
      event.preventDefault();
      window.alert("Please select a listing type.");
      return;
    }
    if (!propertyType) {
      event.preventDefault();
      window.alert("Please select a property type.");
      return;
    }
    if (propertyType === "Others" && !typeOther.trim()) {
      event.preventDefault();
      window.alert("Please specify the property type.");
    }
  }

  function toggleAmenity(value: string) {
    setPgAmenities((items) => (items.includes(value) ? items.filter((item) => item !== value) : [...items, value]));
  }

  return (
    <ModalFrame title={title} onClose={onClose}>
      <form
        action={`${backendBaseUrl}${mode === "add" ? "/property/add" : "/owner/property/edit"}`}
        method="POST"
        encType={mode === "add" ? "multipart/form-data" : undefined}
        className="space-y-4"
        onSubmit={handleSubmit}
      >
        {mode === "add" ? <input type="hidden" name="status" value="listed" /> : <input type="hidden" name="id" value={asText(property?.id)} />}
        <input type="hidden" name="isOwner" value="true" />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label>
            <span className="block text-xs font-bold text-gray-700 mb-1">Title</span>
            <input type="text" name="title" required defaultValue={asText(property?.title)} className="w-full border border-gray-300 rounded-md px-3 py-2 bg-white focus:outline-none focus:border-red-500 shadow-sm" />
          </label>
          <label>
            <span className="block text-xs font-bold text-gray-700 mb-1">Locality</span>
            <input type="text" name="locality" required defaultValue={asText(property?.locality)} className="w-full border border-gray-300 rounded-md px-3 py-2 bg-white focus:outline-none focus:border-red-500 shadow-sm" placeholder="e.g. Connaught Place, New Delhi" />
          </label>
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-700 mb-2">Listing Type</label>
          <input type="hidden" name="listingType" value={listingType} />
          <ChoiceButtons options={listingTypes} value={listingType} onChange={setListingType} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label>
            <span className="block text-xs font-bold text-gray-700 mb-1">Contact Details</span>
            <input type="text" name="contact" required defaultValue={asText(property?.contact)} className="w-full border border-gray-300 rounded-md px-3 py-2 bg-white focus:outline-none focus:border-red-500 shadow-sm" placeholder="Phone / Email" />
          </label>
          <label>
            <span className="block text-xs font-bold text-gray-700 mb-1">Expected Price (Rs.)</span>
            <input type="number" name="final_price" required defaultValue={asText(property?.final_price)} className="w-full border border-gray-300 rounded-md px-3 py-2 bg-white focus:outline-none focus:border-red-500 shadow-sm" placeholder="e.g. 50000" />
          </label>
          <label>
            <span className="block text-xs font-bold text-gray-700 mb-1">Property Size (sq.ft)</span>
            <input type="text" name="size" required defaultValue={asText(property?.size)} className="w-full border border-gray-300 rounded-md px-3 py-2 bg-white focus:outline-none focus:border-red-500 shadow-sm" placeholder="e.g. 1200 sqft" />
          </label>
          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-gray-700 mb-2">Property Type</label>
            <input type="hidden" name="type" value={propertyType} />
            <ChoiceButtons options={propertyTypes} value={propertyType} onChange={setPropertyType} />
            {propertyType === "Others" ? (
              <input
                type="text"
                name="typeOther"
                value={typeOther}
                onChange={(event) => setTypeOther(event.target.value)}
                required
                placeholder="Specify Property Type"
                className="w-full border border-gray-300 rounded-md px-3 py-2 mt-3 bg-gray-50 focus:outline-none focus:border-red-500"
              />
            ) : null}
          </div>
        </div>

        <div className="md:col-span-2 border-t border-gray-200 pt-4 mt-2">
          <label className="block text-sm font-bold text-gray-700 mb-3">Property Facts</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label>
              <span className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Configuration</span>
              <input type="text" name="configuration" defaultValue={propertyFacts.configuration} placeholder="e.g. 2 Bedrooms, 2 Bathrooms, 1 Balcony" className="w-full border border-gray-300 rounded-md px-3 py-2 bg-white focus:outline-none focus:border-red-500 shadow-sm text-xs" />
            </label>
            <label>
              <span className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Floor Number</span>
              <input type="text" name="floor_number" defaultValue={propertyFacts.floorNumber} placeholder="e.g. 4th" className="w-full border border-gray-300 rounded-md px-3 py-2 bg-white focus:outline-none focus:border-red-500 shadow-sm text-xs" />
            </label>
            <label>
              <span className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Total Floors</span>
              <input type="text" name="total_floors" defaultValue={propertyFacts.totalFloors} placeholder="e.g. 4 Floors" className="w-full border border-gray-300 rounded-md px-3 py-2 bg-white focus:outline-none focus:border-red-500 shadow-sm text-xs" />
            </label>
            <label>
              <span className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Overlooking</span>
              <input type="text" name="overlooking" defaultValue={propertyFacts.overlooking} placeholder="e.g. Main Road" className="w-full border border-gray-300 rounded-md px-3 py-2 bg-white focus:outline-none focus:border-red-500 shadow-sm text-xs" />
            </label>
            <label>
              <span className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Property Age</span>
              <select name="property_age" defaultValue={propertyFacts.propertyAge} className="w-full border border-gray-300 rounded-md px-2 py-1.5 focus:outline-none focus:border-red-500 shadow-sm text-xs bg-white">
                <option value="">Select</option>
                <option value="0 to 1 Year Old">0 to 1 Year Old</option>
                <option value="1 to 3 Years Old">1 to 3 Years Old</option>
                <option value="3 to 5 Years Old">3 to 5 Years Old</option>
                <option value="5 to 10 Years Old">5 to 10 Years Old</option>
                <option value="10+ Years Old">10+ Years Old</option>
              </select>
            </label>
            <label className="flex items-center gap-2 self-end text-xs font-bold text-gray-600">
              <input type="checkbox" name="negotiable" defaultChecked={propertyFacts.negotiable.toLowerCase() === "yes" || propertyFacts.negotiable.toLowerCase() === "true" || propertyFacts.negotiable.toLowerCase() === "negotiable"} className="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500" />
              Price is negotiable
            </label>
          </div>
        </div>

        <div className="md:col-span-2 border-t border-gray-200 pt-4 mt-2">
          <label className="block text-sm font-bold text-gray-700 mb-3">Property Overview Details</label>
          {!isPg ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <label>
                <span className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Furnishing</span>
                <select name="furnishing" defaultValue={asText(property?.furnishing) || overview.furnishing} className="w-full border border-gray-300 rounded-md px-2 py-1.5 focus:outline-none focus:border-red-500 shadow-sm text-xs bg-white">
                  <option value="Unfurnished">Unfurnished</option>
                  <option value="Semi-Furnished">Semi-Furnished</option>
                  <option value="Fully-Furnished">Fully-Furnished</option>
                </select>
              </label>
              <label>
                <span className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Parking</span>
                <select name="parking" defaultValue={asText(property?.parking) || overview.parking} className="w-full border border-gray-300 rounded-md px-2 py-1.5 focus:outline-none focus:border-red-500 shadow-sm text-xs bg-white">
                  <option value="None">None</option>
                  <option value="Available">Available</option>
                  <option value="Reserved">Reserved</option>
                </select>
              </label>
              <label>
                <span className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Bathrooms</span>
                <input type="number" name="bathrooms" min="0" defaultValue={asText(property?.bathrooms) || overview.bathrooms} className="w-full border border-gray-300 rounded-md px-2 py-1.5 focus:outline-none focus:border-red-500 shadow-sm text-xs" />
              </label>
              <label>
                <span className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Facing</span>
                <select name="facing" defaultValue={asText(property?.facing) || overview.facing} className="w-full border border-gray-300 rounded-md px-2 py-1.5 focus:outline-none focus:border-red-500 shadow-sm text-xs bg-white">
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
          ) : (
            <div className="space-y-4 mt-3 border-t border-gray-200 pt-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-2">Room Sharing</label>
                  <input type="hidden" name="pg_sharing" value={pgSharing} />
                  <ChoiceButtons options={roomSharingOptions} value={pgSharing} onChange={setPgSharing} small />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-2">Tenant</label>
                  <input type="hidden" name="pg_tenant" value={pgTenant} />
                  <ChoiceButtons options={tenantOptions} value={pgTenant} onChange={setPgTenant} small />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-2">Food</label>
                  <input type="hidden" name="pg_food" value={pgFood} />
                  <ChoiceButtons options={foodOptions} value={pgFood} onChange={setPgFood} small />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-2">Amenities</label>
                <input type="hidden" name="pg_amenities" value={pgAmenities.join(", ")} />
                <div className="flex flex-wrap gap-2">
                  {amenityOptions.map((amenity) => (
                    <button key={amenity} type="button" onClick={() => toggleAmenity(amenity)} className={optionClass(pgAmenities.includes(amenity))}>
                      {amenity}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <label>
          <span className="block text-xs font-bold text-gray-700 mb-1">Description / Condition</span>
          <textarea name="condition" required defaultValue={cleanCondition(property?.condition)} className="w-full border border-gray-300 rounded-md px-3 py-2 bg-white focus:outline-none focus:border-red-500 shadow-sm h-20" placeholder="Describe your property, condition, furnishings, etc..." />
        </label>

        {mode === "add" ? (
          <>
            <label>
              <span className="block text-xs font-bold text-gray-700 mb-1">Property Photos</span>
              <input type="file" name="photos" accept="image/*" multiple className="w-full border border-gray-300 rounded-md px-3 py-2 bg-white focus:outline-none focus:border-red-500 shadow-sm text-sm" />
            </label>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Location (click map or drag marker)</label>
              <LocationPickerMap />
            </div>
            <div className="pt-4 border-t border-gray-200">
              <label className="flex items-start gap-3 cursor-pointer">
                <input type="checkbox" name="ownership_declaration" required className="mt-1 w-5 h-5 text-red-600 rounded border-gray-300 focus:ring-red-500 shadow-sm" />
                <div>
                  <span className="font-bold text-gray-800">Ownership Declaration</span>
                  <p className="text-xs text-gray-600 mt-1">I confirm that I am the rightful owner of this property, or have been authorized by the owner to list it.</p>
                </div>
              </label>
            </div>
          </>
        ) : null}

        <button type="submit" className={`w-full text-white py-3 rounded-md font-bold shadow-sm active:scale-95 transition-all ${mode === "add" ? "bg-red-600 hover:bg-red-700" : "bg-blue-600 hover:bg-blue-700"}`}>
          {submitLabel}
        </button>
      </form>
    </ModalFrame>
  );
}
