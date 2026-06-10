import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ListingPage } from "@/components/property/ListingPage";
import { ContentPage, type ContentPageSection } from "@/components/pages/ContentPage";
import { DashboardShell } from "@/components/pages/DashboardShell";
import { PortfolioPage } from "@/components/pages/PortfolioPage";
import { PartnersPage } from "@/components/pages/PartnersPage";
import { DataListPage } from "@/components/pages/DataListPage";
import { OwnerDashboard } from "@/components/pages/OwnerDashboard";
import { CompareFeedPage } from "@/components/pages/CompareFeedPage";
import { getCompareProperties, getCurrentUser, getNotifications, getOwnerDashboard, getPartners, getPortfolio, getProperties, getRequirements, getUserPropertyCollection, getVault, getVisits, getWallet } from "@/services/api";
import { toUrlSearchParams, type SearchParamsInput } from "@/utils/searchParams";

const contentRoutes: Record<string, { title: string; subtitle: string; sections: ContentPageSection[]; cta?: { href: string; label: string } }> = {
  about: {
    title: "About MatrixSpaces",
    subtitle: "MatrixSpaces connects businesses, owners, builders, brokers, and sales teams around verified commercial real-estate inventory.",
    sections: [
      { title: "Discovery", body: "Search and compare spaces by locality, listing type, size, budget, and verification status." },
      { title: "Management", body: "Owners and partners manage listings, visits, portfolios, and broker assignments from role-specific workspaces." },
      { title: "Communication", body: "Real-time chat, notifications, contact requests, and visit flows continue through the existing backend." }
    ]
  },
  services: {
    title: "All Services",
    subtitle: "Discover every MatrixSpaces service for buyers, owners, brokers, builders, and sales partners.",
    cta: { href: "/services/valuation", label: "Start with valuation" },
    sections: [
      { title: "Property valuation", body: "Request data-backed valuation for commercial and residential decisions with locality and inventory context." },
      { title: "Sell or rent property", body: "List properties, manage responses, and track lead/visit workflows from one place." },
      { title: "Property discovery", body: "Search verified listings by type, city, locality, and budget to shortlist faster." },
      { title: "Owner and partner listing tools", body: "Create and manage inventory, upload media, and control listing status through dashboard workflows." },
      { title: "Partner network", body: "Connect with builders, brokers, agents, and external sales professionals already active on MatrixSpaces." },
      { title: "Upcoming services", body: "Co-broking and new-project collaboration workflows are being prepared for launch." }
    ]
  },
  "services/valuation": {
    title: "Valuation",
    subtitle: "Request valuation support for commercial property decisions.",
    sections: [
      { title: "Market context", body: "Use listing, locality, condition, and size signals to frame expectations." },
      { title: "Documentation", body: "Keep valuation requests connected with your profile and property workflow." }
    ]
  },
  "services/sell-rent": {
    title: "Sell or Rent",
    subtitle: "Bring your commercial space onto MatrixSpaces and route leads through existing backend workflows.",
    cta: { href: "/list-property", label: "List property" },
    sections: [
      { title: "Owner-first listing", body: "Create property details, upload photos, and manage listing status." },
      { title: "Partner coordination", body: "Assign brokers or sales agents where your account role allows it." }
    ]
  },
  "sell-rent": {
    title: "Sell or Rent",
    subtitle: "List commercial space, coordinate leads, and keep ownership workflows connected to MatrixSpaces.",
    cta: { href: "/list-property", label: "List property" },
    sections: [
      { title: "For owners", body: "Create listings and manage contact, visit, and broker assignment workflows." },
      { title: "For partners", body: "Sales, broker, and builder roles can list on behalf of owners where authorized." }
    ]
  },
  valuation: {
    title: "Valuation",
    subtitle: "Generate a valuation request path for commercial property decisions.",
    sections: [
      { title: "Inputs", body: "Locality, property type, size, condition, and comparable listing details shape the valuation workflow." },
      { title: "Output", body: "Use the report flow to coordinate the next step with MatrixSpaces." }
    ]
  },
  contact: {
    title: "Contact",
    subtitle: "Reach MatrixSpaces for partnerships, support, listings, and enterprise requirements.",
    sections: [
      { title: "Support", body: "Use your account workspace for authenticated account, visit, and listing support." },
      { title: "Partnerships", body: "Builders, brokers, and sales partners can register through the partner signup flow." }
    ]
  },
  report: {
    title: "Report an Issue",
    subtitle: "Share listing, account, visit, or platform issues with the MatrixSpaces team.",
    sections: [{ title: "Resolution", body: "Reports continue to post through the Express backend support workflow." }]
  },
  "privacy-policy": {
    title: "Privacy Policy",
    subtitle: "How MatrixSpaces handles account, property, communication, and visit data.",
    sections: [
      { title: "Account data", body: "Profile and authentication data is stored by the existing backend session and user systems." },
      { title: "Property data", body: "Listing, upload, and portfolio data remains governed by the current backend storage rules." }
    ]
  },
  privacy: {
    title: "Privacy",
    subtitle: "MatrixSpaces keeps privacy controls aligned with existing production backend behavior.",
    sections: [{ title: "Current behavior", body: "Session, notification, chat, and upload handling remains backend-compatible." }]
  },
  "terms-conditions": {
    title: "Terms and Conditions",
    subtitle: "Terms for using MatrixSpaces property discovery, account, listing, and communication services.",
    sections: [
      { title: "Listings", body: "Users are responsible for the accuracy of listing, portfolio, and requirement information." },
      { title: "Communications", body: "Chat, visits, and contact requests should be used for legitimate real-estate interactions." }
    ]
  },
  terms: {
    title: "Terms",
    subtitle: "MatrixSpaces platform terms for commercial real-estate workflows.",
    sections: [{ title: "Use of service", body: "Use MatrixSpaces responsibly and in accordance with applicable property and communication rules." }]
  },
  partners: {
    title: "Partners",
    subtitle: "Discover builders, brokers, agents, dealers, and external sales partners on MatrixSpaces.",
    cta: { href: "/partner-signup", label: "Join as partner" },
    sections: [
      { title: "Builders", body: "Showcase projects, inventory, and completed work." },
      { title: "Brokers and agents", body: "Manage assigned properties, visits, and client conversations." },
      { title: "Sales teams", body: "Coordinate leads, schedules, and follow-up activity." }
    ]
  },
  "partner-signup": {
    title: "Partner Signup",
    subtitle: "Register as a builder, broker, external sales partner, or corporate account using the existing backend verification flow.",
    sections: [{ title: "Verification", body: "KYC upload and email/phone verification remain handled by Express." }]
  },
  "auth-error": {
    title: "Authentication Error",
    subtitle: "The authentication provider returned an error or the session could not be completed.",
    cta: { href: "/login", label: "Back to login" },
    sections: [{ title: "Next step", body: "Try signing in again or use the account recovery options if the issue persists." }]
  },
  "auth0/select-role": {
    title: "Select Role",
    subtitle: "Complete your Auth0 account setup by choosing the MatrixSpaces role that matches your workflow.",
    cta: { href: "/login", label: "Continue from login" },
    sections: [
      { title: "Owner", body: "List and manage commercial properties." },
      { title: "Tenant", body: "Discover spaces, schedule visits, and chat with owners or partners." },
      { title: "Partner", body: "Builders, brokers, and sales roles continue through partner verification." }
    ]
  },
  maintenance: {
    title: "Maintenance",
    subtitle: "MatrixSpaces is temporarily unavailable while platform work is in progress.",
    sections: [{ title: "Status", body: "Please try again shortly." }]
  }
  ,
  "forgot-password": {
    title: "Forgot Password",
    subtitle: "Request a password reset using the current backend email flow.",
    sections: [{ title: "Reset link", body: "Submit your email from the login page or backend form to receive a reset link." }]
  }
};

