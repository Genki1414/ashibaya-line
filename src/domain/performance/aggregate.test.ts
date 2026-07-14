import { describe, expect, it } from "vitest";
import { CompanyId, TransactionId, unwrap, money, type IsoDate } from "../shared";
import { createTransaction, type Transaction } from "../transaction";
import {
  startWork,
  reportWorkCompletion,
  confirmWork,
  requestRework,
  completeRework,
  submitInvoice,
  checkInvoice,
  registerPayment,
  confirmDeposit,
} from "../transaction/commands";
import type { CommandResult } from "../transaction/commands";
import type { WorkReport } from "../work";
import { aggregateForCompany, rateText, type PerfEntry, type PerfEvent } from "./index";

/** DomainEvent[]（name/payload/occurredAt）を集計入力の PerfEvent[] に変換。 */
function toPerf(events: readonly { name: string; payload: unknown; occurredAt: IsoDate }[]): PerfEvent[] {
  return events.map((e) => ({ type: e.name, payload: (e.payload ?? {}) as Record<string, unknown>, occurredAt: e.occurredAt }));
}

function base(id: string, primeId: string, partnerId: string, plannedEnd: string | null, amount = 100000): Transaction {
  return createTransaction({
    id: TransactionId(id),
    projectName: "現場" + id,
    jobType: "support",
    region: "宮城県",
    address: "",
    need: null,
    payType: "progress",
    closing: "末",
    payTerm: "翌月末",
    primeId: CompanyId(primeId),
    partnerId: CompanyId(partnerId),
    guaranteed: false,
    chatKey: id,
    overallSchedule: { plannedStart: "2026-01-01", plannedEnd: plannedEnd },
    assemblySchedule: { plannedStart: "2026-01-01", plannedEnd: plannedEnd },
    dismantleSchedule: { plannedStart: null, plannedEnd: null },
    assemblyAmount: unwrap(money(amount)),
    dismantleAmount: null,
  });
}

interface Flow {
  completionDate: string;
  dueDate: string;
  paidAt: string;
  rework?: boolean;
}

/** 単一フェーズ（応援）の取引を、実コマンドで完了まで進めて {最終状態, イベント列} を得る。 */
function completeSupport(tx0: Transaction, f: Flow): PerfEntry {
  let t = tx0;
  const evs: { name: string; payload: unknown; occurredAt: IsoDate }[] = [];
  const step = (r: ReturnType<typeof startWork>) => {
    const cr: CommandResult = unwrap(r);
    t = cr.transaction;
    evs.push(...cr.events);
  };
  const report: WorkReport = { date: f.completionDate, days: 1, people: 2, content: "完了", photoCount: 0 };
  step(startWork(t, "assembly", "partner", { date: "2026-01-05", people: 2 }, "2026-01-05"));
  step(reportWorkCompletion(t, "assembly", "partner", report, f.completionDate));
  if (f.rework) {
    step(requestRework(t, "assembly", "prime", "手直しお願いします", f.completionDate));
    step(completeRework(t, "assembly", "partner", f.completionDate));
  }
  step(confirmWork(t, "assembly", "prime", f.completionDate));
  step(submitInvoice(t, "assembly", "partner", { amount: 100000, issuedAt: "2026-02-01", dueDate: f.dueDate, bankAccount: "x" }, "2026-02-01"));
  step(checkInvoice(t, "assembly", "prime", "2026-02-02"));
  step(registerPayment(t, "assembly", "prime", { amount: 100000, paidAt: f.paidAt, method: "銀行振込" }, f.paidAt));
  step(confirmDeposit(t, "assembly", "partner", { amount: 100000, confirmedAt: f.paidAt }, f.paidAt));
  return { tx: t, events: toPerf(evs) };
}

/** 請求書提出＋確認まで進めた「未入金（進行中）」の取引。 */
function unpaidInProgress(tx0: Transaction): PerfEntry {
  let t = tx0;
  const evs: { name: string; payload: unknown; occurredAt: IsoDate }[] = [];
  const step = (r: ReturnType<typeof startWork>) => {
    const cr: CommandResult = unwrap(r);
    t = cr.transaction;
    evs.push(...cr.events);
  };
  const report: WorkReport = { date: "2026-01-18", days: 1, people: 2, content: "完了", photoCount: 0 };
  step(startWork(t, "assembly", "partner", { date: "2026-01-05", people: 2 }, "2026-01-05"));
  step(reportWorkCompletion(t, "assembly", "partner", report, "2026-01-18"));
  step(confirmWork(t, "assembly", "prime", "2026-01-19"));
  step(submitInvoice(t, "assembly", "partner", { amount: 100000, issuedAt: "2026-02-01", dueDate: "2026-02-28", bankAccount: "x" }, "2026-02-01"));
  step(checkInvoice(t, "assembly", "prime", "2026-02-02"));
  // 支払い未登録のまま（未入金）
  return { tx: t, events: toPerf(evs) };
}

const A = "A"; // 元請
const B = "B"; // 協力（Aと2件＝継続）
const C = "C"; // 協力（1件、是正あり）

