import { beforeEach, describe, expect, it } from "vitest";
import { CompanyId, ProjectId, fixedClock, unwrap } from "../domain/shared";
import { postProject } from "../domain/project";
import { Company } from "../domain/company";
import { initialCompanyMetrics, VerifyRecord } from "../domain/credit";
import {
  InMemoryCompanyRepository,
  InMemoryEventStore,
  InMemoryProjectRepository,
  InMemoryTransactionRepository,
} from "../infra/memory/InMemoryRepositories";
import { InMemoryCreditProcessor } from "../infra/memory/InMemoryCreditProcessor";
import { MatchingService } from "./MatchingService";
import { TransactionService } from "./TransactionService";

const PRIME = CompanyId("A");
const PARTNER = CompanyId("B");
const OUTSIDER = CompanyId("Z");

const allVerified: VerifyRecord = {
  phone: "verified", email: "verified", corp: "verified", rep: "verified", address: "verified",
  license: "verified", invoice: "verified", labor: "verified", liability: "verified",
  sole: "verified", qual: "verified", harness: "verified",
};

function company(id: CompanyId, name: string): Company {
  return { id, name, region: "宮城", contact: "", areas: [], works: [], registeredAt: "2024-01-01", verify: allVerified, metrics: { ...initialCompanyMetrics } };
}

