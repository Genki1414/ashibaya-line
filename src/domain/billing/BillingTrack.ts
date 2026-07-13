import { DomainError, Result, err, ok } from "../shared";
import { Deposit, DepositEvaluation } from "./Deposit";
import { Invoice } from "./Invoice";
import { Payment } from "./Payment";

export type BillStatus = "none" | "invoiced" | "checked" | "paid" | "deposited";

/**
 * 請求トラック：請求→確認→支払→入金確認の二者確認モデル。
 * 元請の「支払い済み」だけでは完了せず、協力の「入金確認」が必要（仕様書5章）。
 */
export interface BillingTrack {
  readonly status: BillStatus;
  readonly invoice: Invoice | null;
  readonly payment: Payment | null;
  readonly deposit: Deposit | null;
}

export const initialBillingTrack: BillingTrack = { status: "none", invoice: null, payment: null, deposit: null };

function invalidTransition(action: string, status: BillStatus): DomainError {
  return new DomainError("BILL_INVALID_TRANSITION", `請求ステータスが「${status}」のため「${action}」はできません`);
}

export function submitInvoice(track: BillingTrack, invoice: Invoice): Result<BillingTrack> {
  if (track.status !== "none") return err(invalidTransition("請求書の提出", track.status));
  return ok({ ...track, status: "invoiced", invoice });
}

export function checkInvoice(track: BillingTrack): Result<BillingTrack> {
  if (track.status !== "invoiced") return err(invalidTransition("請求書の確認", track.status));
  return ok({ ...track, status: "checked" });
}

export function registerPayment(track: BillingTrack, payment: Payment): Result<BillingTrack> {
  if (track.status !== "checked") return err(invalidTransition("支払い登録", track.status));
  return ok({ ...track, status: "paid", payment });
}

export interface ConfirmDepositResult {
  readonly track: BillingTrack;
  readonly hasDiscrepancy: boolean;
}

/** 差額があるときはトラックを進めず、呼び出し側（Transaction）が確認事項として記録する。 */
export function confirmDeposit(track: BillingTrack, evaluation: DepositEvaluation): Result<ConfirmDepositResult> {
  if (track.status !== "paid") return err(invalidTransition("入金確認", track.status));
  if (evaluation.hasDiscrepancy) return ok({ track, hasDiscrepancy: true });
  return ok({ track: { ...track, status: "deposited", deposit: evaluation.deposit }, hasDiscrepancy: false });
}
