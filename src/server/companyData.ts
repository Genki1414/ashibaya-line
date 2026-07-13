import { getAuthContext } from "./auth";
import { createClient } from "../lib/supabase/server";
import { rowToCompany, type CompanyRow } from "../infra/supabase/mappers";
import { companyCreditLevel, companyFactsOf, type Company } from "../domain/company";
import { continuousCount } from "../domain/credit";
import type { SelfProfile } from "../components/app/SelfProfile";
import type { CompanyCard } from "../components/company/RegisteredCompanies";
import type { MetricsView } from "../components/company/parts";

export interface CompanyPageData {
  email: string;
  companyId: string | null;
  self: SelfProfile | null;
  companies: CompanyCard[];
}

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

/** 会社向け画面（ホーム/自社/会社一覧）で共通に使う実データ読み込み。 */
export async function loadCompanyPageData(): Promise<CompanyPageData> {
  const ctx = await getAuthContext();
  const supabase = await createClient();
  const { data: rows } = await supabase.from("companies").select("*").order("created_at", { ascending: true });
  const companies = (rows ?? []).map((r) => rowToCompany(r as unknown as CompanyRow));
  const today = new Date().toISOString().slice(0, 10);

  const selfCompany = companies.find((c) => c.id === ctx.companyId) ?? null;
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
    isSelf: c.id === ctx.companyId,
  }));

  return { email: ctx.user?.email ?? "", companyId: ctx.companyId, self, companies: list };
}
