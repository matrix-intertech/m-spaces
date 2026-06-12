import type { MetadataRoute } from "next";

const FALLBACK_SITE_URL = "https://m-spaces.vercel.app";

function getSiteUrl() {
  const configuredUrl =
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.PUBLIC_APP_ORIGIN ??
    process.env.VERCEL_PROJECT_PRODUCTION_URL ??
    process.env.VERCEL_URL ??
    FALLBACK_SITE_URL;

  const normalizedUrl = configuredUrl.startsWith("http")
    ? configuredUrl
    : `https://${configuredUrl}`;

  return normalizedUrl.replace(/\/+$/, "");
}

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl();

  return {
    rules: [
      {
        userAgent: "*",
        allow: [
          "/",
          "/about",
          "/contact",
          "/commercial-real-estate-india",
          "/partners",
          "/partner-signup",
          "/property",
          "/requirements",
          "/search",
          "/services",
          "/terms-conditions",
          "/privacy-policy",
        ],
        disallow: [
          "/admin",
          "/agent",
          "/api",
          "/broker",
          "/builder",
          "/complete-profile",
          "/corporate",
          "/dealer",
          "/edit-profile",
          "/external-sales",
          "/following",
          "/forgot-password",
          "/login",
          "/logout",
          "/messages",
          "/my-chats",
          "/my-visits",
          "/notifications",
          "/owner",
          "/profile",
          "/reset-password",
          "/sales",
          "/svc",
          "/vault",
          "/visits",
          "/wallet",
        ],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
