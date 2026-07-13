import { describe, expect, it } from "vitest";
import { CompanyId, ProjectId, TransactionId, money, unwrap } from "../domain/shared";
import * as cmd from "../domain/transaction/commands";
import { createTransaction } from "../domain/transaction/factory";
import { Company } from "../domain/company";
import { postProject } from "../domain/project";
import { initialCompanyMetrics, VerifyRecord } from "../domain/credit";
import {
  companyToRow,
  projectToRow,
  rowToCompany,
  rowToProject,
  rowToTransaction,
  transactionToRow,
} from "./supabase/mappers";
import {
  InMemoryCompanyRepository,
  InMemoryProjectRepository,
  InMemoryTransactionRepository,
} from "./memory/InMemoryRepositories";

const PRIME = CompanyId("A");
const PARTNER = CompanyId("B");

function mustMoney(n: number) {
  return unwrap(money(n));
}

/** rework・入金差額→解決・両フェーズ deposited・工期変更・AshiBase連携・注文/請書まで進めた「濃い」取引を作る。 */
function richTransaction() {
  let tx = createTransaction({
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
  const step = (r: ReturnType<typeof cmd.startTransaction>) => {
    tx = unwrap(r).transaction;
  };
  step(cmd.startTransaction(tx, "partner", "2026-07-08", true));
  step(cmd.issueOrder(tx, "prime", "2026-07-08"));
  step(cmd.acknowledgeOrder(tx, "partner", "2026-07-08"));
  step(cmd.linkAshiBase(tx, "prime", "2026-07-08"));
  step(cmd.changeSchedule(tx, "prime", { dismantleSchedule: { plannedStart: "2026-08-06", plannedEnd: "2026-08-07" } }, "2026-07-08"));
  step(cmd.acknowledgeSchedule(tx, "partner", "2026-07-08"));
  step(cmd.startWork(tx, "assembly", "partner", { date: "2026-07-08", people: 2 }, "2026-07-08"));
  step(cmd.recordDailySession(tx, "assembly", "partner", { date: "2026-07-08", kind: "end", people: 2, note: "1層目" }, "2026-07-08"));
  step(cmd.reportWorkCompletion(tx, "assembly", "partner", { date: "2026-07-09", days: 2, people: 2, content: "組立完了", photoCount: 2 }, "2026-07-09"));
  step(cmd.requestRework(tx, "assembly", "prime", "手すりの隙間を是正してください", "2026-07-09"));
  step(cmd.completeRework(tx, "assembly", "partner", "2026-07-10"));
  step(cmd.confirmWork(tx, "assembly", "prime", "2026-07-10"));
  step(cmd.submitInvoice(tx, "assembly", "partner", { amount: 220000, issuedAt: "2026-07-10", dueDate: "2026-08-31", bankAccount: "七十七 1234567" }, "2026-07-10"));
  step(cmd.checkInvoice(tx, "assembly", "prime", "2026-07-10"));
  step(cmd.registerPayment(tx, "assembly", "prime", { amount: 220000, paidAt: "2026-07-11", method: "銀行振込" }, "2026-07-11"));
  // 入金差額 → 確認事項 → 解決 → 正しい額で再確認
  const mismatch = unwrap(cmd.confirmDeposit(tx, "assembly", "partner", { amount: 210000, confirmedAt: "2026-07-11" }, "2026-07-11"));
  tx = mismatch.transaction;
  step(cmd.resolveIssue(tx, "prime", "2026-07-11"));
  step(cmd.confirmDeposit(tx, "assembly", "partner", { amount: 220000, confirmedAt: "2026-07-12" }, "2026-07-12"));
  step(cmd.requestConsultation(tx, "partner", "念のため記録します", "2026-07-12"));
  return tx;
}

describe("persistence contract: mapper round-trip through the JSONB boundary", () => {
  it("restores a richly-populated transaction identically", () => {
    const tx = richTransaction();
    const row = JSON.parse(JSON.stringify(transactionToRow(tx)));
    expect(rowToTransaction(row)).toEqual(tx);
  });

  it("denormalizes amount/category/status columns from state", () => {
    const tx = richTransaction();
    const row = transactionToRow(tx);
    expect(row.amount).toBe(440000);
    expect(row.assembly_amount).toBe(220000);
    expect(row.dismantle_amount).toBe(220000);
    expect(row.category).toBe("active"); // assembly deposited, dismantle still waiting
    expect(row.status).toBe("in_progress");
    expect(row.prime_id).toBe("A");
    expect(row.partner_id).toBe("B");
  });

  it("restores a company (verify + metrics jsonb) identically", () => {
    const verify = {
      phone: "verified", email: "verified", corp: "verified", rep: "verified", address: "verified",
      license: "verified", invoice: "verified", labor: "verified", liability: "reviewing",
      sole: "none", qual: "verified", harness: "reviewing",
    } as VerifyRecord;
    const company: Company = {
      id: PRIME,
      name: "株式会社みらい足場",
      region: "宮城県 仙台市",
      contact: "佐藤 誠",
      areas: ["宮城", "山形", "福島"],
      works: ["くさび足場", "単管"],
      registeredAt: "2024-03-01",
      verify,
      metrics: { ...initialCompanyMetrics, completed: 24, paidCount: 24, onTimeCount: 24, avgPayDays: 28, continuousPartnerIds: [PARTNER] },
      status: "active",
    };
    const row = JSON.parse(JSON.stringify(companyToRow(company)));
    expect(rowToCompany(row)).toEqual(company);
  });

  it("restores a project identically", () => {
    const project = unwrap(
      postProject({
        id: ProjectId("p1"),
        name: "マンション改修 足場",
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
        belongings: "ヘルメット・フルハーネス",
        applicationDeadline: "2026-07-28",
        postedAt: "2026-07-10",
        guaranteed: true,
        primeId: PRIME,
      }),
    );
    const row = JSON.parse(JSON.stringify(projectToRow(project)));
    expect(rowToProject(row)).toEqual(project);
    expect(row.unit_price).toBe(22000);
    expect(row.stage).toBe("recruiting");
  });
});

describe("persistence contract: repository save -> load full restoration", () => {
  it("TransactionRepository round-trips the aggregate and filters by company", async () => {
    const repo = new InMemoryTransactionRepository();
    const tx = richTransaction();
    await repo.save(tx);

    const loaded = await repo.load(tx.id);
    expect(loaded).toEqual(tx);

    expect((await repo.listForCompany(PRIME)).map((t) => t.id)).toEqual([tx.id]);
    expect((await repo.listForCompany(PARTNER)).map((t) => t.id)).toEqual([tx.id]);
    expect(await repo.listForCompany(CompanyId("Z"))).toEqual([]);
  });

  it("CompanyRepository and ProjectRepository round-trip", async () => {
    const companies = new InMemoryCompanyRepository();
    const company: Company = {
      id: PARTNER,
      name: "東北ハウジング工業",
      region: "宮城県 名取市",
      contact: "高橋 亮",
      areas: ["宮城"],
      works: ["新築足場"],
      registeredAt: "2025-09-15",
      verify: {
        phone: "verified", email: "verified", corp: "verified", rep: "verified", address: "verified",
        license: "verified", invoice: "verified", labor: "verified", liability: "reviewing",
        sole: "none", qual: "verified", harness: "reviewing",
      } as VerifyRecord,
      metrics: { ...initialCompanyMetrics, completed: 5, paidCount: 5, onTimeCount: 4, lateCount: 1, avgPayDays: 33 },
      status: "active",
    };
    await companies.save(company);
    expect(await companies.load(PARTNER)).toEqual(company);

    const projects = new InMemoryProjectRepository();
    const project = unwrap(
      postProject({
        id: ProjectId("p2"),
        name: "戸建て新築 足場一式",
        jobType: "contract",
        region: "宮城県 名取市",
        address: "名取市増田",
        overallSchedule: { plannedStart: "2026-08-03", plannedEnd: "2026-08-06" },
        assemblySchedule: { plannedStart: "2026-08-03", plannedEnd: "2026-08-03" },
        dismantleSchedule: { plannedStart: "2026-08-06", plannedEnd: "2026-08-06" },
        need: null,
        unitPrice: 240000,
        payType: "lump",
        closing: "末",
        payTerm: "翌月15",
        workDescription: "木造2階建て新築の外部足場架設・解体を一式請負。",
        belongings: "ヘルメット・フルハーネス",
        applicationDeadline: "2026-07-30",
        postedAt: "2026-07-09",
        guaranteed: false,
        primeId: PRIME,
      }),
    );
    await projects.save(project);
    expect(await projects.load(ProjectId("p2"))).toEqual(project);
    expect((await projects.listRecruiting()).map((p) => p.id)).toEqual([project.id]);
  });
});
