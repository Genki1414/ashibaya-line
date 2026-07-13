import { redirect } from "next/navigation";
import { getAuthContext } from "@/server/auth";
import { createClient } from "@/lib/supabase/server";
import { rowToCompany, type CompanyRow } from "@/infra/supabase/mappers";
import { companyCreditLevel, companyFactsOf, type Company } from "@/domain/company";
import { continuousCount } from "@/domain/credit";
import { Landing } from "@/components/Landing";
import { AppHome, type SelfProfile } from "@/components/app/AppHome";
import type { CompanyCard } from "@/components/company/RegisteredCompanies";
import type { MetricsView } from "@/components/company/parts";

export const dynamic = "force-dynamic";

function metricsView(c: Company): MetricsView {
  return {
    completed: c.metrics.completed,
    paidCount: c.metrics.paidCount,
    onTimeCount: c.metrics.onTimeCount,
    lateCount: c.metrics.lateCount,
    avgPayDays: c.metrics.avgPayDays,
    lastTrade: c.metrics.lastTrade,
    continuous: continuousCount(c.metrics),
  };
}

/**
 * トップ「/」：未ログイン→公開ランディング／本部管理者→/admin／利用会社→接続版ホーム（実データ）。
 * プロトタイプ（デザイン参照）は /preview。設定不備でも 500 にせずランディングにフォールバック。
 */
export default async function Home() {
  let ctx;
  try {
    ctx = await getAuthContext();
  } catch {
    return <Landing />;
  }

  if (!ctx.user) return <Landing />;
  if (ctx.isAdmin) redirect("/admin");

  const supabase = await createClient();
  const { data: rows } = await supabase.from("companies").select("*").order("created_at", { ascending: true });
  const companies = (rows ?? []).map((r) => rowToCompany(r as unknown as CompanyRow));
  const today = new Date().toISOString().slice(0, 10);

  const selfCompany = companies.find((c) => c.id === ctx!.companyId) ?? null;
  const self: SelfProfile | null = selfCompany
    ? {
        name: selfCompany.name,
        region: selfCompany.region,
        areas: selfCompany.areas.join("・"),
        works: selfCompany.works.join("・"),
        contact: selfCompany.contact,
        registeredAt: selfCompany.registeredAt,
        level: companyCreditLevel(selfCompany, false),
        status: selfCompany.status ?? "active",
        verify: selfCompany.verify as Record<string, string>,
        metrics: metricsView(selfCompany),
        facts: (() => {
          const f = companyFactsOf(selfCompany, false, today);
          return { concerns: [...f.concerns], positives: [...f.positives] };
        })(),
      }
    : null;

  const list: CompanyCard[] = companies.map((c) => ({
    id: c.id,
    name: c.name,
    region: c.region,
    works: c.works.join("・"),
    level: companyCreditLevel(c, false),
    completed: c.metrics.completed,
    onTimeCount: c.metrics.onTimeCount,
    lateCount: c.metrics.lateCount,
    continuous: continuousCount(c.metrics),
    verify: c.verify as Record<string, string>,
    isSelf: c.id === ctx!.companyId,
  }));

  return <AppHome email={ctx.user.email ?? ""} self={self} companies={list} />;
}
