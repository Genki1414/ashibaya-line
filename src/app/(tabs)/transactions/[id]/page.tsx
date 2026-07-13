import Link from "next/link";
import { notFound } from "next/navigation";
import { Header } from "@/components/Header";
import { CompanySwitch } from "@/components/tx/CompanySwitch";
import { TxWorkspace } from "@/components/tx/TxWorkspace";
import { getContainer } from "@/server/container";
import { availableActions, category, hasOpenIssue, nextHint } from "@/domain/transaction";
import type { Actor } from "@/domain/transaction";
import { companyCreditLevel } from "@/domain/company";

export const dynamic = "force-dynamic";

const CATEGORY_LABEL: Record<string, string> = {
  active: "取引中",
  billing: "請求・入金対応中",
  rework: "是正・手直し中",
  issue: "確認事項あり",
  completed: "取引完了",
};

export default async function TransactionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const container = await getContainer();
  const tx = await container.loadTransaction(id);
  if (!tx) notFound();

  const acting = container.actingCompanyId;
  if (tx.primeId !== acting && tx.partnerId !== acting) {
    // 関係者限定（本番は RLS が担保）。擬似ログインが当事者でない場合の導線。
    return (
      <>
        <Header title="取引詳細" />
        <div className="p-4">
          <div className="rounded-2xl border border-(--color-brand-line) bg-white p-4 text-sm text-(--color-brand-sub)">
            この取引は関係者（元請・協力会社）のみ閲覧できます。擬似ログインを {tx.primeId as string} か {tx.partnerId as string} に切り替えてください。
          </div>
          <Link href="/transactions" className="mt-3 inline-block text-[13px] font-bold text-(--color-brand-blue)">← 取引一覧へ</Link>
        </div>
      </>
    );
  }

  const role: Actor = tx.primeId === acting ? "prime" : "partner";
  const [primeCompany, partnerCompany, companies] = await Promise.all([
    container.loadCompany(tx.primeId as string),
    container.loadCompany(tx.partnerId as string),
    container.listCompanies(),
  ]);

  const openIssue = hasOpenIssue(tx);
  const brief = (id2: string, name: string | undefined, verifyMetrics: Parameters<typeof companyCreditLevel>[0] | null) => ({
    id: id2,
    name: name ?? id2,
    level: verifyMetrics ? companyCreditLevel(verifyMetrics, openIssue) : "unverified",
  });

  const options = companies
    .filter((c) => ["A", "B", "D"].includes(c.id))
    .map((c) => ({ id: c.id as string, name: c.name.replace("株式会社", "").slice(0, 6) }));

  return (
    <>
      <Header title={tx.projectName} />
      <CompanySwitch options={options} current={acting as string} />
      <div className="px-4 pt-3">
        <Link href="/transactions" className="text-[12.5px] font-bold text-(--color-brand-blue)">← 取引一覧</Link>
      </div>
      <TxWorkspace
        tx={tx}
        role={role}
        actions={availableActions(tx, role)}
        prime={brief(tx.primeId as string, primeCompany?.name, primeCompany)}
        partner={brief(tx.partnerId as string, partnerCompany?.name, partnerCompany)}
        statusLabel={CATEGORY_LABEL[category(tx)]}
        nextHint={nextHint(tx)}
      />
    </>
  );
}
