import {
  workStatusLabel,
  billStatusLabel,
  type InvoiceDoc,
  type StatementDoc,
  type CertificateDoc,
} from "@/lib/txDocs";

const yen = (n: number) => "¥" + Number(n).toLocaleString();
const jdate = (s: string | null) => {
  if (!s) return "—";
  const [y, m, d] = s.split("-");
  if (!y || !m || !d) return s;
  return `${Number(y)}年${Number(m)}月${Number(d)}日`;
};

/** A4想定の帳票フレーム（白地・中央寄せ・印刷向け）。 */
function DocFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-(--color-brand-bg) py-6 print:bg-white print:py-0">
      <div className="mx-auto w-full max-w-[780px] bg-white p-8 text-(--color-brand-ink) shadow-sm print:max-w-none print:p-0 print:shadow-none">
        {children}
      </div>
    </div>
  );
}

function Brand() {
  return (
    <div className="mb-1 flex items-center gap-2">
      <span className="flex h-6 w-6 items-center justify-center rounded bg-(--color-brand-blue) text-[12px] font-black text-white">足</span>
      <span className="text-[12px] font-bold text-(--color-brand-sub)">足場信用プラットフォーム</span>
    </div>
  );
}

function Foot({ note }: { note: string }) {
  return <div className="mt-8 border-t border-(--color-brand-line) pt-3 text-[10.5px] leading-relaxed text-(--color-brand-faint)">{note}</div>;
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return <th className={`border border-(--color-brand-line) bg-(--color-brand-bg) px-3 py-2 text-[11.5px] font-bold ${right ? "text-right" : "text-left"}`}>{children}</th>;
}
function Td({ children, right, bold }: { children: React.ReactNode; right?: boolean; bold?: boolean }) {
  return <td className={`border border-(--color-brand-line) px-3 py-2 text-[12px] ${right ? "text-right" : "text-left"} ${bold ? "font-bold" : ""}`}>{children}</td>;
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3 py-1 text-[12px]">
      <span className="w-24 shrink-0 text-(--color-brand-sub)">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}

// ── 請求書 ──
export function InvoiceView({ doc, txId, issuedOn }: { doc: InvoiceDoc; txId: string; issuedOn: string }) {
  return (
    <DocFrame>
      <Brand />
      <div className="mb-6 flex items-end justify-between">
        <h1 className="text-[24px] font-black tracking-wide">請求書</h1>
        <div className="text-right text-[11.5px] text-(--color-brand-sub)">
          <div>発行日：{jdate(doc.issuedAt ?? issuedOn)}</div>
          <div>取引番号：{txId.slice(0, 8)}</div>
        </div>
      </div>

      <div className="mb-6 flex justify-between gap-6">
        <div className="min-w-0">
          <div className="border-b-2 border-(--color-brand-ink) pb-1 text-[16px] font-bold">{doc.recipient} 御中</div>
          <div className="mt-2 text-[12px] text-(--color-brand-sub)">下記のとおりご請求申し上げます。</div>
        </div>
        <div className="shrink-0 text-right text-[12px]">
          <div className="text-[11px] text-(--color-brand-sub)">請求元</div>
          <div className="text-[14px] font-bold">{doc.issuer}</div>
        </div>
      </div>

      <div className="mb-4 rounded-lg bg-(--color-brand-blue-soft) px-4 py-3">
        <span className="text-[12px] text-(--color-brand-sub)">ご請求金額（税込）</span>
        <span className="ml-3 text-[22px] font-black text-(--color-brand-blue)">{yen(doc.total)}</span>
        {doc.dueDate && <span className="ml-3 text-[12px] text-(--color-brand-sub)">お支払期日：{jdate(doc.dueDate)}</span>}
      </div>

      <table className="w-full border-collapse">
        <thead>
          <tr><Th>件名 / 内訳</Th><Th right>金額</Th></tr>
        </thead>
        <tbody>
          <tr><Td>{doc.projectName}</Td><Td right>—</Td></tr>
          {doc.lines.map((l, i) => (
            <tr key={i}><Td>　{l.label}</Td><Td right>{yen(l.amount)}</Td></tr>
          ))}
          <tr><Td bold>合計</Td><Td right bold>{yen(doc.total)}</Td></tr>
        </tbody>
      </table>

      {doc.bankAccount && (
        <div className="mt-4 text-[12px]">
          <span className="text-(--color-brand-sub)">お振込先：</span>
          <span className="font-semibold">{doc.bankAccount}</span>
        </div>
      )}

      <Foot note="※ 本請求書は足場信用プラットフォーム上の取引記録に基づき作成された控えです。正式な会計処理は各社の規程に従ってください。" />
    </DocFrame>
  );
}

