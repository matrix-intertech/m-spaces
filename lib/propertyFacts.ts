const PROPERTY_FACTS_MARKER = "--- Property Facts ---";
const PROPERTY_OVERVIEW_MARKER = "--- Overview ---";

export type PropertyFacts = {
  configuration: string;
  floorNumber: string;
  totalFloors: string;
  facing: string;
  overlooking: string;
  propertyAge: string;
  negotiable: string;
};

function asText(value: unknown) {
  return value === null || value === undefined ? "" : String(value);
}

function stripSections(value: string) {
  const markers = [PROPERTY_FACTS_MARKER, PROPERTY_OVERVIEW_MARKER]
    .map((marker) => value.indexOf(marker))
    .filter((index) => index >= 0);
  if (!markers.length) return value.trim();
  return value.slice(0, Math.min(...markers)).trim();
}

function readSection(value: string, marker: string) {
  const startIndex = value.indexOf(marker);
  if (startIndex === -1) return "";
  const remainder = value.slice(startIndex + marker.length);
  return stripSections(remainder);
}

function readField(section: string, label: string) {
  return section.match(new RegExp(`${label}:\\s*(.*)`))?.[1]?.trim() ?? "";
}

export function cleanPropertyDescription(condition: unknown) {
  return stripSections(asText(condition));
}

export function extractPropertyFacts(condition: unknown): PropertyFacts {
  const value = asText(condition);
  const factsSection = readSection(value, PROPERTY_FACTS_MARKER);

  return {
    configuration: readField(factsSection, "Configuration"),
    floorNumber: readField(factsSection, "Floor Number"),
    totalFloors: readField(factsSection, "Total Floors"),
    facing: readField(factsSection, "Facing"),
    overlooking: readField(factsSection, "Overlooking"),
    propertyAge: readField(factsSection, "Property Age"),
    negotiable: readField(factsSection, "Negotiable")
  };
}

export function formatPropertyFactsBlock(facts: Partial<PropertyFacts>) {
  const entries = [
    ["Configuration", facts.configuration],
    ["Floor Number", facts.floorNumber],
    ["Total Floors", facts.totalFloors],
    ["Facing", facts.facing],
    ["Overlooking", facts.overlooking],
    ["Property Age", facts.propertyAge],
    ["Negotiable", facts.negotiable]
  ]
    .map(([label, value]) => [label, asText(value).trim()] as const)
    .filter(([, value]) => value && value.toLowerCase() !== "n/a");

  if (!entries.length) return "";

  return `\n\n${PROPERTY_FACTS_MARKER}\n${entries.map(([label, value]) => `${label}: ${value}`).join("\n")}`;
}

