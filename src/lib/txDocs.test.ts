import { describe, expect, it } from "vitest";
import { CompanyId, TransactionId, type Money } from "../domain/shared";
import { createTransaction, type Transaction } from "../domain/transaction";
import { buildInvoiceDoc, buildStatementDoc, buildCertificateDoc } from "./txDocs";

const yen = (n: number) => n as unknown as Money;

function baseSupport(): Transaction {
  return createTransaction({
    id: TransactionId("tx1"),
    projectName: "現場A 足場",
    jobType: "support",
    region: "宮城県 仙台市",
    address: "青葉区1-1",
    need: 2,
    payType: "progress",
    closing: "末",
    payTerm: "翌月末",
    primeId: CompanyId("A"),
    partnerId: CompanyId("B"),
    guaranteed: false,
    chatKey: "p1:B",
    overallSchedule: { plannedStart: "2026-08-01", plannedEnd: "2026-08-10" },
    assemblySchedule: { plannedStart: "2026-08-01", plannedEnd: "2026-08-10" },
    dismantleSchedule: { plannedStart: null, plannedEnd: null },
    assemblyAmount: yen(100000),
    dismantleAmount: null,
  });
}

const prime = { name: "元請ホールディングス" };
const partner = { name: "協力工業" };

describe("buildInvoiceDoc", () => {
  it("請求書未提出なら null", () => {
    expect(buildInvoiceDoc(baseSupport(), prime, partner)).toBeNull();
  });
  it("請求書提出済みなら 請求元=協力 / 宛先=元請 / 合計", () => {
    const b = baseSupport();
    const tx: Transaction = {
      ...b,
      phases: {
        ...b.phases,
        assembly: { ...b.phases.assembly, bill: { status: "invoiced", invoice: { amount: yen(100000), issuedAt: "2026-08-11", dueDate: "2026-09-30", bankAccount: "七十七銀行 本店 123", note: "" }, payment: null, deposit: null } },
      },
    };
    const doc = buildInvoiceDoc(tx, prime, partner)!;
    expect(doc.issuer).toBe("協力工業");
    expect(doc.recipient).toBe("元請ホールディングス");
    expect(doc.total).toBe(100000);
    expect(doc.dueDate).toBe("2026-09-30");
    expect(doc.bankAccount).toContain("七十七銀行");
  });
});

describe("buildStatementDoc", () => {
  it("当事者・案件・フェーズ・合計を含む", () => {
    const doc = buildStatementDoc(baseSupport(), prime, partner);
    expect(doc.prime).toBe("元請ホールディングス");
    expect(doc.partner).toBe("協力工業");
    expect(doc.total).toBe(100000);
    expect(doc.phases).toHaveLength(1);
    expect(doc.status).toBe("in_progress");
  });
});

describe("buildCertificateDoc", () => {
  it("未完了なら null", () => {
    expect(buildCertificateDoc(baseSupport(), prime, partner)).toBeNull();
  });
  it("完了済みなら完了日・金額・期日内可否を含む", () => {
    const b = baseSupport();
    const tx: Transaction = { ...b, status: "completed", completion: { onTime: true, avgPayDays: 20, completedAt: "2026-09-25" } };
    const doc = buildCertificateDoc(tx, prime, partner)!;
    expect(doc.completedAt).toBe("2026-09-25");
    expect(doc.total).toBe(100000);
    expect(doc.onTime).toBe(true);
  });
});
