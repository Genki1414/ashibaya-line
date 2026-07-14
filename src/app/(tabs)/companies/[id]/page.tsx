import { notFound } from "next/navigation";
import { AppShell } from "@/components/app/AppShell";
import { CompanyProfileView } from "@/components/company/CompanyProfileView";
import { PerformanceSections } from "@/components/company/PerformancePanel";
import { loadCompanyProfile } from "@/server/companyData";
import { loadCompanyPerformance } from "@/server/performanceData";

export const dynamic = "force-dynamic";
export const metadata = { title: "会社詳細" };

export default async function CompanyDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const { id } = await params;
  const { from } = await searchParams;
  const [data, perf] = await Promise.all([loadCompanyProfile(id), loadCompanyPerformance(id)]);
  if (!data) notFound();

  const back = from && from.startsWith("/") ? from : "/home";
  return (
    <AppShell title="会社詳細" back={back}>
      <CompanyProfileView profile={data.profile} selfBadge={data.isSelf} />
      <PerformanceSections asPrime={perf.asPrime} asPartner={perf.asPartner} />
    </AppShell>
  );
}
