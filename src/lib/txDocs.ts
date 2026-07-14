import type { Transaction } from "@/domain/transaction";
import { activePhaseKeys, phaseLabel, billedPhaseKeys } from "@/domain/transaction";

/**
 * 帳票（請求書・取引明細書・取引証明書）の表示データを、取引集約から導出する純粋関数群。
 * 実データ読み込み（loadTxDetail）とは分離し、テスト可能にする。
 */

export type TxDocType = "invoice" | "statement" | "certificate";

export const TX_DOC_LABEL: Record<TxDocType, string> = {
  invoice: "請求書",
  statement: "取引明細書",
  certificate: "取引完了証明書",
};

export interface Party {
  readonly name: string;
}

export interface AmountLine {
  readonly label: string;
  readonly amount: number;
}

// ── 請求書 ──
export interface InvoiceDoc {
  readonly projectName: string;
  /** 請求元（代金を受け取る協力会社）。 */
  readonly issuer: string;
  /** 宛先（支払う元請）。 */
  readonly recipient: string;
  readonly issuedAt: string | null;
  readonly dueDate: string | null;
  readonly bankAccount: string;
  readonly lines: readonly AmountLine[];
  readonly total: number;
}

/** 請求書。請求書が1つ以上提出済みのときだけ生成できる（無ければ null）。 */
export function buildInvoiceDoc(tx: Transaction, prime: Party, partner: Party): InvoiceDoc | null {
  const keys = billedPhaseKeys(tx);
  const withInvoice = keys.filter((k) => tx.phases[k].bill.invoice != null);
  if (withInvoice.length === 0) return null;

  const lines: AmountLine[] = withInvoice.map((k) => {
    const label = phaseLabel(tx, k);
    return { label: label ? `${label}分` : "作業一式", amount: tx.phases[k].bill.invoice!.amount };
  });
  const total = lines.reduce((s, l) => s + l.amount, 0);
  const issued = withInvoice.map((k) => tx.phases[k].bill.invoice!.issuedAt).sort();
  const dues = withInvoice.map((k) => tx.phases[k].bill.invoice!.dueDate).sort();
  const bank = tx.phases[withInvoice[0]].bill.invoice!.bankAccount;

  return {
    projectName: tx.projectName,
    issuer: partner.name,
    recipient: prime.name,
    issuedAt: issued[0] ?? null,
    dueDate: dues[dues.length - 1] ?? null,
    bankAccount: bank,
    lines,
    total,
  };
}

// ── 取引明細書 ──
export type PhaseWorkStatus = "waiting" | "working" | "reported" | "rework" | "confirmed";
export type PhaseBillStatus = "none" | "invoiced" | "checked" | "paid" | "deposited";

export interface StatementPhase {
  readonly label: string;
  readonly amount: number | null;
  readonly plannedStart: string | null;
  readonly plannedEnd: string | null;
  readonly workStatus: PhaseWorkStatus;
  readonly completedAt: string | null;
  readonly billStatus: PhaseBillStatus;
  readonly paidAt: string | null;
}

export interface StatementDoc {
  readonly projectName: string;
  readonly prime: string;
  readonly partner: string;
  readonly jobType: string;
  readonly region: string;
  readonly address: string;
  readonly overallStart: string | null;
  readonly overallEnd: string | null;
  readonly closing: string;
  readonly payTerm: string;
  readonly guaranteed: boolean;
  readonly phases: readonly StatementPhase[];
  readonly total: number;
  readonly status: "in_progress" | "completed";
  readonly completedAt: string | null;
}

const WORK_JP: Record<string, string> = { waiting: "未着手", working: "作業中", reported: "完了報告済み", rework: "是正対応中", confirmed: "完了確認済み" };
const BILL_JP: Record<string, string> = { none: "未請求", invoiced: "請求済み", checked: "請求確認済み", paid: "支払済み", deposited: "入金確認済み" };

export const workStatusLabel = (s: string) => WORK_JP[s] ?? s;
export const billStatusLabel = (s: string) => BILL_JP[s] ?? s;

export function buildStatementDoc(tx: Transaction, prime: Party, partner: Party): StatementDoc {
  const keys = activePhaseKeys(tx);
  const phases: StatementPhase[] = keys.map((k) => {
    const p = tx.phases[k];
    const label = phaseLabel(tx, k);
    return {
      label: label || "作業",
      amount: p.amount,
      plannedStart: p.schedule.plannedStart,
      plannedEnd: p.schedule.plannedEnd,
      workStatus: p.work.status,
      completedAt: p.work.endDate,
      billStatus: p.bill.status,
      paidAt: p.bill.payment?.paidAt ?? null,
    };
  });
  const total = keys.reduce((s, k) => s + (tx.phases[k].amount ?? 0), 0);
  return {
    projectName: tx.projectName,
    prime: prime.name,
    partner: partner.name,
    jobType: tx.jobType === "contract" ? "請負（一式）" : "応援（人工）",
    region: tx.region,
    address: tx.address,
    overallStart: tx.overallSchedule.plannedStart,
    overallEnd: tx.overallSchedule.plannedEnd,
    closing: tx.closing,
    payTerm: tx.payTerm,
    guaranteed: tx.guaranteed,
    phases,
    total,
    status: tx.status,
    completedAt: tx.completion?.completedAt ?? null,
  };
}

// ── 取引完了証明書 ──
export interface CertificateDoc {
  readonly projectName: string;
  readonly prime: string;
  readonly partner: string;
  readonly jobType: string;
  readonly region: string;
  readonly periodStart: string | null;
  readonly periodEnd: string | null;
  readonly total: number;
  readonly completedAt: string;
  readonly onTime: boolean;
  readonly guaranteed: boolean;
}

/** 取引完了証明書。完了済みの取引のみ生成できる（未完了は null）。 */
export function buildCertificateDoc(tx: Transaction, prime: Party, partner: Party): CertificateDoc | null {
  if (tx.status !== "completed" || !tx.completion) return null;
  const keys = activePhaseKeys(tx);
  const total = keys.reduce((s, k) => s + (tx.phases[k].amount ?? 0), 0);
  return {
    projectName: tx.projectName,
    prime: prime.name,
    partner: partner.name,
    jobType: tx.jobType === "contract" ? "請負（一式）" : "応援（人工）",
    region: tx.region,
    periodStart: tx.overallSchedule.plannedStart,
    periodEnd: tx.overallSchedule.plannedEnd,
    total,
    completedAt: tx.completion.completedAt,
    onTime: tx.completion.onTime,
    guaranteed: tx.guaranteed,
  };
}
