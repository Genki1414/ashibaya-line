import Link from "next/link";
import { Header } from "@/components/Header";
import { CompanySwitch } from "@/components/tx/CompanySwitch";
import { getContainer } from "@/server/container";
import { category, nextHint, pendingActionsFor } from "@/domain/transaction";
import type { Actor } from "@/domain/transaction";

export const dynamic = "force-dynamic";

const CATEGORY_META: Record<string, { label: string; color: string; bg: string }> = {
  active: { label: "取引中", color: "var(--color-brand-blue)", bg: "var(--color-brand-blue-light)" },
  billing: { label: "請求・入金対応中", color: "var(--color-brand-amber)", bg: "var(--color-brand-amber-soft)" },
  rework: { label: "是正・手直し中", color: "var(--color-brand-amber)", bg: "var(--color-brand-amber-soft)" },
  issue: { label: "確認事項あり", color: "var(--color-brand-red)", bg: "var(--color-brand-red-soft)" },
  completed: { label: "取引完了", color: "var(--color-brand-green)", bg: "var(--color-brand-green-soft)" },
};

export default async function TransactionsPage() {
  const container = await getContainer();
  const [txs, companies] = await Promise.all([container.listTransactionsForActing(), container.listCompanies()]);
  const acting = container.actingCompanyId;
  const options = companies
    .filter((c) => ["A", "B", "D"].includes(c.id))
    .map((c) => ({ id: c.id as string, name: c.name.replace("株式会社", "").slice(0, 6) }));

  return (
    <>
      <Header title="取引" />
      {container.mode === "demo" && <CompanySwitch options={options} current={acting as string} />}
      <div className="space-y-3 p-4">
        {txs.length === 0 && (
          <div className="rounded-2xl border border-(--color-brand-line) bg-white p-4 text-sm text-(--color-brand-sub)">
            この会社が関係する取引はありません。擬似ログインを切り替えてお試しください。
          </div>
        )}
        {txs.map((tx) => {
          const role: Actor = tx.primeId === acting ? "prime" : "partner";
          const meta = CATEGORY_META[category(tx)];
          const pendingCount = pendingActionsFor(tx, role).length;
          return (
            <Link
              key={tx.id}
              href={`/transactions/${tx.id}`}
              className="block rounded-2xl border border-(--color-brand-line) bg-white p-4"
            >
              <div className="mb-1 flex items-center gap-2">
                <span className="rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ color: meta.color, background: meta.bg }}>
                  {meta.label}
                </span>
                <span className="text-[11px] font-semibold text-(--color-brand-sub)">{role === "prime" ? "元請" : "協力"}</span>
                {pendingCount > 0 && (
                  <span className="ml-auto rounded-full bg-(--color-brand-amber) px-2 py-0.5 text-[11px] font-bold text-white">要対応 {pendingCount}</span>
                )}
              </div>
              <div className="text-[14.5px] font-bold text-(--color-brand-ink)">{tx.projectName}</div>
              <div className="mt-1 text-[12px] text-(--color-brand-sub)">{nextHint(tx)}</div>
            </Link>
          );
        })}
      </div>
    </>
  );
}
