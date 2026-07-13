import { CompanyId, Money, TransactionId, fixedClock, money, unwrap } from "../domain/shared";
import { Company } from "../domain/company";
import { VerifyRecord, initialCompanyMetrics } from "../domain/credit";
import { Transaction, createTransaction } from "../domain/transaction";
import * as cmd from "../domain/transaction";
import {
  InMemoryCompanyRepository,
  InMemoryEventStore,
  InMemoryProjectRepository,
  InMemoryTransactionRepository,
} from "../infra/memory/InMemoryRepositories";
import { InMemoryCreditProcessor } from "../infra/memory/InMemoryCreditProcessor";

/**
 * 開発／デモ用のインメモリ・バックエンド。Supabase の環境変数が無いときに使う。
 * v8 プロトタイプの操作フローを、DBなしでも擬似ログイン切替つきで一通り再現するための土台。
 * next dev（単一プロセス）では globalThis 経由で状態が保持される。
 */

const allV: VerifyRecord = {
  phone: "verified", email: "verified", corp: "verified", rep: "verified", address: "verified",
  license: "verified", invoice: "verified", labor: "verified", liability: "verified",
  sole: "verified", qual: "verified", harness: "verified",
};
const partV: VerifyRecord = { ...allV, liability: "reviewing", sole: "none", harness: "reviewing" };
const noneV: VerifyRecord = {
  phone: "verified", email: "reviewing", corp: "none", rep: "none", address: "none",
  license: "none", invoice: "none", labor: "none", liability: "none", sole: "none", qual: "none", harness: "none",
};

function company(
  id: string,
  name: string,
  region: string,
  contact: string,
  verify: VerifyRecord,
  m: Partial<typeof initialCompanyMetrics>,
  registeredAt: string,
): Company {
  return { id: CompanyId(id), name, region, contact, areas: [], works: [], registeredAt, verify, metrics: { ...initialCompanyMetrics, ...m } };
}

const SEED_COMPANIES: Company[] = [
  company("A", "株式会社みらい足場", "宮城県 仙台市", "佐藤 誠", allV, { completed: 24, paidCount: 24, onTimeCount: 24, avgPayDays: 28 }, "2024-03-01"),
  company("B", "東北ハウジング工業", "宮城県 名取市", "高橋 亮", partV, { completed: 5, paidCount: 5, onTimeCount: 4, lateCount: 1, avgPayDays: 33 }, "2025-09-15"),
  company("C", "郡山スカイ足場", "福島県 郡山市", "渡辺 健", noneV, {}, "2026-07-07"),
  company("D", "仙台建装ワークス", "宮城県 仙台市", "伊藤 学", allV, { completed: 31, paidCount: 31, onTimeCount: 30, lateCount: 1, avgPayDays: 30 }, "2025-01-20"),
];

const CLOCK = fixedClock("2026-07-11");
const AT = CLOCK.today();
const yen = (n: number): Money => unwrap(money(n));

function progressTx(id: string, name: string, partnerId: string): Transaction {
  return createTransaction({
    id: TransactionId(id),
    projectName: name,
    jobType: "support",
    region: "宮城県 仙台市",
    address: "仙台市青葉区",
    need: 2,
    payType: "progress",
    closing: "末",
    payTerm: "翌月末",
    primeId: CompanyId("A"),
    partnerId: CompanyId(partnerId),
    guaranteed: true,
    chatKey: `${id}:${partnerId}`,
    overallSchedule: { plannedStart: "2026-07-08", plannedEnd: "2026-08-05" },
    assemblySchedule: { plannedStart: "2026-07-08", plannedEnd: "2026-07-09" },
    dismantleSchedule: { plannedStart: "2026-08-04", plannedEnd: "2026-08-05" },
    assemblyAmount: yen(220000),
    dismantleAmount: yen(220000),
  });
}

type Step = (t: Transaction) => Transaction;
const step = (fn: (t: Transaction) => ReturnType<typeof cmd.startTransaction>): Step => (t) => unwrap(fn(t)).transaction;
const drive = (tx: Transaction, steps: Step[]): Transaction => steps.reduce((acc, s) => s(acc), tx);

