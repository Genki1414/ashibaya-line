import Link from "next/link";
import { AppShell } from "@/components/app/AppShell";
import { listMyTransactions, type TxCardView } from "@/server/txData";

export const dynamic = "force-dynamic";
export const metadata = { title: "取引" };

const yen = (n: number) => "¥" + Number(n).toLocaleString();

function RolePill({ label }: { label: string }) {
  const isPrime = label === "元請";
  return (
    <span className="rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ color: isPrime ? "#1657C9" : "#159B67", background: isPrime ? "#E8F0FE" : "#E4F6EE" }}>
      {label}
    </span>
  );
}

function TxCard({ t }: { t: TxCardView }) {
  return (
    <Link href={`/transactions/${t.id}`} className="mb-3 block rounded-2xl border border-(--color-brand-line) bg-white p-3.5">
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <RolePill label={t.roleLabel} />
        <span
          className="rounded-full px-2 py-0.5 text-[11px] font-bold"
          style={{ color: t.completed ? "#5B6473" : "#C77700", background: t.completed ? "#EEF1F5" : "#FCF2DF" }}
        >
          {t.status}
        </span>
        {t.pending > 0 && (
          <span className="rounded-full bg-(--color-brand-amber) px-2 py-0.5 text-[11px] font-bold text-white">要対応 {t.pending}</span>
        )}
      </div>
      <div className="text-[15.5px] font-bold text-(--color-brand-ink)">{t.projectName}</div>
      <div className="mt-1.5 flex flex-wrap gap-x-3.5 gap-y-1 text-[12.5px] text-(--color-brand-sub)">
        <span>📍 {t.region || "未設定"}</span>
        <span>相手 {t.counterpartyName}</span>
      </div>
      <div className="mt-2.5 flex items-center justify-between border-t border-(--color-brand-line) pt-2.5">
        <span className="text-[18px] font-black text-(--color-brand-blue)">{yen(t.amount)}</span>
        <span className="text-[13px] font-bold text-(--color-brand-blue)">開く ›</span>
      </div>
    </Link>
  );
}

export default async function TransactionsTab() {
  const txs = await listMyTransactions();
  const active = txs.filter((t) => !t.completed);
  const done = txs.filter((t) => t.completed);

  return (
    <AppShell title="取引">
      {txs.length === 0 ? (
        <div className="rounded-2xl border border-(--color-brand-line) bg-white p-6 text-center text-[13px] leading-relaxed text-(--color-brand-sub)">
          取引はまだありません。案件の応募・選定が成立すると、ここに取引が作成されます。
        </div>
      ) : (
        <>
          {active.map((t) => <TxCard key={t.id} t={t} />)}
          {done.length > 0 && (
            <>
              <div className="mt-4 mb-2 text-[12px] font-bold text-(--color-brand-faint)">完了した取引</div>
              {done.map((t) => <TxCard key={t.id} t={t} />)}
            </>
          )}
        </>
      )}
    </AppShell>
  );
}
