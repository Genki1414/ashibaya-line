import { createClient } from "../lib/supabase/server";
import {
  emptyPrimePerformance,
  emptyPartnerPerformance,
  type PrimePerformance,
  type PartnerPerformance,
} from "../domain/performance";

export interface CompanyPerformanceView {
  readonly asPrime: PrimePerformance;
  readonly asPartner: PartnerPerformance;
  readonly computedAt: string | null;
}

/**
 * 会社1社の実績プロジェクションを読み込む（表示用）。company_performance は
 * 認証ユーザーが SELECT 可（RLS）。未計算・未登録の会社は空実績を返す。
 */
export async function loadCompanyPerformance(companyId: string): Promise<CompanyPerformanceView> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("company_performance")
    .select("as_prime, as_partner, computed_at")
    .eq("company_id", companyId)
    .maybeSingle();

  if (!data) {
    return { asPrime: emptyPrimePerformance(), asPartner: emptyPartnerPerformance(), computedAt: null };
  }
  const row = data as { as_prime: unknown; as_partner: unknown; computed_at: string | null };
  return {
    asPrime: { ...emptyPrimePerformance(), ...(row.as_prime as object) } as PrimePerformance,
    asPartner: { ...emptyPartnerPerformance(), ...(row.as_partner as object) } as PartnerPerformance,
    computedAt: row.computed_at ?? null,
  };
}
