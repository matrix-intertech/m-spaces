import type { Metadata, Viewport } from "next";
import { Poppins } from "next/font/google";
import { getCurrentUser } from "@/services/api";
import { AuthProvider } from "@/contexts/AuthContext";
import { Footer } from "@/components/layout/Footer";
import { Navbar } from "@/components/layout/Navbar";
import "leaflet/dist/leaflet.css";
import "./globals.css";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "900"],
  display: "swap",
  variable: "--font-poppins"
});

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
  const hidePublicChrome = ["admin", "support", "builder", "broker", "dealer", "agent", "external_sales"].includes(role);

  return (
    <html lang="en" data-scroll-behavior="smooth" data-theme="light">
      <head>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css" />
      </head>
      <body className={poppins.className} style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <AuthProvider user={user}>
          {!hidePublicChrome ? <Navbar user={user} /> : null}
          <main style={hidePublicChrome ? { margin: 0, padding: 0, flex: 1 } : { flex: 1 }}>{children}</main>
          {!hidePublicChrome ? <Footer /> : null}
        </AuthProvider>
      </body>
    </html>
  );
}
