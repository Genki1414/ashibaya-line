import { describe, expect, it } from "vitest";
import { CompanyId } from "../shared";
import { applyCompletionAsPartner, applyCompletionAsPrime } from "./metrics";
import { initialCompanyMetrics } from "./types";

describe("credit metrics update on transaction completion", () => {
  it("updates the prime's on-time/late counters, average pay days, and continuous-partner set", () => {
    const partnerId = CompanyId("B");
    const updated = applyCompletionAsPrime(initialCompanyMetrics, partnerId, { onTime: true, avgPayDays: 30, completedAt: "2026-07-11" });
    expect(updated.completed).toBe(1);
    expect(updated.paidCount).toBe(1);
    expect(updated.onTimeCount).toBe(1);
    expect(updated.lateCount).toBe(0);
    expect(updated.avgPayDays).toBe(30);
    expect(updated.continuousPartnerIds).toEqual([partnerId]);

    const afterLate = applyCompletionAsPrime(updated, partnerId, { onTime: false, avgPayDays: 40, completedAt: "2026-08-01" });
    expect(afterLate.completed).toBe(2);
    expect(afterLate.lateCount).toBe(1);
    expect(afterLate.avgPayDays).toBe(35);
    // same partner again: continuous-partner set does not grow
    expect(afterLate.continuousPartnerIds).toEqual([partnerId]);
  });

  it("updates the partner's completed count and continuous-partner set without touching pay-day metrics", () => {
    const primeId = CompanyId("A");
    const updated = applyCompletionAsPartner(initialCompanyMetrics, primeId, { onTime: true, avgPayDays: 30, completedAt: "2026-07-11" });
    expect(updated.completed).toBe(1);
    expect(updated.paidCount).toBe(0);
    expect(updated.continuousPartnerIds).toEqual([primeId]);
  });
});
