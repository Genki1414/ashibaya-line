import { IsoDate, Money, Result, andThen, money, ok } from "../shared";

export interface Payment {
  readonly amount: Money;
  readonly paidAt: IsoDate;
  readonly method: string;
  readonly note: string;
}

export interface PaymentInput {
  readonly amount: number;
  readonly paidAt: IsoDate;
  readonly method: string;
  readonly note?: string;
}

export function createPayment(input: PaymentInput): Result<Payment> {
  return andThen(money(input.amount), (amount) =>
    ok({ amount, paidAt: input.paidAt, method: input.method, note: input.note ?? "" }),
  );
}
