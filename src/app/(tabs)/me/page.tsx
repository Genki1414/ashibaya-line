import { AppShell } from "@/components/app/AppShell";
import { SelfProfileView } from "@/components/app/SelfProfile";
import { Card } from "@/components/company/parts";
import { PerformanceSections } from "@/components/company/PerformancePanel";
import { loadCompanyPageData } from "@/server/companyData";
import { loadCompanyPerformance } from "@/server/performanceData";

export const dynamic = "force-dynamic";
export const metadata = { title: "自社プロフィール" };

export default async function MeTab() {
  const { self, email, companyId } = await loadCompanyPageData();
  const perf = companyId ? await loadCompanyPerformance(companyId) : null;
  return (
    <AppShell title="自社プロフィール">
      {self ? (
        <>
          <SelfProfileView self={self} />
          {perf && <PerformanceSections asPrime={perf.asPrime} asPartner={perf.asPartner} />}
        </>
      ) : (
        <Card>
          <div className="text-[13px] text-(--color-brand-red)">会社に所属していません（{email}）。</div>
        </Card>
      )}
    </AppShell>
  );
}
