import { DomainError, Result, err, ok } from "./result";

/** Non-negative integer yen amount. */
export type Money = number & { readonly __brand: "Money" };

export function money(amount: number): Result<Money> {
  if (!Number.isInteger(amount) || amount < 0) {
    return err(new DomainError("INVALID_MONEY", `金額は0以上の整数で指定してください: ${amount}`));
  }
  return ok(amount as Money);
}

export function zeroMoney(): Money {
  return 0 as Money;
}

export function addMoney(a: Money, b: Money): Money {
  return (a + b) as Money;
}

export function subtractMoney(a: Money, b: Money): Money {
  return Math.abs(a - b) as Money;
}

export function equalsMoney(a: Money, b: Money): boolean {
  return a === b;
}
