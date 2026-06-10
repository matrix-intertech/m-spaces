import type { Metadata } from "next";
import { PartnersPage } from "@/components/pages/PartnersPage";
import { getPartners } from "@/services/api";

export const metadata: Metadata = {
  title: "Partners"
};

export default async function PartnersRoutePage() {
  const partners = await getPartners();
  return <PartnersPage partners={partners} />;
}
