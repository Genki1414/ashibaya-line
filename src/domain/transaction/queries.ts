import { daysBetween } from "../shared";
import { Actor, Phase, PhaseKey, PHASE_KEYS, Transaction } from "./types";

export function hasOpenIssue(tx: Transaction): boolean {
  return tx.issues.some((issue) => !issue.resolved);
}

/**
 * 実際に進行するフェーズ。請負（一式）は組立・解体の二相、応援（人工）は単相（作業のみ）。
 * 応援では解体フェーズを使わず、assembly を唯一の作業フェーズとして扱う。
 */
export function activePhaseKeys(tx: Transaction): PhaseKey[] {
  return tx.jobType === "support" ? ["assembly"] : ["assembly", "dismantle"];
}

/** 応援（単相）ではフェーズ名を付けず「作業」とだけ表す。請負は組立/解体を明示。 */
export function phaseLabel(tx: Transaction, phase: PhaseKey): string {
  if (activePhaseKeys(tx).length === 1) return "";
  return phase === "assembly" ? "組立" : "解体";
}

/** 解体の「作業」は組立の作業が confirmed であることだけを条件に開始できる（仕様書5章、最重要ルール）。 */
export function dismantleLocked(tx: Transaction): boolean {
  return tx.phases.assembly.work.status !== "confirmed";
}

/**
 * そのフェーズを請求できるか。応援（単相）は唯一の作業フェーズを常に請求可。
 * 請負の一括では組立分は請求せず、解体完了後に全額を解体フェーズでまとめて請求する。
 */
