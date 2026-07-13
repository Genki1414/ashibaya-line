import { describe, expect, it } from "vitest";
import { CompanyId, ProjectId, unwrap } from "../shared";
import { applyToProject, contractAmount, editProject, postProject } from "./Project";

const PRIME = CompanyId("A");
const PARTNER_B = CompanyId("B");
const PARTNER_C = CompanyId("C");

function post(overrides: Partial<Parameters<typeof postProject>[0]> = {}) {
  const result = postProject({
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
    workDescription: "6階建てマンション改修。組立後、外壁改修期間を経て解体。",
    belongings: "ヘルメット・フルハーネス・安全靴・革手袋",
    applicationDeadline: "2026-07-28",
    postedAt: "2026-07-10",
    guaranteed: true,
    primeId: PRIME,
    ...overrides,
  });
  if (!result.ok) throw result.error;
  return result.value;
}

describe("Project", () => {
  it("starts in recruiting stage with no applicants", () => {
    const project = post();
    expect(project.stage).toBe("recruiting");
    expect(project.applicantIds).toEqual([]);
  });

  it("rejects an invalid headcount", () => {
    const result = postProject({
      id: ProjectId("p1"),
      name: "x",
      jobType: "support",
      region: "x",
      address: "x",
      overallSchedule: { plannedStart: null, plannedEnd: null },
      assemblySchedule: { plannedStart: null, plannedEnd: null },
      dismantleSchedule: { plannedStart: null, plannedEnd: null },
      need: 0,
      unitPrice: 1000,
      payType: "progress",
      closing: "末",
      payTerm: "翌月末",
      workDescription: "",
      belongings: "",
      applicationDeadline: "2026-07-28",
      postedAt: "2026-07-10",
      guaranteed: false,
      primeId: PRIME,
    });
    expect(result.ok).toBe(false);
  });

  it("accepts applications but rejects duplicates and self-applications", () => {
    let project = post();
    project = unwrap(applyToProject(project, PARTNER_B));
    project = unwrap(applyToProject(project, PARTNER_C));
    expect(project.applicantIds).toEqual([PARTNER_B, PARTNER_C]);

    expect(applyToProject(project, PARTNER_B).ok).toBe(false);
    expect(applyToProject(project, PRIME).ok).toBe(false);
  });

  it("computes support-job amounts as unit price times headcount (defaulting to 2)", () => {
    const project = post({ jobType: "support", unitPrice: 22000, need: 2 });
    expect(contractAmount(project)).toBe(44000);

    const projectNoNeed = post({ jobType: "support", unitPrice: 22000, need: null });
    expect(contractAmount(projectNoNeed)).toBe(44000);
  });

  it("computes contract-job amounts as the flat price", () => {
    const project = post({ jobType: "contract", unitPrice: 240000, need: null });
    expect(contractAmount(project)).toBe(240000);
  });

  const editInput = {
    name: "改題した案件",
    jobType: "contract" as const,
    region: "宮城県 名取市",
    address: "名取市増田",
    overallSchedule: { plannedStart: "2026-09-01", plannedEnd: "2026-09-05" },
    assemblySchedule: { plannedStart: "2026-09-01", plannedEnd: "2026-09-01" },
    dismantleSchedule: { plannedStart: "2026-09-05", plannedEnd: "2026-09-05" },
    need: null,
    unitPrice: 300000,
    payType: "lump" as const,
    closing: "末" as const,
    payTerm: "翌月15" as const,
    workDescription: "内容を更新",
    belongings: "ヘルメット",
    applicationDeadline: "2026-08-25",
    guaranteed: false,
  };

  it("edits a recruiting project while preserving id, prime, and applicants", () => {
    let project = post();
    project = unwrap(applyToProject(project, PARTNER_B));
    const edited = unwrap(editProject(project, editInput));
    expect(edited.id).toBe(project.id);
    expect(edited.primeId).toBe(PRIME);
    expect(edited.applicantIds).toEqual([PARTNER_B]);
    expect(edited.name).toBe("改題した案件");
    expect(edited.unitPrice).toBe(300000);
    expect(edited.guaranteed).toBe(false);
    expect(edited.stage).toBe("recruiting");
  });

  it("rejects editing a project that is no longer recruiting", () => {
    const matched = { ...post(), stage: "matched" as const };
    expect(editProject(matched, editInput).ok).toBe(false);
  });

  it("rejects an invalid headcount on edit", () => {
    const project = post();
    expect(editProject(project, { ...editInput, need: 0 }).ok).toBe(false);
  });
});