// txA: A→B 予定内完了・期日内支払い
const txA = completeSupport(base("txA", A, B, "2026-01-20"), { completionDate: "2026-01-18", dueDate: "2026-02-28", paidAt: "2026-02-20" });
// txB: A→B 予定超過・支払い遅延
const txB = completeSupport(base("txB", A, B, "2026-02-20"), { completionDate: "2026-02-25", dueDate: "2026-03-31", paidAt: "2026-04-10" });
// txC: A→C 是正発生→解決、期日内
const txC = completeSupport(base("txC", A, C, "2026-01-20"), { completionDate: "2026-01-18", dueDate: "2026-02-28", paidAt: "2026-02-20", rework: true });
// txD: A→C 未入金・進行中
const txD = unpaidInProgress(base("txD", A, C, "2026-03-20"));
// txCancel: A→B 中止（将来イベントを模擬。集計は受け入れて件数化し、他指標からは除外）
const txCancel: PerfEntry = {
  tx: base("txCancel", A, B, "2026-04-20"),
  events: [{ type: "TransactionCancelled", payload: { timing: "before_start", reason: "mutual" }, occurredAt: "2026-04-10" }],
};

const allEntries = [txA, txB, txC, txD, txCancel];

describe("aggregateForCompany 元請実績", () => {
  const a = aggregateForCompany(A, allEntries).asPrime;
  it("取引完了・支払い・期日内/遅延・平均支払日数", () => {
    expect(a.completed).toBe(3); // txA, txB, txC（txCancel除外・txD未完了）
    expect(a.paid).toBe(3); // 完了3件は支払い済み
    expect(a.paidOnTime).toBe(2); // txA, txC
    expect(a.paidLate).toBe(1); // txB
    expect(a.avgPayDaysBase).toBe(3);
    expect(a.avgPayDays).not.toBeNull();
  });
  it("未入金・未解決確認事項・継続取引・中止", () => {
    expect(a.unpaid).toBe(1); // txD
    expect(a.repeatPartners).toBe(1); // B が2件完了
    expect(a.cancelled).toBe(1); // txCancel
    expect(a.openIssues).toBe(0);
  });
});

describe("aggregateForCompany 協力会社実績", () => {
  it("B: 完了・予定遵守/超過・継続・中止", () => {
    const b = aggregateForCompany(B, allEntries).asPartner;
    expect(b.completed).toBe(2); // txA, txB
    expect(b.workConfirmed).toBe(2);
    expect(b.onSchedule).toBe(1); // txA
    expect(b.overSchedule).toBe(1); // txB
    expect(b.scheduleBase).toBe(2);
    expect(b.repeatPrimes).toBe(1); // A が2件
    expect(b.cancelled).toBe(1);
    expect(b.reworkRaised).toBe(0);
  });
  it("C: 是正発生→解決", () => {
    const c = aggregateForCompany(C, allEntries).asPartner;
    expect(c.completed).toBe(1); // txC（txD未完了）
    expect(c.reworkRaised).toBe(1);
    expect(c.reworkResolved).toBe(1); // 完了確認済み
    expect(c.reworkOpen).toBe(0);
  });
});

describe("冪等性・順序非依存・差分==全再計算", () => {
  it("同じ入力での再実行は同一結果（純粋・冪等）", () => {
    expect(aggregateForCompany(A, allEntries)).toEqual(aggregateForCompany(A, allEntries));
  });
  it("取引の順序を変えても結果は同一", () => {
    const shuffled = [txCancel, txD, txC, txB, txA];
    expect(aggregateForCompany(A, shuffled)).toEqual(aggregateForCompany(A, allEntries));
    expect(aggregateForCompany(B, shuffled)).toEqual(aggregateForCompany(B, allEntries));
  });
  it("差分更新（完了ごとに関係社を全再計算）の最終結果＝全再計算", () => {
    // 本設計では差分更新＝該当社を全再計算。取引を1件ずつ足しながら再計算した最終値が
    // 全件一括の再計算と一致することを確認する。
    const full = aggregateForCompany(A, allEntries);
    let acc = aggregateForCompany(A, []);
    for (let i = 1; i <= allEntries.length; i++) {
      acc = aggregateForCompany(A, allEntries.slice(0, i));
    }
    expect(acc).toEqual(full);
  });
});

describe("完了予定日の後付け変更で実績を書き換えられない", () => {
  it("完了後に工期終了を延ばしても『超過』判定は変わらない", () => {
    // 予定終了 2026-01-20、実完了 2026-01-25（超過）。完了後に予定終了を 2026-01-31 に延長。
    const entry = completeSupport(base("txLate", A, B, "2026-01-20"), { completionDate: "2026-01-25", dueDate: "2026-02-28", paidAt: "2026-02-20" });
    const tampered: PerfEntry = {
      tx: { ...entry.tx, overallSchedule: { ...entry.tx.overallSchedule, plannedEnd: "2026-01-31" } },
      events: [
        ...entry.events,
        // 完了(01-25)より後(02-01)に「工期終了」を 01-20→01-31 へ変更したイベント
        { type: "ScheduleChanged", payload: { changes: [{ field: "工期終了", from: "2026-01-20", to: "2026-01-31" }] }, occurredAt: "2026-02-01" },
      ],
    };
    const b = aggregateForCompany(B, [tampered]).asPartner;
    expect(b.overSchedule).toBe(1); // 合意済み予定(01-20)基準で超過のまま
    expect(b.onSchedule).toBe(0);
  });
});

describe("rateText（母数併記）", () => {
  it("母数付きで率を表示", () => {
    expect(rateText(2, 2)).toBe("100%（2件中2件）");
    expect(rateText(1, 2)).toBe("50%（2件中1件）");
  });
  it("母数0は率を出さない", () => {
    expect(rateText(0, 0)).toBe("—（0件）");
  });
});
