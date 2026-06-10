export const backendBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ??
  process.env.NEXT_PUBLIC_BACKEND_URL?.replace(/\/$/, "") ??
  "/svc/server";

export const socketUrl =
  process.env.NEXT_PUBLIC_SOCKET_URL?.replace(/\/$/, "") ?? backendBaseUrl;

const configuredS3BaseUrl = process.env.NEXT_PUBLIC_S3_BASE_URL?.replace(/\/$/, "");
const configuredS3Bucket = process.env.NEXT_PUBLIC_AWS_S3_BUCKET_NAME;
const configuredS3Region = process.env.NEXT_PUBLIC_AWS_REGION ?? "ap-south-1";

export const s3BaseUrl =
  configuredS3BaseUrl ??
  (configuredS3Bucket
    ? `https://${configuredS3Bucket}.s3.${configuredS3Region}.amazonaws.com`
    : "https://matrixspaces-uploads-590184011565-ap-south-1-an.s3.ap-south-1.amazonaws.com");

export function backendUrl(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${backendBaseUrl}${normalizedPath}`;
}

export function resolveAbsoluteUrl(pathOrUrl: string, origin: string): string {
  return /^https?:\/\//i.test(pathOrUrl) ? pathOrUrl : new URL(pathOrUrl, origin).toString();
}
