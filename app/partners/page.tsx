import type { Metadata } from "next";
import { PartnersPage } from "@/components/pages/PartnersPage";
import { getPartners } from "@/services/api";

export const metadata: Metadata = {
  title: "MatrixSpaces Partners",
  description: "Discover builders, brokers, dealers, agents, and sales partners with active commercial real-estate portfolios.",
  alternates: {
    canonical: "/partners"
  }
};

export default async function PartnersRoutePage() {
  const partners = await getPartners();
  return <PartnersPage partners={partners} />;
}
