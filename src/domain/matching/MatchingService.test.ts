import { describe, expect, it } from "vitest";
import { CompanyId, ProjectId, TransactionId, unwrap } from "../shared";
import { applyToProject, postProject } from "../project";
import { selectPartnerForProject } from "./MatchingService";

const PRIME = CompanyId("A");
const PARTNER_B = CompanyId("B");
const PARTNER_C = CompanyId("C");

function recruitingProject() {
  const project = unwrap(
    postProject({
      id: ProjectId("p1"),
      name: "マンション改修 足場（組立・解体）",
      jobType: "support",
      region: "宮城県 仙台市",
      address: "仙台市青葉区国分町2-1",
      overallSchedule: { plannedStart: "2026-08-01", plannedEnd: "2026-08-22" },
      assemblySchedule: { plannedStart: "2026-08-01", plannedEnd: "2026-08-02" },
      dismantleSchedule: { plannedStart: "2026-08-20", plannedEnd: "2026-08-21" },
      need: 2,
      unitPrice: 22000,
      payType: "progress",
      closing: "末",
      payTerm: "翌月末",
      workDescription: "6階建てマンション改修。",
      belongings: "ヘルメット・フルハーネス・安全靴・革手袋",
      applicationDeadline: "2026-07-28",
      postedAt: "2026-07-10",
      guaranteed: true,
      primeId: PRIME,
    }),
  );
  return unwrap(applyToProject(unwrap(applyToProject(project, PARTNER_B)), PARTNER_C));
}

describe("selectPartnerForProject", () => {
  it("opens a single-phase transaction for a support job (full amount on the work phase, no dismantle)", () => {
    const project = recruitingProject();
    const result = unwrap(
      selectPartnerForProject(project, PARTNER_B, { transactionId: TransactionId("t1"), chatKey: "p1:B", at: "2026-07-10" }),
    );

    expect(result.project.stage).toBe("matched");
    expect(result.transaction.primeId).toBe(PRIME);
    expect(result.transaction.partnerId).toBe(PARTNER_B);
    // 応援は単相：全額（日額×人数）を作業フェーズに置き、解体は使わない。
    expect(result.transaction.phases.assembly.amount).toBe(44000);
    expect(result.transaction.phases.dismantle.amount).toBeNull();
    expect(result.events.some((event) => event.name === "ProjectMatched")).toBe(true);
  });

  it("rejects selecting a company that never applied", () => {
    const project = recruitingProject();
    const result = selectPartnerForProject(project, CompanyId("D"), { transactionId: TransactionId("t2"), chatKey: "p1:D", at: "2026-07-10" });
    expect(result.ok).toBe(false);
  });

  it("rejects selecting a partner twice for the same project", () => {
    const project = recruitingProject();
    const first = unwrap(selectPartnerForProject(project, PARTNER_B, { transactionId: TransactionId("t1"), chatKey: "p1:B", at: "2026-07-10" }));
    const second = selectPartnerForProject(first.project, PARTNER_C, { transactionId: TransactionId("t3"), chatKey: "p1:C", at: "2026-07-10" });
    expect(second.ok).toBe(false);
  });
});
