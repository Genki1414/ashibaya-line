import { describe, expect, it } from "vitest";
import { CompanyId, ProjectId } from "../shared";
import { applyToProject, withdrawApplication, pauseProject, resumeProject, closeProject, canViewRequirements, grantDisclosure } from "./Project";
import { postProject } from "./Project";
import type { Project, ProjectStage } from "./types";

/**
 * 案件ライフサイクルのアクセス制御・状態遷移の網羅テスト（品質強化パス）。
 * 第三者拒否・自社応募拒否・重複拒否・不正遷移拒否・募集要項の許可制を固定する。
 */

const PRIME = CompanyId("A");
const B = CompanyId("B");
const C = CompanyId("C");

function base(): Project {
  const r = postProject({
    id: ProjectId("p1"),
    name: "テスト案件",
    jobType: "support",
    region: "宮城県 仙台市",
    address: "青葉区1-1",
    overallSchedule: { plannedStart: "2026-08-01", plannedEnd: "2026-08-10" },
    assemblySchedule: { plannedStart: "2026-08-01", plannedEnd: "2026-08-02" },
    dismantleSchedule: { plannedStart: "2026-08-09", plannedEnd: "2026-08-10" },
    need: 2,
    unitPrice: 22000,
    payType: "progress",
    closing: "末",
    payTerm: "翌月末",
    workDescription: "作業内容",
    belongings: "ヘルメット",
    applicationDeadline: "2026-07-28",
    postedAt: "2026-07-10",
    guaranteed: true,
    primeId: PRIME,
  });
  if (!r.ok) throw r.error;
  return r.value;
}

const at = (stage: ProjectStage, over: Partial<Project> = {}): Project => ({ ...base(), stage, ...over });

function code(r: ReturnType<typeof applyToProject>): string | null {
  return r.ok ? null : r.error.code;
}

describe("applyToProject の可否（stage×関係）", () => {
  it("募集中のみ応募でき、停止/選定済/終了は専用エラー", () => {
    expect(applyToProject(at("recruiting"), B).ok).toBe(true);
    expect(code(applyToProject(at("paused"), B))).toBe("PROJECT_PAUSED");
    expect(code(applyToProject(at("matched"), B))).toBe("PROJECT_NOT_RECRUITING");
    expect(code(applyToProject(at("closed"), B))).toBe("PROJECT_CLOSED");
  });
  it("自社案件への応募は拒否", () => {
    expect(code(applyToProject(at("recruiting"), PRIME))).toBe("SELF_APPLICATION");
  });
  it("重複応募は拒否", () => {
    const applied = at("recruiting", { applicantIds: [B] });
    expect(code(applyToProject(applied, B))).toBe("ALREADY_APPLIED");
    expect(applyToProject(applied, C).ok).toBe(true); // 別会社は応募可
  });
});

describe("pause / resume の可否", () => {
  it("pauseは募集中のみ", () => {
    expect(pauseProject(at("recruiting")).ok).toBe(true);
    expect(code(pauseProject(at("paused")))).toBe("NOT_RECRUITING");
    expect(code(pauseProject(at("matched")))).toBe("NOT_RECRUITING");
    expect(code(pauseProject(at("closed")))).toBe("NOT_RECRUITING");
  });
  it("resumeは停止中のみ", () => {
    expect(resumeProject(at("paused")).ok).toBe(true);
    expect(code(resumeProject(at("recruiting")))).toBe("NOT_PAUSED");
    expect(code(resumeProject(at("matched")))).toBe("NOT_PAUSED");
    expect(code(resumeProject(at("closed")))).toBe("NOT_PAUSED");
  });
});

describe("close（削除）の可否", () => {
  it("募集中・停止中は削除でき、選定済は不可、終了済は二重削除不可", () => {
    expect(closeProject(at("recruiting")).ok).toBe(true);
    expect(closeProject(at("paused")).ok).toBe(true);
    expect(code(closeProject(at("matched")))).toBe("PROJECT_MATCHED");
    expect(code(closeProject(at("closed")))).toBe("ALREADY_CLOSED");
  });
});

describe("withdrawApplication の可否", () => {
  it("選定済では取り消せない／未応募は拒否／募集中・停止中は取り消せる", () => {
    expect(code(withdrawApplication(at("matched", { applicantIds: [B] }), B))).toBe("PROJECT_MATCHED");
    expect(code(withdrawApplication(at("recruiting", { applicantIds: [B] }), C))).toBe("NOT_APPLIED");
    expect(withdrawApplication(at("recruiting", { applicantIds: [B] }), B).ok).toBe(true);
    expect(withdrawApplication(at("paused", { applicantIds: [B] }), B).ok).toBe(true);
  });
});

describe("募集要項の閲覧可否（許可制・第三者拒否）", () => {
  it("未ログイン・空IDは常に不可", () => {
    expect(canViewRequirements(base(), null)).toBe(false);
    expect(canViewRequirements(base(), "")).toBe(false);
  });
  it("元請本人は stage を問わず閲覧可", () => {
    for (const s of ["recruiting", "paused", "matched", "closed"] as ProjectStage[]) {
      expect(canViewRequirements(at(s), "A")).toBe(true);
    }
  });
  it("応募しただけの会社は詳細を見られない（許可が必要）", () => {
    const applied = at("recruiting", { applicantIds: [B] });
    expect(canViewRequirements(applied, "B")).toBe(false);
  });
  it("元請が許可した会社のみ閲覧可、他社は不可", () => {
    const granted = grantDisclosure(at("recruiting", { applicantIds: [B, C] }), B);
    if (!granted.ok) throw granted.error;
    expect(canViewRequirements(granted.value, "B")).toBe(true);
    expect(canViewRequirements(granted.value, "C")).toBe(false);
  });
  it("選定会社は許可なしでも閲覧可（isSelectedPartner）", () => {
    expect(canViewRequirements(at("matched"), "B", true)).toBe(true);
  });
});
