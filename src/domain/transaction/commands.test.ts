import { describe, expect, it } from "vitest";
import { CompanyId, TransactionId, money, unwrap } from "../shared";
import * as cmd from "./commands";
import { createTransaction } from "./factory";
import { billAction, category, isTransactionComplete } from "./queries";

const PRIME = CompanyId("A");
const PARTNER = CompanyId("B");

function mustMoney(amount: number) {
  const result = money(amount);
  if (!result.ok) throw result.error;
  return result.value;
}

function progressTx() {
  return createTransaction({
    id: TransactionId("t1"),
    projectName: "マンション改修 足場",
    jobType: "support",
    region: "宮城県 仙台市",
    address: "仙台市青葉区",
    need: 2,
    payType: "progress",
    closing: "末",
    payTerm: "翌月末",
    primeId: PRIME,
    partnerId: PARTNER,
    guaranteed: true,
    chatKey: "p1:B",
    overallSchedule: { plannedStart: "2026-07-08", plannedEnd: "2026-08-05" },
    assemblySchedule: { plannedStart: "2026-07-08", plannedEnd: "2026-07-09" },
    dismantleSchedule: { plannedStart: "2026-08-04", plannedEnd: "2026-08-05" },
    assemblyAmount: mustMoney(220000),
    dismantleAmount: mustMoney(220000),
  });
}

function lumpTx() {
  return createTransaction({
    id: TransactionId("t2"),
    projectName: "戸建て新築 足場一式",
    jobType: "contract",
    region: "宮城県 名取市",
    address: "名取市増田",
    need: null,
    payType: "lump",
    closing: "末",
    payTerm: "翌月15",
    primeId: PRIME,
    partnerId: PARTNER,
    guaranteed: false,
    chatKey: "p2:D",
    overallSchedule: { plannedStart: "2026-08-03", plannedEnd: "2026-08-06" },
    assemblySchedule: { plannedStart: "2026-08-03", plannedEnd: "2026-08-03" },
    dismantleSchedule: { plannedStart: "2026-08-06", plannedEnd: "2026-08-06" },
    assemblyAmount: null,
    dismantleAmount: mustMoney(240000),
  });
}

describe("取引開始時の売掛保証（受注側の選択）", () => {
  it("受注側が保証なしで開始した場合は guaranteed が false になる", () => {
    const tx = unwrap(cmd.startTransaction(progressTx(), "partner", "2026-07-08", false)).transaction;
    expect(tx.guaranteed).toBe(false);
  });
});

describe("Transaction two-phase engine (progress)", () => {
  it("drives assembly to completion while dismantle work is gated only on assembly work confirmation, not billing", () => {
    let tx = progressTx();

    expect(cmd.startTransaction(tx, "prime", "2026-07-08", true).ok).toBe(false);
    tx = unwrap(cmd.startTransaction(tx, "partner", "2026-07-08", true)).transaction;
    expect(tx.startedAt).toBe("2026-07-08");
    // 売掛保証は受注側が取引開始時に選択する
    expect(tx.guaranteed).toBe(true);

    tx = unwrap(cmd.issueOrder(tx, "prime", "2026-07-08")).transaction;
    tx = unwrap(cmd.acknowledgeOrder(tx, "partner", "2026-07-08")).transaction;

    expect(cmd.startWork(tx, "dismantle", "partner", { date: "2026-07-08", people: 2 }, "2026-07-08").ok).toBe(false);

    tx = unwrap(cmd.startWork(tx, "assembly", "partner", { date: "2026-07-08", people: 2 }, "2026-07-08")).transaction;
    tx = unwrap(
      cmd.reportWorkCompletion(tx, "assembly", "partner", { date: "2026-07-09", days: 2, people: 2, content: "組立完了", photoCount: 2 }, "2026-07-09"),
    ).transaction;

    expect(cmd.confirmWork(tx, "assembly", "partner", "2026-07-09").ok).toBe(false);

    tx = unwrap(cmd.requestRework(tx, "assembly", "prime", "手すりの隙間を是正してください", "2026-07-09")).transaction;
    expect(cmd.confirmWork(tx, "assembly", "prime", "2026-07-09").ok).toBe(false);
    tx = unwrap(cmd.completeRework(tx, "assembly", "partner", "2026-07-10")).transaction;
    tx = unwrap(cmd.confirmWork(tx, "assembly", "prime", "2026-07-10")).transaction;
    expect(tx.phases.assembly.work.status).toBe("confirmed");

    tx = unwrap(cmd.startWork(tx, "dismantle", "partner", { date: "2026-08-04", people: 2 }, "2026-08-04")).transaction;
    expect(tx.phases.dismantle.work.status).toBe("working");
    expect(tx.phases.assembly.bill.status).toBe("none");

    tx = unwrap(
      cmd.submitInvoice(tx, "assembly", "partner", { amount: 220000, issuedAt: "2026-07-10", dueDate: "2026-08-31", bankAccount: "行" }, "2026-07-10"),
    ).transaction;
    tx = unwrap(cmd.checkInvoice(tx, "assembly", "prime", "2026-07-10")).transaction;
    tx = unwrap(cmd.registerPayment(tx, "assembly", "prime", { amount: 220000, paidAt: "2026-07-11", method: "銀行振込" }, "2026-07-11")).transaction;

    const afterMismatch = unwrap(cmd.confirmDeposit(tx, "assembly", "partner", { amount: 210000, confirmedAt: "2026-07-11" }, "2026-07-11"));
    expect(afterMismatch.transaction.issues).toHaveLength(1);
    expect(afterMismatch.transaction.phases.assembly.bill.status).toBe("paid");
    expect(isTransactionComplete(afterMismatch.transaction)).toBe(false);

    tx = unwrap(cmd.resolveIssue(afterMismatch.transaction, "prime", "2026-07-11")).transaction;
    tx = unwrap(cmd.confirmDeposit(tx, "assembly", "partner", { amount: 220000, confirmedAt: "2026-07-12" }, "2026-07-12")).transaction;
    expect(tx.phases.assembly.bill.status).toBe("deposited");
    expect(tx.status).toBe("in_progress");

    tx = unwrap(
      cmd.reportWorkCompletion(tx, "dismantle", "partner", { date: "2026-08-05", days: 2, people: 2, content: "解体完了", photoCount: 2 }, "2026-08-05"),
    ).transaction;
    tx = unwrap(cmd.confirmWork(tx, "dismantle", "prime", "2026-08-05")).transaction;
    tx = unwrap(
      cmd.submitInvoice(tx, "dismantle", "partner", { amount: 220000, issuedAt: "2026-08-05", dueDate: "2026-09-30", bankAccount: "行" }, "2026-08-05"),
    ).transaction;
    tx = unwrap(cmd.checkInvoice(tx, "dismantle", "prime", "2026-08-05")).transaction;
    tx = unwrap(cmd.registerPayment(tx, "dismantle", "prime", { amount: 220000, paidAt: "2026-08-20", method: "銀行振込" }, "2026-08-20")).transaction;

    const completion = unwrap(cmd.confirmDeposit(tx, "dismantle", "partner", { amount: 220000, confirmedAt: "2026-08-21" }, "2026-08-21"));
    expect(completion.transaction.status).toBe("completed");
    expect(completion.transaction.completion?.onTime).toBe(true);
    expect(completion.events.some((event) => event.name === "TransactionCompleted")).toBe(true);
    expect(category(completion.transaction)).toBe("completed");
  });
});

