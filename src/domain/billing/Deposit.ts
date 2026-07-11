import { IsoDate, Money, Result, andThen, equalsMoney, money, ok, subtractMoney } from "../shared";

export interface Deposit {
  readonly amount: Money;
  readonly confirmedAt: IsoDate;
  readonly note: string;
}

export interface DepositInput {
  readonly amount: number;
  readonly confirmedAt: IsoDate;
  readonly note?: string;
}

export interface DepositEvaluation {
  readonly deposit: Deposit;
  readonly hasDiscrepancy: boolean;
  readonly discrepancyAmount: Money | null;
}

/** 入金額を請求額と突き合わせる。差額があれば確認事項として扱い、トラックは進めない。 */
export function evaluateDeposit(input: DepositInput, invoicedAmount: Money): Result<DepositEvaluation> {
  return andThen(money(input.amount), (amount) => {
    const deposit: Deposit = { amount, confirmedAt: input.confirmedAt, note: input.note ?? "" };
    const hasDiscrepancy = !equalsMoney(amount, invoicedAmount);
    return ok({ deposit, hasDiscrepancy, discrepancyAmount: hasDiscrepancy ? subtractMoney(amount, invoicedAmount) : null });
  });
}