function seedTransactions(): Transaction[] {
  // 1) 組立の完了報告済み → 元請の「完了確認 / 是正依頼」が要対応
  const t1 = drive(progressTx("t1", "工場外壁 足場（組立・解体）", "B"), [
    step((t) => cmd.startTransaction(t, "partner", AT)),
    step((t) => cmd.issueOrder(t, "prime", AT)),
    step((t) => cmd.acknowledgeOrder(t, "partner", AT)),
    step((t) => cmd.startWork(t, "assembly", "partner", { date: "2026-07-08", people: 2 }, AT)),
    step((t) => cmd.reportWorkCompletion(t, "assembly", "partner", { date: "2026-07-09", days: 2, people: 2, content: "くさび足場 組立完了", photoCount: 2 }, AT)),
  ]);

  // 2) 組立確認済み・支払い済み → 協力の「入金確認」が要対応
  const t2 = drive(progressTx("t2", "マンション改修 足場", "B"), [
    step((t) => cmd.startTransaction(t, "partner", AT)),
    step((t) => cmd.startWork(t, "assembly", "partner", { date: "2026-07-08", people: 2 }, AT)),
    step((t) => cmd.reportWorkCompletion(t, "assembly", "partner", { date: "2026-07-09", days: 2, people: 2, content: "組立完了", photoCount: 2 }, AT)),
    step((t) => cmd.confirmWork(t, "assembly", "prime", AT)),
    step((t) => cmd.submitInvoice(t, "assembly", "partner", { amount: 220000, issuedAt: "2026-07-09", dueDate: "2026-08-31", bankAccount: "七十七銀行 普通1234567" }, AT)),
    step((t) => cmd.checkInvoice(t, "assembly", "prime", AT)),
    step((t) => cmd.registerPayment(t, "assembly", "prime", { amount: 220000, paidAt: "2026-07-11", method: "銀行振込" }, AT)),
  ]);

  // 3) 是正・手直し中 → 協力の「是正・手直し完了」が要対応
  const t3 = drive(progressTx("t3", "店舗改装 足場", "B"), [
    step((t) => cmd.startTransaction(t, "partner", AT)),
    step((t) => cmd.startWork(t, "assembly", "partner", { date: "2026-07-08", people: 2 }, AT)),
    step((t) => cmd.reportWorkCompletion(t, "assembly", "partner", { date: "2026-07-09", days: 2, people: 2, content: "組立完了", photoCount: 2 }, AT)),
    step((t) => cmd.requestRework(t, "assembly", "prime", "3階北側の手すりに隙間あり。基準に合わせて是正してください。", AT)),
  ]);

  // 4) まだ受諾前 → 協力の「取引を開始」が要対応
  const t4 = progressTx("t4", "アパート改修 足場", "B");

  return [t1, t2, t3, t4];
}

export interface DemoBackend {
  transactions: InMemoryTransactionRepository;
  companies: InMemoryCompanyRepository;
  projects: InMemoryProjectRepository;
  events: InMemoryEventStore;
  credit: InMemoryCreditProcessor;
}

const GLOBAL_KEY = "__ashibaya_demo_backend__";

async function build(): Promise<DemoBackend> {
  const transactions = new InMemoryTransactionRepository();
  const companies = new InMemoryCompanyRepository();
  const projects = new InMemoryProjectRepository();
  const events = new InMemoryEventStore();
  const credit = new InMemoryCreditProcessor(companies);

  for (const c of SEED_COMPANIES) await companies.save(c);
  for (const t of seedTransactions()) await transactions.save(t);

  return { transactions, companies, projects, events, credit };
}

/** デモ・バックエンドのシングルトン（dev の HMR をまたいで保持）。 */
export async function getDemoBackend(): Promise<DemoBackend> {
  const g = globalThis as unknown as Record<string, Promise<DemoBackend> | undefined>;
  if (!g[GLOBAL_KEY]) g[GLOBAL_KEY] = build();
  return g[GLOBAL_KEY]!;
}