const dashboards: Record<string, { title: string; subtitle: string }> = {
  admin: {
    title: "Admin dashboard",
    subtitle: "Admin workflows remain connected to the Express backend APIs for users, KYC, properties, visits, permissions, referrals, bot content, and exports."
  },
  owner: {
    title: "Owner dashboard",
    subtitle: "Manage owned listings, broker assignments, visits, local brokers, and property workflows."
  },
  builder: {
    title: "Builder dashboard",
    subtitle: "Manage builder agents, projects, inventory, leads, KYC, and portfolio entries."
  },
  broker: {
    title: "Broker dashboard",
    subtitle: "Manage assigned properties, sales agents, visits, clients, permissions, and leads."
  },
  agent: {
    title: "Agent dashboard",
    subtitle: "Work through assigned leads, visits, chats, referrals, and property activity."
  },
  dealer: {
    title: "Dealer dashboard",
    subtitle: "Access partner workflows preserved from the legacy role routes."
  },
  "external-sales": {
    title: "External sales dashboard",
    subtitle: "Coordinate leads, visits, schedules, reassignments, and follow-up messages."
  },
  sales: {
    title: "Sales dashboard",
    subtitle: "Coordinate leads, visits, schedules, reassignments, and follow-up messages."
  },
  corporate: {
    title: "Corporate dashboard",
    subtitle: "Manage requirements, teams, shortlists, RM assignments, and visit activity."
  },
  profile: {
    title: "Profile",
    subtitle: "Manage account details, avatar, password, 2FA, referrals, and preferences."
  },
  "edit-profile": {
    title: "Edit profile",
    subtitle: "Update profile and company information through backend-compatible account actions."
  },
  wallet: {
    title: "Wallet",
    subtitle: "Review referral earnings and withdrawal activity."
  },
  vault: {
    title: "Vault",
    subtitle: "Access private document vault workflows backed by the existing upload routes."
  },
  visits: {
    title: "My visits",
    subtitle: "Review, approve, and manage scheduled property visits."
  },
  notifications: {
    title: "Notifications",
    subtitle: "Review platform and chat notifications."
  },
  "complete-profile": {
    title: "Complete profile",
    subtitle: "Finish account setup while keeping backend validation and role behavior intact."
  },
  "list-property": {
    title: "List property",
    subtitle: "Create property listings with photos and location details through the existing property APIs."
  },
  requirements: {
    title: "Requirements",
    subtitle: "Browse and post commercial requirements for the MatrixSpaces network."
  },
  compare: {
    title: "Compare properties",
    subtitle: "Compare shortlisted property details from the current session."
  },
  favorites: {
    title: "Favorites",
    subtitle: "View spaces saved to your account."
  },
  "recently-viewed": {
    title: "Recently viewed",
    subtitle: "Return to properties you explored recently."
  },
  recommended: {
    title: "Recommended for you",
    subtitle: "Review personalized suggestions from your recent activity and saved filters."
  },
  "my-visits": {
    title: "My visits",
    subtitle: "Review your scheduled property visits and approval state."
  },
  "my-chats": {
    title: "My chats",
    subtitle: "Legacy chat URL preserved; messages now live in the Next.js chat workspace."
  },
  "property-conversations": {
    title: "Property conversations",
    subtitle: "Review conversations grouped by property."
  },
  "avatar-studio": {
    title: "Avatar studio",
    subtitle: "Create and update profile imagery while preserving the existing account workflow."
  },
  "user/2fa/setup": {
    title: "Two-factor setup",
    subtitle: "Enable authenticator-based account protection using the existing backend verification flow."
  },
  "visits/approve": {
    title: "Visit approval",
    subtitle: "Approve or reject a scheduled property visit."
  }
};

