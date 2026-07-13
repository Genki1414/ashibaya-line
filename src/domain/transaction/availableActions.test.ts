import { describe, expect, it } from "vitest";
import { CompanyId, TransactionId, money, unwrap } from "../shared";
import * as cmd from "./commands";
import { createTransaction } from "./factory";
import { availableActions } from "./queries";
import { Actor, Transaction } from "./types";

const PRIME = CompanyId("A");
const PARTNER = CompanyId("B");

function mustMoney(n: number) {
  return unwrap(money(n));
}

function baseTx() {
  return createTransaction({
    id: TransactionId("t1"),
    projectName: "案件",
    jobType: "support",
    region: "宮城県 仙台市",
    address: "仙台市",
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

function keys(tx: Transaction, role: Actor): string[] {
  return availableActions(tx, role).map((a) => a.key);
}

describe("availableActions", () => {
  it("before acceptance, only the partner can start the transaction", () => {
    const tx = baseTx();
    expect(keys(tx, "partner")).toEqual(["startTransaction"]);
    expect(keys(tx, "prime")).toEqual([]);
  });

  it("after start, prime has the order to issue and either party may log the assembly start", () => {
    const tx = unwrap(cmd.startTransaction(baseTx(), "partner", "2026-07-08", true)).transaction;
    // 注文書は元請のみ。作業開始は v8 同様 'either'（協力が実作業、どちらでも開始記録可）。
    expect(keys(tx, "prime")).toContain("issueOrder");
    expect(keys(tx, "prime")).toContain("startWork");
    expect(keys(tx, "partner")).toContain("startWork");
    expect(keys(tx, "partner")).not.toContain("issueOrder");
  });

  it("surfaces the prime's confirm-or-rework as urgent on the reported phase", () => {
    let tx = unwrap(cmd.startTransaction(baseTx(), "partner", "2026-07-08", true)).transaction;
    tx = unwrap(cmd.startWork(tx, "assembly", "partner", { date: "2026-07-08", people: 2 }, "2026-07-08")).transaction;
    tx = unwrap(
      cmd.reportWorkCompletion(tx, "assembly", "partner", { date: "2026-07-09", days: 2, people: 2, content: "組立完了", photoCount: 2 }, "2026-07-09"),
    ).transaction;

    const primeActions = availableActions(tx, "prime");
    const confirm = primeActions.find((a) => a.key === "confirmWork");
    expect(confirm).toBeTruthy();
    expect(confirm?.phase).toBe("assembly");
    expect(confirm?.section).toBe("assembly");
    expect(confirm?.urgent).toBe(true);
    // partner has no move while awaiting confirmation
    expect(keys(tx, "partner")).toEqual([]);
  });

  it("labels the progress invoice per phase and routes billing actors correctly", () => {
    let tx = unwrap(cmd.startTransaction(baseTx(), "partner", "2026-07-08", true)).transaction;
    tx = unwrap(cmd.startWork(tx, "assembly", "partner", { date: "2026-07-08", people: 2 }, "2026-07-08")).transaction;
    tx = unwrap(
      cmd.reportWorkCompletion(tx, "assembly", "partner", { date: "2026-07-09", days: 2, people: 2, content: "組立完了", photoCount: 2 }, "2026-07-09"),
    ).transaction;
    tx = unwrap(cmd.confirmWork(tx, "assembly", "prime", "2026-07-09")).transaction;

    const invoice = availableActions(tx, "partner").find((a) => a.key === "submitInvoice");
    expect(invoice?.label).toBe("組立分を請求");
    expect(invoice?.phase).toBe("assembly");
    // prime has no billing move — it waits for the invoice (its remaining moves are order/work-start only)
    const billingKeys = ["submitInvoice", "checkInvoice", "registerPayment", "confirmDeposit"];
    expect(availableActions(tx, "prime").some((a) => billingKeys.includes(a.key))).toBe(false);
  });

  it("only the partner is asked to acknowledge a schedule change; only the prime resolves an issue", () => {
    let tx = unwrap(cmd.startTransaction(baseTx(), "partner", "2026-07-08", true)).transaction;
    tx = unwrap(cmd.changeSchedule(tx, "prime", { dismantleSchedule: { plannedStart: "2026-08-06", plannedEnd: "2026-08-07" } }, "2026-07-08")).transaction;
    expect(keys(tx, "partner")).toContain("acknowledgeSchedule");
    expect(keys(tx, "prime")).not.toContain("acknowledgeSchedule");

    tx = unwrap(cmd.raiseIssue(tx, "partner", "差額の確認をお願いします", "2026-07-09")).transaction;
    expect(keys(tx, "prime")).toContain("resolveIssue");
    expect(keys(tx, "partner")).not.toContain("resolveIssue");
  });

  it("returns nothing once the transaction is completed", () => {
    let tx = baseTx();
    tx = { ...tx, status: "completed" };
    expect(availableActions(tx, "prime")).toEqual([]);
    expect(availableActions(tx, "partner")).toEqual([]);
  });
});