describe("Transaction two-phase engine (lump)", () => {
  it("never bills the assembly phase and completes on the dismantle deposit alone", () => {
    let tx = lumpTx();
    tx = unwrap(cmd.startTransaction(tx, "partner", "2026-07-02", true)).transaction;
    tx = unwrap(cmd.startWork(tx, "assembly", "partner", { date: "2026-08-03", people: 3 }, "2026-08-03")).transaction;
    tx = unwrap(
      cmd.reportWorkCompletion(tx, "assembly", "partner", { date: "2026-08-03", days: 1, people: 3, content: "組立完了", photoCount: 1 }, "2026-08-03"),
    ).transaction;
    tx = unwrap(cmd.confirmWork(tx, "assembly", "prime", "2026-08-03")).transaction;

    expect(billAction(tx, "assembly")).toBeNull();
    const rejected = cmd.submitInvoice(
      tx,
      "assembly",
      "partner",
      { amount: 100, issuedAt: "2026-08-03", dueDate: "2026-08-10", bankAccount: "行" },
      "2026-08-03",
    );
    expect(rejected.ok).toBe(false);

    tx = unwrap(cmd.startWork(tx, "dismantle", "partner", { date: "2026-08-06", people: 3 }, "2026-08-06")).transaction;
    tx = unwrap(
      cmd.reportWorkCompletion(tx, "dismantle", "partner", { date: "2026-08-06", days: 1, people: 3, content: "解体完了", photoCount: 1 }, "2026-08-06"),
    ).transaction;
    tx = unwrap(cmd.confirmWork(tx, "dismantle", "prime", "2026-08-06")).transaction;
    tx = unwrap(
      cmd.submitInvoice(tx, "dismantle", "partner", { amount: 240000, issuedAt: "2026-08-07", dueDate: "2026-08-15", bankAccount: "行" }, "2026-08-07"),
    ).transaction;
    tx = unwrap(cmd.checkInvoice(tx, "dismantle", "prime", "2026-08-07")).transaction;
    tx = unwrap(cmd.registerPayment(tx, "dismantle", "prime", { amount: 240000, paidAt: "2026-08-14", method: "銀行振込" }, "2026-08-14")).transaction;
    const completion = unwrap(cmd.confirmDeposit(tx, "dismantle", "partner", { amount: 240000, confirmedAt: "2026-08-14" }, "2026-08-14"));

    expect(completion.transaction.status).toBe("completed");
    expect(completion.transaction.completion?.onTime).toBe(true);
  });
});
