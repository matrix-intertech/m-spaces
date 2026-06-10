import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getPortfolio } from "@/services/api";
import { PortfolioPage } from "@/components/pages/PortfolioPage";

export async function generateMetadata({ params }: { params: Promise<{ username: string }> }): Promise<Metadata> {
  const { username } = await params;
  const portfolio = await getPortfolio(username);
  return { title: portfolio?.agent.name || portfolio?.agent.username || "Portfolio" };
}

export default async function LegacyPortfolioRoute({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const portfolio = await getPortfolio(username);
  if (!portfolio) notFound();
  redirect(`/${portfolio.agent.username || username}`);
}