export function canBillPhase(tx: Transaction, phase: PhaseKey): boolean {
  if (activePhaseKeys(tx).length === 1) return true;
  return !(tx.payType === "lump" && phase === "assembly");
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

/**
 * 請求対象の全フェーズが入金確認済みで完了。
 * 請負・出来高＝組立と解体の両方、請負・一括＝解体のみ、応援＝唯一の作業フェーズ。
 */
export function isTransactionComplete(tx: Transaction): boolean {
  const billable = activePhaseKeys(tx).filter((phase) => canBillPhase(tx, phase));
  return billable.length > 0 && billable.every((phase) => tx.phases[phase].bill.status === "deposited");
}

export interface WorkActionDescriptor {
  readonly kind: "startWork" | "reportWork" | "confirmWork" | "reworkDone";
  readonly actor: Actor | "either";
}

export function workAction(tx: Transaction, phase: PhaseKey): WorkActionDescriptor | null {
  if (!activePhaseKeys(tx).includes(phase)) return null;
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
  if (!activePhaseKeys(tx).includes(phase)) return null;
  if (tx.phases[phase].work.status !== "confirmed") return null;
  if (!canBillPhase(tx, phase)) return null;
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
  if (activePhaseKeys(tx).some((key) => tx.phases[key].work.status === "rework")) return "rework";
  if (activePhaseKeys(tx).some((key) => workAction(tx, key))) return "active";
  if (activePhaseKeys(tx).some((key) => billAction(tx, key))) return "billing";
  return "active";
}

export interface PendingAction {
  readonly kind: string;
  readonly phase?: PhaseKey;
}

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
/** 作業/請求アクションの kind をアプリケーション層のユースケース名に対応させる。 */
const WORK_ACTION_KEY: Record<WorkActionDescriptor["kind"], string> = {
  startWork: "startWork",
  reportWork: "reportWorkCompletion",
  confirmWork: "confirmWork",
  reworkDone: "completeRework",
};
const BILL_ACTION_KEY: Record<BillActionDescriptor["kind"], string> = {
  invoice: "submitInvoice",
  checkInvoice: "checkInvoice",
  registerPayment: "registerPayment",
  confirmDeposit: "confirmDeposit",
};

export type ActionSection = "transaction" | "order" | "assembly" | "dismantle" | "issue" | "schedule" | "info";

/**
 * ある役割（元請/協力）が「今この取引で実行できる操作」の一覧。
 * コマンドのガード（workAction/billAction 等）と同じ判定から導出するため、
 * UIの自動展開・ハイライト・ボタン出し分けはすべてこれ1つに集約できる。
 * key はアプリケーション層のユースケース名に一致。
 */
export interface AvailableAction {
  readonly key: string;
  readonly label: string;
  readonly phase?: PhaseKey;
  readonly urgent: boolean;
  readonly section: ActionSection;
}

function invoiceLabel(tx: Transaction, phase: PhaseKey): string {
  if (activePhaseKeys(tx).length === 1) return "請求書を提出";
  if (tx.payType !== "progress") return "請求書を提出";
  return phase === "assembly" ? "組立分を請求" : "残金を請求";
}

export function availableActions(tx: Transaction, role: Actor): AvailableAction[] {
  if (tx.status === "completed") return [];
  const actions: AvailableAction[] = [];

  if (tx.startedAt === null) {
    if (role === "partner") actions.push({ key: "startTransaction", label: "取引を開始", urgent: true, section: "transaction" });
    return actions;
  }

  if (role === "prime" && !tx.order.order) actions.push({ key: "issueOrder", label: "注文書を発行", urgent: true, section: "order" });
  if (role === "partner" && tx.order.order && !tx.order.acknowledgement) {
    actions.push({ key: "acknowledgeOrder", label: "注文請書を発行", urgent: true, section: "order" });
  }

  for (const phase of activePhaseKeys(tx)) {
    const wa = workAction(tx, phase);
    if (wa && (wa.actor === role || wa.actor === "either")) {
      actions.push({
        key: WORK_ACTION_KEY[wa.kind],
        label: `${phaseLabel(tx, phase)}${WORK_ACTION_LABEL[wa.kind]}`,
        phase,
        urgent: true,
        section: phase,
      });
    }
    const ba = billAction(tx, phase);
    if (ba && ba.actor === role) {
      const label = ba.kind === "invoice" ? invoiceLabel(tx, phase) : BILL_ACTION_LABEL[ba.kind];
      actions.push({ key: BILL_ACTION_KEY[ba.kind], label, phase, urgent: true, section: phase });
    }
  }

  if (hasOpenIssue(tx) && role === "prime") {
    actions.push({ key: "resolveIssue", label: "確認事項を解決", urgent: true, section: "issue" });
  }
  if (tx.scheduleNotice && !tx.scheduleNotice.acknowledged && role === "partner") {
    actions.push({ key: "acknowledgeSchedule", label: "工期・予定変更を確認", urgent: true, section: "schedule" });
  }
  if (tx.infoNotice && !tx.infoNotice.acknowledged && role === "partner") {
    actions.push({ key: "acknowledgeInfo", label: "案件情報の変更を確認", urgent: true, section: "info" });
  }
  return actions;
}

/** 「あなたの操作（要対応）」ハイライト用。availableActions のうち要対応（urgent）だけを返す。 */
export function pendingActionsFor(tx: Transaction, role: Actor): PendingAction[] {
  return availableActions(tx, role)
    .filter((action) => action.urgent)
    .map((action) => ({ kind: action.key, phase: action.phase }));
}

/** 「現在のステータス」直下に出す一行サマリ。UI・LINE通知の両方から再利用できるよう純粋関数にしてある。 */
export function nextHint(tx: Transaction): string {
  if (tx.status === "completed") return "取引が完了しました";
  if (hasOpenIssue(tx)) return "確認事項の解決が必要です";
  for (const phase of activePhaseKeys(tx)) {
    const wa = workAction(tx, phase);
    if (wa) return `${ACTOR_LABEL[wa.actor]}が「${phaseLabel(tx, phase)}${WORK_ACTION_LABEL[wa.kind]}」`;
  }
  for (const phase of activePhaseKeys(tx)) {
    const ba = billAction(tx, phase);
    if (ba) return `${ACTOR_LABEL[ba.actor]}が「${BILL_ACTION_LABEL[ba.kind]}」`;
  }
  return "";
}
