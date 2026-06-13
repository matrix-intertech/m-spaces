import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site-url";

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
          "/signup",
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
