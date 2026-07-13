import { redirect } from "next/navigation";
import { getAuthContext } from "@/server/auth";
import { createClient } from "@/lib/supabase/server";
import { rowToCompany, type CompanyRow } from "@/infra/supabase/mappers";
import { companyCreditLevel } from "@/domain/company";
import { Landing } from "@/components/Landing";
import { AppHome, type CompanyListItem } from "@/components/app/AppHome";

export const dynamic = "force-dynamic";

/**
 * トップ「/」：
 *  ・未ログイン → 公開ランディング（実データは出さない）
 *  ・本部管理者 → /admin
 *  ・利用会社 → 接続版アプリ（自社＋登録会社一覧の実データ）
 * プロトタイプ（デザイン参照）は /preview に退避。
 */
export default async function Home() {
  let ctx;
  try {
    ctx = await getAuthContext();
  } catch {
    // Supabase 未設定など：トップは決して500にせずランディングを表示。
    return <Landing />;
  }

  if (!ctx.user) return <Landing />;
  if (ctx.isAdmin) redirect("/admin");

  const supabase = await createClient();
  const { data: rows } = await supabase.from("companies").select("*").order("created_at", { ascending: true });
  const companies = (rows ?? []).map((r) => rowToCompany(r as unknown as CompanyRow));

  const selfCompany = companies.find((c) => c.id === ctx!.companyId) ?? null;
  const self = selfCompany
    ? {
        name: selfCompany.name,
        region: selfCompany.region,
        level: companyCreditLevel(selfCompany, false),
        status: selfCompany.status ?? "active",
        completed: selfCompany.metrics.completed,
        onTimeCount: selfCompany.metrics.onTimeCount,
        lateCount: selfCompany.metrics.lateCount,
      }
    : null;

  const list: CompanyListItem[] = companies.map((c) => ({
    id: c.id,
    name: c.name,
    region: c.region,
    level: companyCreditLevel(c, false),
    status: c.status ?? "active",
    completed: c.metrics.completed,
    isSelf: c.id === ctx!.companyId,
  }));

  return <AppHome email={ctx.user.email ?? ""} self={self} companies={list} />;
}
