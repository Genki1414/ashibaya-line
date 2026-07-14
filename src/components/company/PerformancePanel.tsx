import { Card } from "./parts";
import { rateText, type PartnerPerformance, type PrimePerformance } from "@/domain/performance";

/** 事実の1行（ラベル＋数値）。率は母数併記の文字列をそのまま渡す。 */
function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-(--color-brand-line) py-1.5 last:border-0">
      <span className="text-[12.5px] text-(--color-brand-sub)">{label}</span>
      <span className={`text-[13px] font-bold ${muted ? "text-(--color-brand-faint)" : "text-(--color-brand-ink)"}`}>{value}</span>
    </div>
  );
}

const days = (n: number | null, base: number) => (n != null ? `${n}日（${base}件）` : "—（0件）");

/** 元請（発注側）としての客観実績。信用点数への変換はしない。率は母数併記。 */
export function PrimePerformanceCard({ p }: { p: PrimePerformance }) {
  return (
    <Card>
      <div className="mb-1.5 text-[13px] font-bold text-(--color-brand-blue)">元請としての実績</div>
      <Row label="取引完了" value={`${p.completed}件`} />
      <Row label="支払い完了" value={`${p.paid}件`} />
      <Row label="期日内支払い率" value={rateText(p.paidOnTime, p.paidOnTime + p.paidLate)} />
      <Row label="支払い遅延" value={`${p.paidLate}件`} />
      <Row label="平均支払日数" value={days(p.avgPayDays, p.avgPayDaysBase)} />
      <Row label="未入金" value={`${p.unpaid}件`} />
      <Row label="未解決の確認事項" value={`${p.openIssues}件`} />
      <Row label="継続取引会社" value={`${p.repeatPartners}社`} />
      <Row label="取引中止" value={`${p.cancelled}件`} muted />
    </Card>
  );
}

/** 協力会社（受注側）としての客観実績。 */
export function PartnerPerformanceCard({ p }: { p: PartnerPerformance }) {
  return (
    <Card>
      <div className="mb-1.5 text-[13px] font-bold text-(--color-brand-green)">協力会社としての実績</div>
      <Row label="取引完了" value={`${p.completed}件`} />
      <Row label="作業完了確認" value={`${p.workConfirmed}件`} />
      <Row label="完了予定日遵守率" value={rateText(p.onSchedule, p.scheduleBase)} />
      <Row label="完了予定日超過" value={`${p.overSchedule}件`} />
      <Row label="是正発生" value={`${p.reworkRaised}件`} />
      <Row label="是正解決" value={`${p.reworkResolved}件`} />
      <Row label="未解決是正" value={`${p.reworkOpen}件`} />
      <Row label="継続取引会社" value={`${p.repeatPrimes}社`} />
      <Row label="取引中止" value={`${p.cancelled}件`} muted />
    </Card>
  );
}

/** プロフィール向け：元請/協力の実績を分けて表示。事実の数値のみ（信用スコアには変換しない）。 */
export function PerformanceSections({ asPrime, asPartner }: { asPrime: PrimePerformance; asPartner: PartnerPerformance }) {
  return (
    <div>
      <div className="mb-2 mt-1 text-[12px] font-bold text-(--color-brand-faint)">実績データ（取引履歴から自動集計・編集不可）</div>
      <PrimePerformanceCard p={asPrime} />
      <PartnerPerformanceCard p={asPartner} />
      <p className="mt-1 px-1 text-[10.5px] leading-relaxed text-(--color-brand-faint)">
        ※ 主観評価は含まず、取引の事実のみを集計しています。率は母数（件数）を併記しています。
        <br />
        ※「取引中止」は集計基盤のみ用意した未実装機能のため、現状はすべて0件です。
      </p>
    </div>
  );
}
