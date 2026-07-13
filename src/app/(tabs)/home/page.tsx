import Link from "next/link";
import { AppShell } from "@/components/app/AppShell";
import { SectionLabel } from "@/components/company/parts";
import { RegisteredCompanies } from "@/components/company/RegisteredCompanies";
import { Notifications } from "@/components/app/Notifications";
import { loadCompanyPageData } from "@/server/companyData";

export const dynamic = "force-dynamic";
export const metadata = { title: "ホーム" };

export default async function HomeTab() {
  const { self, companies } = await loadCompanyPageData();
  const approved = self?.status === "active";

  return (
    <AppShell title="ホーム">
      <div className="mb-4 rounded-2xl bg-gradient-to-br from-(--color-brand-blue) to-(--color-brand-blue-dark) p-4 text-white">
        <div className="text-[13px] font-bold">事実で信用を積むプラットフォーム</div>
        <div className="mt-1 text-[12.5px] leading-relaxed opacity-95">
          組立・解体・是正・支払い・入金の記録が、そのまま会社の信用になります。募集はLINE、正式な取引と記録はここで。
        </div>
      </div>

      {self && !approved && (
        <div className="mb-4 rounded-2xl border border-(--color-brand-amber) bg-(--color-brand-amber-soft) p-3.5">
          <div className="text-[13px] font-bold text-(--color-brand-ink)">本部の承認待ちです</div>
          <div className="mt-1 text-[12px] text-(--color-brand-sub)">
            会社プロフィール・認証書類の準備は今すぐ行えます（<Link href="/me" className="font-bold text-(--color-brand-blue)">自社</Link>）。案件の発注・受注は承認後に解禁されます。
          </div>
        </div>
      )}

      {self && <Notifications />}

      {self && approved && (
        <div className="mb-4 grid grid-cols-2 gap-2">
          <Link href="/projects" className="rounded-2xl border border-(--color-brand-line) bg-white p-4 text-center">
            <div className="text-[22px]">▤</div>
            <div className="text-[12.5px] font-bold text-(--color-brand-ink)">案件を見る</div>
          </Link>
          <Link href="/transactions" className="rounded-2xl border border-(--color-brand-line) bg-white p-4 text-center">
            <div className="text-[22px]">⇄</div>
            <div className="text-[12.5px] font-bold text-(--color-brand-ink)">取引を見る</div>
          </Link>
        </div>
      )}

      <SectionLabel text={`登録会社一覧（${companies.length}）`} />
      <RegisteredCompanies companies={companies} />
    </AppShell>
  );
}
