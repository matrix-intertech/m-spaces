import { PortfolioShowcase } from "@/components/pages/PortfolioShowcase";
import type { Property, User } from "@/types";

export interface PortfolioPayload {
  agent: User & {
    about?: string | null;
    cover_url?: string | null;
    company_website?: string | null;
    rera_number?: string | null;
    parent_username?: string | null;
    parent_name?: string | null;
    parent_role?: string | null;
    parent_agency_name?: string | null;
    facebook?: string | null;
    linkedin?: string | null;
    instagram?: string | null;
    google_business_link?: string | null;
  };
  properties: Property[];
  projects?: Array<Record<string, unknown>>;
  builderPortfolio?: Array<Record<string, unknown>>;
}

export function PortfolioPage({ portfolio }: { portfolio: PortfolioPayload }) {
  return <PortfolioShowcase portfolio={portfolio} />;
}
