import { describe, expect, it } from "vitest";
import { determineCreditLevel } from "./creditLevel";
import { CompanyMetrics, VerifyRecord, initialCompanyMetrics } from "./types";

const allVerified: VerifyRecord = {
  phone: "verified",
  email: "verified",
  corp: "verified",
  rep: "verified",
  address: "verified",
  license: "verified",
  invoice: "verified",
  labor: "verified",
  liability: "verified",
  sole: "verified",
  qual: "verified",
  harness: "verified",
};

const noneVerified: VerifyRecord = { ...allVerified, phone: "none", corp: "none", rep: "none", address: "none", email: "none" };

function metrics(overrides: Partial<CompanyMetrics>): CompanyMetrics {
  return { ...initialCompanyMetrics, ...overrides };
}

describe("determineCreditLevel", () => {
  it("stays unverified when core identity checks are incomplete, regardless of trade history", () => {
    const level = determineCreditLevel({
      verify: noneVerified,
      metrics: metrics({ completed: 100, onTimeCount: 100, lateCount: 0 }),
      hasOpenIssue: false,
    });
    expect(level).toBe("unverified");
  });

  it("grants bronze after core verification and one completed trade", () => {
    const level = determineCreditLevel({ verify: allVerified, metrics: metrics({ completed: 1 }), hasOpenIssue: false });
    expect(level).toBe("bronze");
  });

  it("requires no open issue for silver", () => {
    const goodMetrics = metrics({ completed: 5, onTimeCount: 9, lateCount: 1 });
    expect(determineCreditLevel({ verify: allVerified, metrics: goodMetrics, hasOpenIssue: false })).toBe("silver");
    expect(determineCreditLevel({ verify: allVerified, metrics: goodMetrics, hasOpenIssue: true })).toBe("bronze");
  });

  it("requires 3+ main verifications and 95%+ on-time rate for gold", () => {
    const metricsForGold = metrics({ completed: 20, onTimeCount: 19, lateCount: 1 });
    expect(determineCreditLevel({ verify: allVerified, metrics: metricsForGold, hasOpenIssue: false })).toBe("gold");

    const partiallyVerified: VerifyRecord = { ...allVerified, liability: "reviewing", labor: "reviewing" };
    expect(determineCreditLevel({ verify: partiallyVerified, metrics: metricsForGold, hasOpenIssue: false })).toBe("silver");
  });

  it("requires zero late payments for platinum", () => {
    const platinumMetrics = metrics({ completed: 50, onTimeCount: 49, lateCount: 1 });
    expect(determineCreditLevel({ verify: allVerified, metrics: platinumMetrics, hasOpenIssue: false })).toBe("gold");

    const perfectMetrics = metrics({ completed: 50, onTimeCount: 50, lateCount: 0 });
    expect(determineCreditLevel({ verify: allVerified, metrics: perfectMetrics, hasOpenIssue: false })).toBe("platinum");
  });
});
