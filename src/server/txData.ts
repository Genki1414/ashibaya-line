import { getContainer } from "./container";
import { availableActions, category, type Actor, type Transaction } from "@/domain/transaction";
import { companyCreditLevel, type Company } from "@/domain/company";
import { buildTimeline, type TimelineEntry } from "@/lib/txTimeline";

export const CATEGORY_LABEL: Record<string, string> = {
  active: "進行中",
  billing: "請求・支払い",
  rework: "是正・手直し中",
  issue: "確認事項あり",
  completed: "完了",
};

/** 「現在のステータス」に出す一行ラベル。UI・一覧の両方から使う純粋導出。 */
export function statusLabel(tx: Transaction): string {
  if (tx.status === "completed") return "完了";
  if (tx.startedAt === null) return "取引開始前";
  return CATEGORY_LABEL[category(tx)] ?? "進行中";
}

function roleOf(tx: Transaction, companyId: string | null): Actor | null {
  if (!companyId) return null;
  if ((tx.primeId as unknown as string) === companyId) return "prime";
  if ((tx.partnerId as unknown as string) === companyId) return "partner";
  return null;
}

function totalAmount(tx: Transaction): number {
  return (tx.phases.assembly.amount ?? 0) + (tx.phases.dismantle.amount ?? 0);
}

export interface TxCardView {
  id: string;
  projectName: string;
  role: Actor;
  roleLabel: string;
  counterpartyName: string;
  status: string;
  pending: number;
  amount: number;
  region: string;
  completed: boolean;
}

/** 自社が当事者（元請 or 協力）の取引一覧。RLSにより関係する取引のみ返る。 */
export async function listMyTransactions(): Promise<TxCardView[]> {
  const container = await getContainer();
  const acting = container.actingCompanyId as unknown as string;
  const [txs, companies] = await Promise.all([container.listTransactionsForActing(), container.listCompanies()]);
  const nameById = new Map(companies.map((c) => [c.id, c.name]));

  return txs.map((tx) => {
    const role = roleOf(tx, acting) ?? "partner";
    const counterpartyId = (role === "prime" ? tx.partnerId : tx.primeId) as unknown as string;
    return {
      id: tx.id as unknown as string,
      projectName: tx.projectName,
      role,
      roleLabel: role === "prime" ? "元請" : "協力",
      counterpartyName: nameById.get(counterpartyId as never) ?? counterpartyId,
      status: statusLabel(tx),
      pending: availableActions(tx, role).length,
      amount: totalAmount(tx),
      region: tx.region,
      completed: tx.status === "completed",
    };
  });
}

export interface CompanyBrief {
  id: string;
  name: string;
  level: string;
}

export interface TxDetailView {
  tx: Transaction;
  role: Actor;
  prime: CompanyBrief;
  partner: CompanyBrief;
  timeline: TimelineEntry[];
}

function brief(company: Company | null, id: string, asPartner: boolean): CompanyBrief {
  if (!company) return { id, name: id, level: "unverified" };
  return { id: company.id, name: company.name, level: companyCreditLevel(company, asPartner) };
}

/** 取引詳細。自社が当事者でなければ null（RLS＋アプリ層の二重防御）。 */
export async function loadTxDetail(id: string): Promise<TxDetailView | null> {
  const container = await getContainer();
  const tx = await container.loadTransaction(id);
  if (!tx) return null;
  const acting = container.actingCompanyId as unknown as string;
  const role = roleOf(tx, acting);
  if (!role) return null;

  const [primeCompany, partnerCompany, events] = await Promise.all([
    container.loadCompany(tx.primeId as unknown as string),
    container.loadCompany(tx.partnerId as unknown as string),
    container.timelineFor(id),
  ]);
  return {
    tx,
    role,
    prime: brief(primeCompany, tx.primeId as unknown as string, false),
    partner: brief(partnerCompany, tx.partnerId as unknown as string, true),
    timeline: buildTimeline(events),
  };
}
