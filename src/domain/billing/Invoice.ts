import { DomainError, IsoDate, Money, Result, andThen, err, money, ok } from "../shared";

export interface Invoice {
  readonly amount: Money;
  readonly issuedAt: IsoDate;
  readonly dueDate: IsoDate;
  readonly bankAccount: string;
  readonly note: string;
}

export interface InvoiceInput {
  readonly amount: number;
  readonly issuedAt: IsoDate;
  readonly dueDate: IsoDate;
  readonly bankAccount: string;
  readonly note?: string;
}

export function createInvoice(input: InvoiceInput): Result<Invoice> {
  if (input.dueDate < input.issuedAt) {
    return err(new DomainError("INVOICE_DUE_BEFORE_ISSUE", "支払期日は請求日以降にしてください"));
  }
  return andThen(money(input.amount), (amount) =>
    ok({ amount, issuedAt: input.issuedAt, dueDate: input.dueDate, bankAccount: input.bankAccount, note: input.note ?? "" }),
  );
}
