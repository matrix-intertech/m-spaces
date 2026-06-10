import type { Property } from "@/types";
import { s3BaseUrl } from "@/lib/config";

const INDIA_TIME_ZONE = "Asia/Kolkata";
const S3_KEY_PREFIXES = ["properties/", "projects/", "logos/", "profiles/", "covers/", "avatars/", "new_assets/"];

function dateParts(value: string | number | Date | null | undefined, includeSeconds: boolean) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: INDIA_TIME_ZONE,
    day: "numeric",
    month: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    ...(includeSeconds ? { second: "2-digit" } : {}),
    hour12: true
  });
  const parts = formatter.formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return {
    day: String(Number(get("day"))),
    month: String(Number(get("month"))),
    year: get("year"),
    hour: String(Number(get("hour")) || 12),
    minute: get("minute").padStart(2, "0"),
    second: get("second").padStart(2, "0"),
    period: get("dayPeriod").toUpperCase()
  };
}

export function money(value: Property["final_price"]): string {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount) || amount <= 0) return "Price on request";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(amount);
}

export function formatIndianNumber(value: unknown): string {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount)) return "0";
  const sign = amount < 0 ? "-" : "";
  const [whole, fraction = ""] = Math.abs(amount).toFixed(Number.isInteger(amount) ? 0 : 2).split(".");
  const lastThree = whole.slice(-3);
  const leading = whole.slice(0, -3);
  const grouped = leading ? `${leading.replace(/\B(?=(\d{2})+(?!\d))/g, ",")},${lastThree}` : lastThree;
  const trimmedFraction = fraction.replace(/0+$/, "");
  return `${sign}${grouped}${trimmedFraction ? `.${trimmedFraction}` : ""}`;
}

export function formatDateTime(value: string | number | Date | null | undefined): string {
  const parts = dateParts(value, true);
  if (!parts) return "";
  return `${parts.day}/${parts.month}/${parts.year}, ${parts.hour}:${parts.minute}:${parts.second} ${parts.period}`;
}

export function formatTime(value: string | number | Date | null | undefined): string {
  const parts = dateParts(value, false);
  if (!parts) return "";
  return `${parts.hour}:${parts.minute} ${parts.period}`;
}

export function titleCase(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .replace(/[_-]/g, " ")
    .replace(/\w\S*/g, (part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase());
}

export function parsePhotos(value: Property["photos"], fallback?: string | null): string[] {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.filter(Boolean);
    } catch {
      return value.split(",").map((item) => item.trim()).filter(Boolean);
    }
  }
  return fallback ? [fallback] : [];
}

function cleanAssetPath(path: string): string {
  return path
    .trim()
    .replace(/^['"]|['"]$/g, "")
    .replace(/\\/g, "/")
    .replace(/[\r\n]/g, "");
}

function isS3Key(path: string): boolean {
  return S3_KEY_PREFIXES.some((prefix) => path.startsWith(prefix));
}

function joinS3Path(key: string): string {
  return `${s3BaseUrl}/${key.replace(/^\/+/, "")}`;
}

export function assetPath(path?: string | null, fallback = "/assets/no-photo.svg"): string {
  if (!path) return fallback;

  const clean = cleanAssetPath(path);
  if (!clean || clean === "null" || clean.includes("undefined")) return fallback;
  if (/^(https?:|data:|blob:)/.test(clean)) return clean;
  if (clean.startsWith("//")) return `https:${clean}`;

  if (clean.startsWith("/uploads/")) {
    const uploadKey = clean.replace(/^\/uploads\//, "");
    if (isS3Key(uploadKey)) return joinS3Path(uploadKey);
    if (uploadKey && !uploadKey.includes("/")) return joinS3Path(`properties/${uploadKey}`);
    return clean;
  }

  if (clean.startsWith("uploads/")) {
    const uploadKey = clean.replace(/^uploads\//, "");
    if (isS3Key(uploadKey)) return joinS3Path(uploadKey);
    if (uploadKey && !uploadKey.includes("/")) return joinS3Path(`properties/${uploadKey}`);
    return `/${clean}`;
  }

  if (isS3Key(clean)) return joinS3Path(clean);
  if (clean.startsWith("/")) return clean;
  if (clean.startsWith("assets/")) return `/${clean}`;

  // Keep parity with legacy EJS behavior for user/profile media keys that don't
  // carry an explicit known prefix (e.g. avatar/cover keys stored as plain S3 keys).
  return joinS3Path(clean);
}
