import type { NextConfig } from "next";

const backendOrigin = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "");
const allowedDevOrigins = [
  "unsavage-noncirculatory-destiny.ngrok-free.dev",
  ...(process.env.NEXT_ALLOWED_DEV_ORIGINS?.split(",").map((origin) => origin.trim()).filter(Boolean) ?? [])
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  allowedDevOrigins,
  turbopack: {
    root: process.cwd()
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.amazonaws.com" },
      { protocol: "https", hostname: "cdn.pixabay.com" },
      { protocol: "https", hostname: "images.unsplash.com" }
    ],
    formats: ["image/avif", "image/webp"],
    unoptimized: false
  },
  async rewrites() {
    const internalBridgeRules = [
      { source: "/svc/server/api/properties", destination: "/api/properties" },
      { source: "/svc/server/api/properties/:path*", destination: "/api/properties/:path*" },
      { source: "/svc/server/partners", destination: "/api/partners" },
      { source: "/svc/server/:path*", destination: "/api/_internal/:path*" },
      { source: "/uploads/:path*", destination: "/api/_internal/uploads/:path*" },
      { source: "/assets/:path*", destination: "/assets/:path*" }
    ];

    if (backendOrigin) {
      return [
        ...internalBridgeRules,
        { source: "/uploads/:path*", destination: `${backendOrigin}/uploads/:path*` }
      ];
    }

    return internalBridgeRules;
  }
};

export default nextConfig;
