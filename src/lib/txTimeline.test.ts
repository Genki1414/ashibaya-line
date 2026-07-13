import { describe, expect, it } from "vitest";
import { buildTimeline, describeEvent } from "./txTimeline";
import type { StoredEvent } from "@/application";

const ev = (type: string, payload: unknown, occurredAt = "2026-07-10"): StoredEvent => ({
  aggregateId: "t1",
  type,
  payload,
  occurredAt,
});

describe("txTimeline", () => {
  it("labels phase-scoped work events in Japanese", () => {
    expect(describeEvent(ev("WorkConfirmed", { phase: "assembly" })).label).toBe("組立完了を確認");
    expect(describeEvent(ev("InvoiceSubmitted", { phase: "dismantle", amount: 220000 })).detail).toBe("¥220,000");
  });

  it("marks completion as a credit milestone with on-time detail", () => {
    const entry = describeEvent(ev("TransactionCompleted", { onTime: true, avgPayDays: 30 }));
    expect(entry.kind).toBe("credit");
    expect(entry.detail).toContain("期日内支払い");
    expect(entry.detail).toContain("平均支払 30日");
    expect(entry.detail).toContain("信用実績へ反映");
  });

  it("flags a late completion", () => {
    const entry = describeEvent(ev("TransactionCompleted", { onTime: false, avgPayDays: 45 }));
    expect(entry.detail).toContain("支払い遅延あり");
  });

  it("treats transaction start and deposit confirmation as milestones", () => {
    expect(describeEvent(ev("TransactionStarted", { startedBy: "B" })).kind).toBe("milestone");
    expect(describeEvent(ev("DepositConfirmed", { phase: "assembly", amount: 220000 })).kind).toBe("milestone");
  });

  it("falls back to the raw type for unknown events", () => {
    expect(describeEvent(ev("SomethingNew", {})).label).toBe("SomethingNew");
  });

  it("builds a timeline preserving order", () => {
    const entries = buildTimeline([ev("TransactionStarted", {}), ev("OrderIssued", {}), ev("TransactionCompleted", { onTime: true, avgPayDays: 20 })]);
    expect(entries.map((e) => e.type)).toEqual(["TransactionStarted", "OrderIssued", "TransactionCompleted"]);
  });
});
