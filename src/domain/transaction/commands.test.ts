import { describe, expect, it } from "vitest";
import { CompanyId, TransactionId, money, unwrap } from "../shared";
import * as cmd from "./commands";
import { createTransaction } from "./factory";
import { availableActions, billAction, category, isTransactionComplete } from "./queries";

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
    jobType: "contract",
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

function supportTx() {
  return createTransaction({
    id: TransactionId("t3"),
    projectName: "工場外壁 応援",
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
    chatKey: "p3:B",
    overallSchedule: { plannedStart: "2026-07-08", plannedEnd: "2026-07-10" },
    assemblySchedule: { plannedStart: "2026-07-08", plannedEnd: "2026-07-09" },
    dismantleSchedule: { plannedStart: "2026-07-08", plannedEnd: "2026-07-09" },
    assemblyAmount: mustMoney(44000),
    dismantleAmount: null,
  });
}

describe("Transaction single-phase engine (support / 応援)", () => {
  it("has no dismantle phase and completes on the single work phase's deposit", () => {
    let tx = supportTx();
    tx = unwrap(cmd.startTransaction(tx, "partner", "2026-07-08", true)).transaction;
    tx = unwrap(cmd.issueOrder(tx, "prime", "2026-07-08")).transaction;
    tx = unwrap(cmd.acknowledgeOrder(tx, "partner", "2026-07-08")).transaction;

    // 単相なので「作業を開始」だけ。解体フェーズの操作は受け付けない。
    const labels = availableActions(tx, "partner").map((a) => a.label);
    expect(labels).toContain("作業を開始");
    expect(labels.some((l) => l.includes("解体") || l.includes("組立"))).toBe(false);
    expect(cmd.startWork(tx, "dismantle", "partner", { date: "2026-07-08", people: 2 }, "2026-07-08").ok).toBe(false);

    tx = unwrap(cmd.startWork(tx, "assembly", "partner", { date: "2026-07-08", people: 2 }, "2026-07-08")).transaction;
    tx = unwrap(cmd.reportWorkCompletion(tx, "assembly", "partner", { date: "2026-07-09", days: 2, people: 2, content: "作業完了", photoCount: 1 }, "2026-07-09")).transaction;
    tx = unwrap(cmd.confirmWork(tx, "assembly", "prime", "2026-07-09")).transaction;

    const invoice = availableActions(tx, "partner").find((a) => a.key === "submitInvoice");
    expect(invoice?.label).toBe("請求書を提出");

    tx = unwrap(cmd.submitInvoice(tx, "assembly", "partner", { amount: 44000, issuedAt: "2026-07-09", dueDate: "2026-07-31", bankAccount: "行" }, "2026-07-09")).transaction;
    tx = unwrap(cmd.checkInvoice(tx, "assembly", "prime", "2026-07-09")).transaction;
    tx = unwrap(cmd.registerPayment(tx, "assembly", "prime", { amount: 44000, paidAt: "2026-07-20", method: "銀行振込" }, "2026-07-20")).transaction;
    const done = unwrap(cmd.confirmDeposit(tx, "assembly", "partner", { amount: 44000, confirmedAt: "2026-07-21" }, "2026-07-21"));
    expect(done.transaction.status).toBe("completed");
    expect(done.events.some((e) => e.name === "TransactionCompleted")).toBe(true);
  });
});

describe("のべ作業日数の自動計算", () => {
  it("日次の作業終了報告＋完了日から重複日を除いて自動計算する（手入力は無視）", () => {
    let tx = unwrap(cmd.startTransaction(progressTx(), "partner", "2026-07-08", true)).transaction;
    tx = unwrap(cmd.startWork(tx, "assembly", "partner", { date: "2026-07-08", people: 2 }, "2026-07-08")).transaction; // start=07-08
    tx = unwrap(cmd.recordDailySession(tx, "assembly", "partner", { date: "2026-07-09", kind: "end", people: 2, note: null }, "2026-07-09")).transaction; // 07-09
    tx = unwrap(cmd.reportWorkCompletion(tx, "assembly", "partner", { date: "2026-07-10", days: 999, people: 2, content: "完了", photoCount: 1 }, "2026-07-10")).transaction; // 完了=07-10
    // 07-08 / 07-09 / 07-10 の3日（入力 days:999 は無視）
    expect(tx.phases.assembly.work.report?.days).toBe(3);
  });
});

describe("案件情報の変更（元請）", () => {
  it("元請は現場・未請求フェーズの金額を変更できる（協力会社は不可）", () => {
    let tx = unwrap(cmd.startTransaction(progressTx(), "partner", "2026-07-08", true)).transaction;
    expect(cmd.updateTransactionInfo(tx, "partner", { region: "x" }, "2026-07-08").ok).toBe(false);

    const r = unwrap(cmd.updateTransactionInfo(tx, "prime", { region: "宮城県 石巻市", address: "石巻市中央", assemblyAmount: 250000 }, "2026-07-08"));
    tx = r.transaction;
    expect(tx.region).toBe("宮城県 石巻市");
    expect(tx.address).toBe("石巻市中央");
    expect(tx.phases.assembly.amount).toBe(250000);
    expect(r.events.some((e) => e.name === "TransactionInfoUpdated")).toBe(true);

    // 関係先へ変更通知が立ち、受注側の確認で解消する。
    expect(tx.infoNotice?.acknowledged).toBe(false);
    expect(tx.infoNotice?.changes.length).toBeGreaterThan(0);
    expect(cmd.acknowledgeInfo(tx, "prime", "2026-07-08").ok).toBe(false);
    tx = unwrap(cmd.acknowledgeInfo(tx, "partner", "2026-07-08")).transaction;
    expect(tx.infoNotice?.acknowledged).toBe(true);
  });

  it("請求が始まったフェーズの金額は変更できない", () => {
    let tx = unwrap(cmd.startTransaction(progressTx(), "partner", "2026-07-08", true)).transaction;
    tx = unwrap(cmd.startWork(tx, "assembly", "partner", { date: "2026-07-08", people: 2 }, "2026-07-08")).transaction;
    tx = unwrap(cmd.reportWorkCompletion(tx, "assembly", "partner", { date: "2026-07-09", days: 2, people: 2, content: "組立完了", photoCount: 2 }, "2026-07-09")).transaction;
    tx = unwrap(cmd.confirmWork(tx, "assembly", "prime", "2026-07-09")).transaction;
    tx = unwrap(cmd.submitInvoice(tx, "assembly", "partner", { amount: 220000, issuedAt: "2026-07-09", dueDate: "2026-08-31", bankAccount: "行" }, "2026-07-09")).transaction;
    expect(cmd.updateTransactionInfo(tx, "prime", { assemblyAmount: 250000 }, "2026-07-10").ok).toBe(false);
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
