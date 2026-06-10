import type { Metadata, Viewport } from "next";
import { getCurrentUser } from "@/services/api";
import { AuthProvider } from "@/contexts/AuthContext";
import { Footer } from "@/components/layout/Footer";
import { Navbar } from "@/components/layout/Navbar";
import "leaflet/dist/leaflet.css";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://matrixspaces.com"),
  title: {
    default: "MatrixSpaces | Commercial Real Estate Discovery",
    template: "%s | MatrixSpaces"
  },
  description: "Discover, compare, manage, and communicate around verified commercial real estate spaces.",
  openGraph: {
    title: "MatrixSpaces",
    description: "Modern real-estate discovery and management platform.",
    url: "https://matrixspaces.com",
    siteName: "MatrixSpaces",
    images: [{ url: "/assets/logo.png", width: 512, height: 512 }]
  },
  icons: {
    icon: "/assets/icon.png",
    apple: "/assets/icon.png"
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#dc2626"
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const role = String(user?.role ?? "").toLowerCase();
  const hidePublicChrome = role === "admin" || role === "support";

  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;900&display=swap"
          rel="stylesheet"
        />
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" crossOrigin="" />
        <link rel="stylesheet" href="https://unpkg.com/leaflet-control-geocoder@2.4.0/dist/Control.Geocoder.css" crossOrigin="" />
        <link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css" crossOrigin="" />
        <link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css" crossOrigin="" />
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css" />
      </head>
      <body style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <AuthProvider user={user}>
          {!hidePublicChrome ? <Navbar user={user} /> : null}
          <main style={hidePublicChrome ? { margin: 0, padding: 0, flex: 1 } : { flex: 1 }}>{children}</main>
          {!hidePublicChrome ? <Footer /> : null}
        </AuthProvider>
      </body>
    </html>
  );
}