// ── 取引明細書 ──
export function StatementView({ doc, txId }: { doc: StatementDoc; txId: string }) {
  return (
    <DocFrame>
      <Brand />
      <div className="mb-5 flex items-end justify-between">
        <h1 className="text-[22px] font-black tracking-wide">取引明細書</h1>
        <div className="text-right text-[11.5px] text-(--color-brand-sub)">
          <div>取引番号：{txId.slice(0, 8)}</div>
          <div>状態：{doc.status === "completed" ? `完了（${jdate(doc.completedAt)}）` : "進行中"}</div>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-x-6 rounded-lg border border-(--color-brand-line) p-4">
        <Field label="案件名" value={doc.projectName} />
        <Field label="種別" value={doc.jobType} />
        <Field label="元請（発注）" value={doc.prime} />
        <Field label="協力（受注）" value={doc.partner} />
        <Field label="地域" value={doc.region || "—"} />
        <Field label="現場住所" value={doc.address || "—"} />
        <Field label="工期" value={`${jdate(doc.overallStart)} 〜 ${jdate(doc.overallEnd)}`} />
        <Field label="支払条件" value={`${doc.closing}締め・${doc.payTerm}払い`} />
        <Field label="売掛保証" value={doc.guaranteed ? "適用あり" : "なし"} />
      </div>

      <div className="mb-1 text-[12.5px] font-bold">作業・請求の状況</div>
      <table className="w-full border-collapse">
        <thead>
          <tr><Th>フェーズ</Th><Th right>金額</Th><Th>予定</Th><Th>作業</Th><Th>請求/入金</Th></tr>
        </thead>
        <tbody>
          {doc.phases.map((p, i) => (
            <tr key={i}>
              <Td>{p.label}</Td>
              <Td right>{p.amount != null ? yen(p.amount) : "—"}</Td>
              <Td>{jdate(p.plannedStart)}〜{jdate(p.plannedEnd)}</Td>
              <Td>{workStatusLabel(p.workStatus)}{p.completedAt ? `（${jdate(p.completedAt)}）` : ""}</Td>
              <Td>{billStatusLabel(p.billStatus)}{p.paidAt ? `（${jdate(p.paidAt)}）` : ""}</Td>
            </tr>
          ))}
          <tr><Td bold>合計</Td><Td right bold>{yen(doc.total)}</Td><Td>—</Td><Td>—</Td><Td>—</Td></tr>
        </tbody>
      </table>

      <Foot note="※ 本明細書は足場信用プラットフォーム上の取引記録に基づく控えです。" />
    </DocFrame>
  );
}

// ── 取引完了証明書 ──
export function CertificateView({ doc, txId, issuedOn }: { doc: CertificateDoc; txId: string; issuedOn: string }) {
  return (
    <DocFrame>
      <div className="border-[3px] border-(--color-brand-blue) p-8 print:p-6">
        <Brand />
        <h1 className="mt-4 mb-6 text-center text-[26px] font-black tracking-[0.2em]">取引完了証明書</h1>

        <div className="mx-auto max-w-[560px]">
          <p className="mb-6 text-center text-[12.5px] leading-relaxed text-(--color-brand-sub)">
            下記の取引が本プラットフォーム上で正常に完了したことを証明します。
          </p>
          <div className="rounded-lg border border-(--color-brand-line) p-5">
            <Field label="案件名" value={doc.projectName} />
            <Field label="種別" value={doc.jobType} />
            <Field label="元請（発注）" value={doc.prime} />
            <Field label="協力（受注）" value={doc.partner} />
            <Field label="地域" value={doc.region || "—"} />
            <Field label="工期" value={`${jdate(doc.periodStart)} 〜 ${jdate(doc.periodEnd)}`} />
            <Field label="取引金額" value={yen(doc.total)} />
            <Field label="完了日" value={jdate(doc.completedAt)} />
            <Field label="支払状況" value={doc.onTime ? "期日内に支払い完了" : "支払い完了（遅延あり）"} />
          </div>
          <div className="mt-8 text-right text-[12px]">
            <div>{jdate(issuedOn)} 発行</div>
            <div className="mt-1 text-[13px] font-bold">足場信用プラットフォーム</div>
            <div className="text-[10.5px] text-(--color-brand-faint)">証明番号：{txId.slice(0, 8).toUpperCase()}</div>
          </div>
        </div>
      </div>
      <Foot note="※ 本証明書はプラットフォーム上の取引記録（作業完了確認・請求・入金確認）に基づき自動発行されたものです。" />
    </DocFrame>
  );
}
