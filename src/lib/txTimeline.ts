import type { StoredEvent } from "@/application";

export interface TimelineEntry {
  readonly type: string;
  readonly label: string;
  readonly detail: string | null;
  /** 節目（取引開始・完了確認・入金確認）は強調。completed は信用反映として緑で表示。 */
  readonly kind: "normal" | "milestone" | "credit";
  readonly occurredAt: string;
}

const PHASE_JP: Record<string, string> = { assembly: "組立", dismantle: "解体" };
const yen = (n: unknown) => (typeof n === "number" ? "¥" + n.toLocaleString() : null);

function phaseOf(p: Record<string, unknown>): string {
  const key = typeof p.phase === "string" ? p.phase : "";
  return PHASE_JP[key] ?? "";
}

/** ドメインイベント1件を、信用タイムラインの表示用エントリに変換する純粋関数。 */
export function describeEvent(event: StoredEvent): TimelineEntry {
  const p = (event.payload ?? {}) as Record<string, unknown>;
  const ph = phaseOf(p);
  const base = { type: event.type, occurredAt: event.occurredAt };

  switch (event.type) {
    case "TransactionStarted":
      return { ...base, label: "取引を開始（受注側が受諾）", detail: null, kind: "milestone" };
    case "OrderIssued":
      return { ...base, label: "注文書を発行", detail: null, kind: "normal" };
    case "OrderAcknowledged":
      return { ...base, label: "注文請書を発行", detail: null, kind: "normal" };
    case "WorkStarted":
      return { ...base, label: `${ph}作業を開始`, detail: null, kind: "normal" };
    case "WorkDailySessionRecorded":
      return { ...base, label: `${ph}作業の日次記録`, detail: null, kind: "normal" };
    case "WorkCompletionReported":
      return { ...base, label: `${ph}完了を報告`, detail: typeof p.days === "number" ? `のべ${p.days}日` : null, kind: "normal" };
    case "WorkConfirmed":
      return { ...base, label: `${ph}完了を確認`, detail: null, kind: "milestone" };
    case "ReworkRequested":
      return { ...base, label: `${ph}是正・手直しを依頼`, detail: typeof p.text === "string" ? p.text : null, kind: "normal" };
    case "ReworkCompleted":
      return { ...base, label: `${ph}是正・手直しが完了`, detail: null, kind: "normal" };
    case "InvoiceSubmitted":
      return { ...base, label: `${ph}請求書を提出`, detail: yen(p.amount), kind: "normal" };
    case "InvoiceChecked":
      return { ...base, label: `${ph}請求書を確認`, detail: null, kind: "normal" };
    case "PaymentRegistered":
      return { ...base, label: `${ph}支払いを登録`, detail: yen(p.amount), kind: "normal" };
    case "DepositConfirmed":
      return { ...base, label: `${ph}入金を確認`, detail: yen(p.amount), kind: "milestone" };
    case "DepositDiscrepancyRaised":
      return { ...base, label: `${ph}入金差額を確認事項に登録`, detail: null, kind: "normal" };
    case "IssueRaised":
      return { ...base, label: "確認事項を登録", detail: typeof p.text === "string" ? p.text : null, kind: "normal" };
    case "IssueResolved":
      return { ...base, label: "確認事項を解決", detail: null, kind: "normal" };
    case "ConsultationRequested":
      return { ...base, label: "運営へ相談", detail: typeof p.text === "string" ? p.text : null, kind: "normal" };
    case "ScheduleChanged":
      return { ...base, label: "工期・予定を変更", detail: null, kind: "normal" };
    case "ScheduleAcknowledged":
      return { ...base, label: "工期・予定変更を確認", detail: null, kind: "normal" };
    case "AshiBaseLinked":
      return { ...base, label: "AshiBaseへ連携", detail: null, kind: "normal" };
    case "TransactionCompleted": {
      const onTime = p.onTime === true;
      const avg = typeof p.avgPayDays === "number" ? p.avgPayDays : null;
      const detail = `${onTime ? "期日内支払い" : "支払い遅延あり"}${avg != null ? ` / 平均支払 ${avg}日` : ""} → 信用実績へ反映`;
      return { ...base, label: "取引が完了", detail, kind: "credit" };
    }
    default:
      return { ...base, label: event.type, detail: null, kind: "normal" };
  }
}

export function buildTimeline(events: readonly StoredEvent[]): TimelineEntry[] {
  return events.map(describeEvent);
}
