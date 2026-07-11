import { daysBetween } from "../shared";
import { Actor, Phase, PhaseKey, PHASE_KEYS, PayType, Transaction } from "./types";

export function hasOpenIssue(tx: Transaction): boolean {
  return tx.issues.some((issue) => !issue.resolved);
}

/** 解体の「作業」は組立の作業が confirmed であることだけを条件に開始できる（仕様書5章、最重要ルール）。 */
export function dismantleLocked(tx: Transaction): boolean {
  return tx.phases.assembly.work.status !== "confirmed";
}

/** 一括請負では組立分は請求しない。解体完了後に全額を解体フェーズでまとめて請求する。 */
export function canBillPhase(payType: PayType, phase: PhaseKey): boolean {
  return !(payType === "lump" && phase === "assembly");
}

export function isPhaseMultiDay(schedule: Phase["schedule"]): boolean {
  if (!schedule.plannedStart || !schedule.plannedEnd) return false;
  return daysBetween(schedule.plannedStart, schedule.plannedEnd) >= 1;
}

export function billedPhaseKeys(tx: Transaction): PhaseKey[] {
  return PHASE_KEYS.filter((key) => {
    const bill = tx.phases[key].bill;
    return bill.invoice !== null && bill.payment !== null;
  });
}

export function isAllOnTime(tx: Transaction): boolean {
  return billedPhaseKeys(tx).every((key) => {
    const bill = tx.phases[key].bill;
    return daysBetween(bill.invoice!.dueDate, bill.payment!.paidAt) <= 0;
  });
}

export function averagePayDays(tx: Transaction): number {
  const keys = billedPhaseKeys(tx);
  if (!keys.length) return 0;
  const total = keys.reduce((sum, key) => {
    const bill = tx.phases[key].bill;
    return sum + daysBetween(bill.invoice!.issuedAt, bill.payment!.paidAt);
  }, 0);
  return Math.round(total / keys.length);
}

/** 出来高：組立・解体の両方が入金確認済みで完了。一括：解体の入金確認のみで完了。 */
export function isTransactionComplete(tx: Transaction): boolean {
  if (tx.payType === "progress") {
    return tx.phases.assembly.bill.status === "deposited" && tx.phases.dismantle.bill.status === "deposited";
  }
  return tx.phases.dismantle.bill.status === "deposited";
}

export interface WorkActionDescriptor {
  readonly kind: "startWork" | "reportWork" | "confirmWork" | "reworkDone";
  readonly actor: Actor | "either";
}

export function workAction(tx: Transaction, phase: PhaseKey): WorkActionDescriptor | null {
  if (phase === "dismantle" && dismantleLocked(tx)) return null;
  const status = tx.phases[phase].work.status;
  if (status === "waiting") return { kind: "startWork", actor: "either" };
  if (status === "working") return { kind: "reportWork", actor: "partner" };
  if (status === "reported") return { kind: "confirmWork", actor: "prime" };
  if (status === "rework") return { kind: "reworkDone", actor: "partner" };
  return null;
}

export interface BillActionDescriptor {
  readonly kind: "invoice" | "checkInvoice" | "registerPayment" | "confirmDeposit";
  readonly actor: Actor;
}

export function billAction(tx: Transaction, phase: PhaseKey): BillActionDescriptor | null {
  if (tx.phases[phase].work.status !== "confirmed") return null;
  if (!canBillPhase(tx.payType, phase)) return null;
  const status = tx.phases[phase].bill.status;
  if (status === "none") return { kind: "invoice", actor: "partner" };
  if (status === "invoiced") return { kind: "checkInvoice", actor: "prime" };
  if (status === "checked") return { kind: "registerPayment", actor: "prime" };
  if (status === "paid") return { kind: "confirmDeposit", actor: "partner" };
  return null;
}

export type TransactionCategory = "completed" | "issue" | "rework" | "billing" | "active";

export function category(tx: Transaction): TransactionCategory {
  if (tx.status === "completed") return "completed";
  if (hasOpenIssue(tx)) return "issue";
  if (PHASE_KEYS.some((key) => tx.phases[key].work.status === "rework")) return "rework";
  if (PHASE_KEYS.some((key) => workAction(tx, key))) return "active";
  if (PHASE_KEYS.some((key) => billAction(tx, key))) return "billing";
  return "active";
}

export interface PendingAction {
  readonly kind: string;
  readonly phase?: PhaseKey;
}

/** 「あなたの操作（要対応）」ハイライト用の一覧。ロールごとに今すぐ対応すべき項目を集約する。 */
export function pendingActionsFor(tx: Transaction, role: Actor): PendingAction[] {
  const actions: PendingAction[] = [];
  const acceptPending = tx.startedAt === null;
  if (acceptPending && role === "partner") actions.push({ kind: "acceptDeal" });

  if (tx.startedAt) {
    if (role === "prime" && !tx.order.order) actions.push({ kind: "issueOrder" });
    if (role === "partner" && tx.order.order && !tx.order.acknowledgement) actions.push({ kind: "acknowledgeOrder" });
    for (const phase of PHASE_KEYS) {
      const wa = workAction(tx, phase);
      if (wa && (wa.actor === role || wa.actor === "either")) actions.push({ kind: wa.kind, phase });
      const ba = billAction(tx, phase);
      if (ba && ba.actor === role) actions.push({ kind: ba.kind, phase });
    }
  }
  if (hasOpenIssue(tx)) actions.push({ kind: "resolveIssue" });
  if (tx.scheduleNotice && !tx.scheduleNotice.acknowledged && role === "partner") actions.push({ kind: "acknowledgeSchedule" });
  return actions;
}

const PHASE_LABEL: Record<PhaseKey, string> = { assembly: "組立", dismantle: "解体" };
const ACTOR_LABEL: Record<Actor | "either", string> = { prime: "元請", partner: "協力会社", either: "どちらか" };
const WORK_ACTION_LABEL: Record<WorkActionDescriptor["kind"], string> = {
  startWork: "作業を開始",
  reportWork: "完了を報告",
  confirmWork: "完了の確認 / 是正依頼",
  reworkDone: "是正・手直し完了",
};
const BILL_ACTION_LABEL: Record<BillActionDescriptor["kind"], string> = {
  invoice: "請求書を提出",
  checkInvoice: "請求書を確認",
  registerPayment: "支払い済みにする",
  confirmDeposit: "入金を確認",
};

/** 「現在のステータス」直下に出す一行サマリ。UI・LINE通知の両方から再利用できるよう純粋関数にしてある。 */
export function nextHint(tx: Transaction): string {
  if (tx.status === "completed") return "取引が完了しました";
  if (hasOpenIssue(tx)) return "確認事項の解決が必要です";
  for (const phase of PHASE_KEYS) {
    const wa = workAction(tx, phase);
    if (wa) return `${ACTOR_LABEL[wa.actor]}が「${PHASE_LABEL[phase]}${WORK_ACTION_LABEL[wa.kind]}」`;
  }
  for (const phase of PHASE_KEYS) {
    const ba = billAction(tx, phase);
    if (ba) return `${ACTOR_LABEL[ba.actor]}が「${BILL_ACTION_LABEL[ba.kind]}」`;
  }
  return "";
}
