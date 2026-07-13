import { describe, expect, it } from "vitest";
import { checkInvoice, confirmDeposit, initialBillingTrack, registerPayment, submitInvoice } from "./BillingTrack";
import { createInvoice } from "./Invoice";
import { createPayment } from "./Payment";
import { evaluateDeposit } from "./Deposit";

function issuedInvoice() {
  const result = createInvoice({ amount: 220000, issuedAt: "2026-07-09", dueDate: "2026-08-31", bankAccount: "七十七銀行 仙台支店 普通1234567" });
  if (!result.ok) throw result.error;
  return result.value;
}

describe("BillingTrack", () => {
  it("progresses none -> invoiced -> checked -> paid -> deposited when amounts match", () => {
    const invoice = issuedInvoice();
    const invoiced = submitInvoice(initialBillingTrack, invoice);
    if (!invoiced.ok) throw invoiced.error;
    expect(invoiced.value.status).toBe("invoiced");

    const checked = checkInvoice(invoiced.value);
    if (!checked.ok) throw checked.error;
    expect(checked.value.status).toBe("checked");

    const paymentResult = createPayment({ amount: 220000, paidAt: "2026-07-11", method: "銀行振込" });
    if (!paymentResult.ok) throw paymentResult.error;
    const paid = registerPayment(checked.value, paymentResult.value);
    if (!paid.ok) throw paid.error;
    expect(paid.value.status).toBe("paid");

    const evaluation = evaluateDeposit({ amount: 220000, confirmedAt: "2026-07-11" }, invoice.amount);
    if (!evaluation.ok) throw evaluation.error;
    const deposited = confirmDeposit(paid.value, evaluation.value);
    if (!deposited.ok) throw deposited.error;
    expect(deposited.value.hasDiscrepancy).toBe(false);
    expect(deposited.value.track.status).toBe("deposited");
  });

  it("keeps the track at paid and reports a discrepancy when the deposited amount differs", () => {
    const invoice = issuedInvoice();
    const invoiced = submitInvoice(initialBillingTrack, invoice);
    if (!invoiced.ok) throw invoiced.error;
    const checked = checkInvoice(invoiced.value);
    if (!checked.ok) throw checked.error;
    const paymentResult = createPayment({ amount: 220000, paidAt: "2026-07-11", method: "銀行振込" });
    if (!paymentResult.ok) throw paymentResult.error;
    const paid = registerPayment(checked.value, paymentResult.value);
    if (!paid.ok) throw paid.error;

    const evaluation = evaluateDeposit({ amount: 210000, confirmedAt: "2026-07-11" }, invoice.amount);
    if (!evaluation.ok) throw evaluation.error;
    expect(evaluation.value.hasDiscrepancy).toBe(true);
    expect(evaluation.value.discrepancyAmount).toBe(10000);

    const result = confirmDeposit(paid.value, evaluation.value);
    if (!result.ok) throw result.error;
    expect(result.value.hasDiscrepancy).toBe(true);
    expect(result.value.track.status).toBe("paid");
  });

  it("rejects skipping steps", () => {
    expect(checkInvoice(initialBillingTrack).ok).toBe(false);
    const invoiced = submitInvoice(initialBillingTrack, issuedInvoice());
    if (!invoiced.ok) throw invoiced.error;
    expect(submitInvoice(invoiced.value, issuedInvoice()).ok).toBe(false);
  });

  it("rejects a due date earlier than the issue date", () => {
    const result = createInvoice({ amount: 100, issuedAt: "2026-08-01", dueDate: "2026-07-31", bankAccount: "x" });
    expect(result.ok).toBe(false);
  });
});