export async function generateMetadata({ params }: { params: Promise<{ slug: string[] }> }): Promise<Metadata> {
  const { slug } = await params;
  const path = slug.join("/");
  return {
    title: contentRoutes[path]?.title ?? dashboards[path]?.title ?? "MatrixSpaces"
  };
}

export default async function RegistryPage({
  params,
  searchParams
}: {
  params: Promise<{ slug: string[] }>;
  searchParams: Promise<SearchParamsInput>;
}) {
  const [{ slug }, resolvedSearchParams] = await Promise.all([params, searchParams]);
  const path = slug.join("/");
  const legacyRouteRedirects: Record<string, string> = {
    "login-2fa": "/login/2fa",
    "logout-confirm": "/logout",
    "setup-2fa": "/user/2fa/setup",
    "select-role": "/auth0/select-role",
    "sale-listings": "/sale-properties"
  };

  if (slug[0] === "property-sale") redirect(slug[1] ? `/property/${slug[1]}` : "/sale-properties");
  if (legacyRouteRedirects[path]) redirect(legacyRouteRedirects[path]);

  const requireUser = async () => {
    const user = await getCurrentUser();
    if (!user) redirect(`/login?redirect=/${path}`);
    return user;
  };

  if (path === "premium-properties" || path === "sale-properties" || path === "newly-added") {
    const query = toUrlSearchParams(resolvedSearchParams);
    query.set("limit", query.get("limit") ?? "12");
    if (path === "premium-properties") query.set("verifiedOnly", "true");
    if (path === "sale-properties") query.set("listingType", "sale");
    if (path === "newly-added") query.set("verifiedOnly", "true");

    const { properties, pagination } = await getProperties(query).catch(() => ({ properties: [], pagination: undefined }));
    const title =
      path === "premium-properties" ? "Premium properties" : path === "sale-properties" ? "Properties for sale" : "Newly added properties";

    return (
      <ListingPage
        title={title}
        subtitle="Route migrated from the EJS listing templates into the shared Next.js listing architecture."
        properties={properties}
        pagination={pagination}
        searchParams={resolvedSearchParams}
      />
    );
  }

  if (path === "recommended" || path === "favorites" || path === "recently-viewed") {
    await requireUser();
    const properties = await getUserPropertyCollection(`/${path}` as "/recommended" | "/favorites" | "/recently-viewed");
    const title = path === "recommended" ? "Recommended for you" : path === "favorites" ? "Favorites" : "Recently viewed";
    return (
      <ListingPage
        title={title}
        subtitle="Migrated from the legacy EJS account listing page, now rendered in Next.js with live backend data."
        properties={properties}
        searchParams={resolvedSearchParams}
        showFilters={false}
      />
    );
  }

  if (path === "compare") {
    const properties = await getCompareProperties();
    return <CompareFeedPage properties={properties} />;
  }

  if (path === "partners") {
    const partners = await getPartners();
    return <PartnersPage partners={partners} />;
  }

  if (path === "requirements") {
    const requirements = await getRequirements();
    return <DataListPage title="Requirements" subtitle="Corporate requirements board from the existing PostgreSQL-backed workflow." items={requirements} emptyLabel="No active requirements" />;
  }

  if (path === "visits" || path === "my-visits") {
    await requireUser();
    const visits = await getVisits();
    return <DataListPage title="My visits" subtitle="Scheduled visits from the existing visits API." items={visits} emptyLabel="No visits scheduled" />;
  }

  if (path === "notifications") {
    await requireUser();
    const notifications = await getNotifications();
    return <DataListPage title="Notifications" subtitle="Unread and recent notifications from the existing notification service." items={notifications} emptyLabel="No notifications yet" />;
  }

  if (path === "wallet") {
    await requireUser();
    const wallet = await getWallet();
    return <DataListPage title="Wallet" subtitle={`Current wallet balance: ${wallet?.user?.["wallet_balance" as keyof typeof wallet.user] ?? "0"}`} items={wallet?.withdrawals ?? []} emptyLabel="No withdrawals yet" />;
  }

  if (path === "vault") {
    await requireUser();
    const vault = await getVault();
    return <DataListPage title="Vault" subtitle={`${vault?.folders.length ?? 0} folders and ${vault?.documents.length ?? 0} documents`} items={[...(vault?.folders ?? []), ...(vault?.documents ?? [])]} emptyLabel="No vault documents yet" />;
  }

  if (contentRoutes[path]) {
    return <ContentPage {...contentRoutes[path]} />;
  }

  if (path === "owner") {
    const dashboard = await getOwnerDashboard();
    if (!dashboard) redirect("/login?redirect=/owner");
    return <OwnerDashboard {...dashboard} />;
  }

  if (dashboards[path]) {
    const user = await getCurrentUser();
    if (!user) redirect(`/login?redirect=/${path}`);
    return <DashboardShell {...dashboards[path]} />;
  }

  if (slug.length === 2 && slug[0] === "visits" && slug[1] === "approve") {
    return <DashboardShell title="Visit approval" subtitle="Approve or reject a scheduled property visit through the backend visit workflow." />;
  }

  if (slug.length === 3 && slug[0] === "visits" && slug[1] === "approve") {
    await requireUser();
    return <DashboardShell title={`Visit approval #${slug[2]}`} subtitle="This migrated TSX route replaces visit-approve.ejs and keeps visit decisions connected to Express form actions." />;
  }

  if (slug.length === 1) {
    const reserved = new Set(["api", "assets", "css", "js", "images", "uploads", "fonts"]);
    if (!reserved.has(path) && !path.includes(".")) {
      const portfolio = await getPortfolio(path);
      if (portfolio) return <PortfolioPage portfolio={portfolio} />;
    }
  }

  notFound();
}