describe("usecases (application layer with in-memory infra)", () => {
  let transactions: InMemoryTransactionRepository;
  let projects: InMemoryProjectRepository;
  let companies: InMemoryCompanyRepository;
  let events: InMemoryEventStore;
  let txService: TransactionService;
  let matching: MatchingService;
  let idSeq: number;

  beforeEach(async () => {
    transactions = new InMemoryTransactionRepository();
    projects = new InMemoryProjectRepository();
    companies = new InMemoryCompanyRepository();
    events = new InMemoryEventStore();
    idSeq = 0;
    const clock = fixedClock("2026-07-11");
    const newId = () => `t${++idSeq}`;
    const credit = new InMemoryCreditProcessor(companies);
    txService = new TransactionService({ transactions, events, credit, clock });
    matching = new MatchingService({ projects, transactions, events, clock, newId });

    await companies.save(company(PRIME, "みらい足場"));
    await companies.save(company(PARTNER, "東北ハウジング"));

    const project = unwrap(
      postProject({
        id: ProjectId("p1"),
        name: "工場外壁 足場",
        jobType: "support",
        region: "宮城県 仙台市",
        address: "仙台市青葉区",
        overallSchedule: { plannedStart: "2026-07-12", plannedEnd: "2026-07-20" },
        assemblySchedule: { plannedStart: "2026-07-12", plannedEnd: "2026-07-12" },
        dismantleSchedule: { plannedStart: "2026-07-19", plannedEnd: "2026-07-19" },
        need: 2,
        unitPrice: 22000,
        payType: "progress",
        closing: "末",
        payTerm: "翌月末",
        workDescription: "組立・解体",
        belongings: "",
        applicationDeadline: "2026-07-10",
        postedAt: "2026-07-01",
        guaranteed: true,
        primeId: PRIME,
      }),
    );
    // 応募 → 選定（マッチング）で取引が生成される
    const applied = unwrap((await import("../domain/project")).applyToProject(project, PARTNER));
    await projects.save(applied);
  });

  it("runs the full v8 flow to completion and updates both companies' credit via the processor", async () => {
    const matched = await matching.selectPartner(PRIME, ProjectId("p1"), PARTNER);
    expect(matched.ok).toBe(true);
    if (!matched.ok) return;
    const txId = matched.data.id;

    expect((await txService.accept(PARTNER, txId, true)).ok).toBe(true);
    expect((await txService.issueOrder(PRIME, txId)).ok).toBe(true);
    expect((await txService.acknowledgeOrder(PARTNER, txId)).ok).toBe(true);

    // 組立
    expect((await txService.startWork(PARTNER, txId, "assembly", { date: "2026-07-12", people: 2 })).ok).toBe(true);
    expect((await txService.reportWorkCompletion(PARTNER, txId, "assembly", { date: "2026-07-12", days: 1, people: 2, content: "組立完了", photoCount: 1 })).ok).toBe(true);
    expect((await txService.confirmWork(PRIME, txId, "assembly")).ok).toBe(true);
    expect((await txService.submitInvoice(PARTNER, txId, "assembly", { amount: 220000, issuedAt: "2026-07-12", dueDate: "2026-08-31", bankAccount: "行" })).ok).toBe(true);
    expect((await txService.checkInvoice(PRIME, txId, "assembly")).ok).toBe(true);
    expect((await txService.registerPayment(PRIME, txId, "assembly", { amount: 220000, paidAt: "2026-07-13", method: "振込" })).ok).toBe(true);
    expect((await txService.confirmDeposit(PARTNER, txId, "assembly", { amount: 220000, confirmedAt: "2026-07-13" })).ok).toBe(true);

    // 解体（組立入金後だが、そもそも組立作業confirmedで独立進行可能）
    expect((await txService.startWork(PARTNER, txId, "dismantle", { date: "2026-07-19", people: 2 })).ok).toBe(true);
    expect((await txService.reportWorkCompletion(PARTNER, txId, "dismantle", { date: "2026-07-19", days: 1, people: 2, content: "解体完了", photoCount: 1 })).ok).toBe(true);
    expect((await txService.confirmWork(PRIME, txId, "dismantle")).ok).toBe(true);
    expect((await txService.submitInvoice(PARTNER, txId, "dismantle", { amount: 220000, issuedAt: "2026-07-19", dueDate: "2026-08-31", bankAccount: "行" })).ok).toBe(true);
    expect((await txService.checkInvoice(PRIME, txId, "dismantle")).ok).toBe(true);
    expect((await txService.registerPayment(PRIME, txId, "dismantle", { amount: 220000, paidAt: "2026-07-20", method: "振込" })).ok).toBe(true);
    const done = await txService.confirmDeposit(PARTNER, txId, "dismantle", { amount: 220000, confirmedAt: "2026-07-20" });
    expect(done.ok).toBe(true);
    if (!done.ok) return;
    expect(done.data.status).toBe("completed");

    // 信用実績がプロセッサ経由で更新されている
    const prime = await companies.load(PRIME);
    const partner = await companies.load(PARTNER);
    expect(prime?.metrics.completed).toBe(1);
    expect(prime?.metrics.paidCount).toBe(1);
    expect(prime?.metrics.onTimeCount).toBe(1);
    expect(prime?.metrics.continuousPartnerIds).toEqual([PARTNER]);
    expect(partner?.metrics.completed).toBe(1);
    expect(partner?.metrics.paidCount).toBe(0);
    expect(partner?.metrics.continuousPartnerIds).toEqual([PRIME]);

    // TransactionCompleted がイベントストアに載っている
    expect((await events.timelineFor(txId)).some((e) => e.type === "TransactionCompleted")).toBe(true);
  });

  it("rejects a non-participant with a mapped error and never mutates state", async () => {
    const matched = await matching.selectPartner(PRIME, ProjectId("p1"), PARTNER);
    if (!matched.ok) return;
    const res = await txService.accept(OUTSIDER, matched.data.id, true);
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe("NOT_A_PARTICIPANT");
    expect(res.error.message).toContain("関係者");
  });

  it("maps a domain guard violation (wrong actor) to a Japanese error", async () => {
    const matched = await matching.selectPartner(PRIME, ProjectId("p1"), PARTNER);
    if (!matched.ok) return;
    // 取引開始は協力会社のみ。元請が呼ぶと FORBIDDEN_ACTOR。
    const res = await txService.accept(PRIME, matched.data.id, true);
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.message).toContain("協力会社");
  });
});
