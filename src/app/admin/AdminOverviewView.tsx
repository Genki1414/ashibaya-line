import type { AdminOverview } from "@/server/adminData";

const yen = (n: number) => "¥" + Number(n).toLocaleString();
const dt = (s: string | null) => {
  if (!s) return "—";
  const d = s.slice(0, 16).replace("T", " ");
  return d;
};

const TX_STATUS_JP: Record<string, string> = {
  active: "進行中",
  billing: "請求中",
  rework: "是正中",
  issue: "確認中",
  completed: "完了",
};

const AUDIT_JP: Record<string, string> = {
  add: "追加",
  delete: "削除",
  replace: "差し替え",
  visibility_change: "公開範囲変更",
  description_change: "説明変更",
  type_change: "種別変更",
  reorder: "並び替え",
  url_issued: "URL発行",
};

function Kpi({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div className="rounded-xl border border-(--color-brand-line) bg-white p-3">
      <div className="text-[11px] font-bold text-(--color-brand-faint)">{label}</div>
      <div className="mt-0.5 text-[20px] font-black text-(--color-brand-ink)">{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-(--color-brand-sub)">{sub}</div>}
    </div>
  );
}

function Details({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <details className="mt-3 overflow-hidden rounded-xl border border-(--color-brand-line) bg-white">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3.5 py-3">
        <span className="text-[13px] font-bold text-(--color-brand-ink)">{title}</span>
        <span className="rounded-full bg-(--color-brand-blue-light) px-2 py-0.5 text-[11px] font-bold text-(--color-brand-blue)">{count}</span>
        <span className="ml-auto text-(--color-brand-faint)">▾</span>
      </summary>
      <div className="border-t border-(--color-brand-line) p-3">{children}</div>
    </details>
  );
}

export function AdminOverviewView({ overview }: { overview: AdminOverview }) {
  const { kpis, transactions, audit, perf, error } = overview;

  return (
    <section className="mt-6">
      <h2 className="mb-2 text-[13px] font-bold text-(--color-brand-sub)">横断ダッシュボード</h2>

      {error && (
        <div className="mb-3 rounded-xl border border-(--color-brand-amber) bg-(--color-brand-amber-soft) p-3 text-[12px] text-(--color-brand-sub)">
          横断データの取得に一部失敗しました：{error}
        </div>
      )}

      <div className="grid grid-cols-3 gap-2">
        <Kpi label="会社" value={kpis.companies.total} sub={`承認 ${kpis.companies.active} / 待ち ${kpis.companies.pending} / 停止 ${kpis.companies.suspended}`} />
        <Kpi label="案件" value={kpis.projects.total} sub={`募集 ${kpis.projects.recruiting} / 停止 ${kpis.projects.paused} / 選定 ${kpis.projects.matched} / 終了 ${kpis.projects.closed}`} />
        <Kpi label="取引" value={kpis.transactions.total} sub={`進行 ${kpis.transactions.inProgress} / 完了 ${kpis.transactions.completed}`} />
      </div>
      <div className="mt-2">
        <Kpi label="取引総額（記録ベース）" value={yen(kpis.transactions.grossAmount)} />
      </div>

      {/* 取引の横断一覧 */}
      <Details title="取引の横断一覧" count={transactions.length}>
        {transactions.length === 0 ? (
          <div className="text-[12px] text-(--color-brand-sub)">取引はまだありません。</div>
        ) : (
          <div className="space-y-1.5">
            {transactions.map((t) => (
              <div key={t.id} className="flex items-center gap-2 rounded-lg bg-(--color-brand-bg) px-3 py-2 text-[12px]">
                <span className="rounded-full bg-white px-1.5 py-0.5 text-[10.5px] font-bold text-(--color-brand-blue)">{TX_STATUS_JP[t.status] ?? t.status}</span>
                <span className="min-w-0 flex-1 truncate font-semibold text-(--color-brand-ink)">{t.projectName}</span>
                <span className="hidden shrink-0 text-(--color-brand-sub) sm:inline">{t.primeName} → {t.partnerName}</span>
                <span className="shrink-0 font-bold text-(--color-brand-ink)">{yen(t.amount)}</span>
              </div>
            ))}
          </div>
        )}
      </Details>

      {/* 資料の監査履歴 */}
      <Details title="資料の監査履歴（最新50件）" count={audit.length}>
        {audit.length === 0 ? (
          <div className="text-[12px] text-(--color-brand-sub)">資料の操作履歴はまだありません。</div>
        ) : (
          <div className="space-y-1.5">
            {audit.map((a) => (
              <div key={a.id} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 rounded-lg bg-(--color-brand-bg) px-3 py-2 text-[12px]">
                <span className="rounded-full bg-white px-1.5 py-0.5 text-[10.5px] font-bold text-(--color-brand-ink)">{AUDIT_JP[a.action] ?? a.action}</span>
                <span className="font-semibold text-(--color-brand-ink)">{a.projectName}</span>
                {a.fileName && <span className="text-(--color-brand-sub)">／ {a.fileName}</span>}
                <span className="text-(--color-brand-sub)">by {a.actorName}</span>
                <span className="ml-auto text-[11px] text-(--color-brand-faint)">{dt(a.createdAt)}</span>
              </div>
            ))}
          </div>
        )}
      </Details>

      {/* 実績再計算の状況（会社別の最終計算時刻・イベント数） */}
      <Details title="実績データの再計算状況" count={perf.length}>
        {perf.length === 0 ? (
          <div className="text-[12px] text-(--color-brand-sub)">実績プロジェクションはまだありません。「実績を再計算」を実行すると生成されます。</div>
        ) : (
          <div className="space-y-1.5">
            {perf.map((p) => (
              <div key={p.companyId} className="flex items-center gap-2 rounded-lg bg-(--color-brand-bg) px-3 py-2 text-[12px]">
                <span className="min-w-0 flex-1 truncate font-semibold text-(--color-brand-ink)">{p.companyName}</span>
                <span className="shrink-0 text-(--color-brand-sub)">イベント {p.eventCount}</span>
                <span className="shrink-0 text-[11px] text-(--color-brand-faint)">最終計算 {dt(p.computedAt)}</span>
              </div>
            ))}
          </div>
        )}
      </Details>
    </section>
  );
}
