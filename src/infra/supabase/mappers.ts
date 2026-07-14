import { Company } from "../../domain/company";
import { Project } from "../../domain/project";
import { Transaction, category } from "../../domain/transaction";
import { CompanyMetrics, VerifyRecord } from "../../domain/credit";

/**
 * 集約 ⇔ DB行 のマッパー（純粋関数・Supabaseクライアント非依存）。
 * 方針: state 列に集約全体（JSONB）を保持し、絞り込み用の列は state からの導出値。
 *       ドメインは純粋なプレーンデータなので、JSONラウンドトリップで完全に再構成できる。
 */

export interface CompanyRow {
  id: string;
  name: string;
  region: string;
  contact: string;
  areas: string[];
  works: string[];
  registered: string;
  verify: VerifyRecord;
  metrics: CompanyMetrics;
  status?: Company["status"];
}

export function companyToRow(company: Company): CompanyRow {
  return {
    id: company.id,
    name: company.name,
    region: company.region,
    contact: company.contact,
    areas: [...company.areas],
    works: [...company.works],
    registered: company.registeredAt,
    verify: company.verify,
    metrics: company.metrics,
    status: company.status ?? "active",
  };
}

export function rowToCompany(row: CompanyRow): Company {
  return {
    id: row.id as Company["id"],
    name: row.name,
    region: row.region,
    contact: row.contact ?? "",
    areas: row.areas ?? [],
    works: row.works ?? [],
    registeredAt: row.registered,
    verify: row.verify,
    metrics: row.metrics,
    status: row.status ?? "active",
  };
}

export interface ProjectRow {
  id: string;
  prime_id: string;
  stage: Project["stage"];
  name: string;
  job_type: Project["jobType"];
  pay_type: Project["payType"];
  region: string;
  unit_price: number;
  need: number | null;
  deadline: string | null;
  posted: string | null;
  guaranteed: boolean;
  // 0009 で追加した検索用の絞り込み列（select("state") のみのときは undefined）。
  prefecture?: string | null;
  city?: string | null;
  starts_on?: string | null;
  ends_on?: string | null;
  has_assembly?: boolean | null;
  has_dismantle?: boolean | null;
  state: Project;
}

export function projectToRow(project: Project): ProjectRow {
  // 組立/解体フェーズは請負のみ分類する（応援＝単一フェーズは分類せず、案件種別で検索）。
  const isContract = project.jobType === "contract";
  return {
    id: project.id,
    prime_id: project.primeId,
    stage: project.stage,
    name: project.name,
    job_type: project.jobType,
    pay_type: project.payType,
    region: project.region,
    unit_price: project.unitPrice,
    need: project.need,
    deadline: project.applicationDeadline,
    posted: project.postedAt,
    guaranteed: project.guaranteed,
    prefecture: project.prefecture || null,
    city: project.city || null,
    starts_on: project.overallSchedule.plannedStart,
    ends_on: project.overallSchedule.plannedEnd,
    has_assembly: isContract && project.assemblySchedule.plannedStart != null,
    has_dismantle: isContract && project.dismantleSchedule.plannedStart != null,
    state: project,
  };
}

export function rowToProject(row: ProjectRow): Project {
  // 旧データの state jsonb は prefecture/city を持たないため、列値または空で補完して
  // Project の形を常に満たす（region は表示互換で残す）。
  const s = row.state as Project & { prefecture?: string; city?: string; disclosedTo?: Project["disclosedTo"] };
  return {
    ...s,
    prefecture: s.prefecture ?? row.prefecture ?? "",
    city: s.city ?? row.city ?? "",
    region: s.region ?? row.region ?? "",
    disclosedTo: s.disclosedTo ?? [], // 旧データ互換（未許可）
  };
}

export interface TransactionRow {
  id: string;
  project_id: string | null;
  prime_id: string;
  partner_id: string;
  status: Transaction["status"];
  category: string;
  job_type: Transaction["jobType"];
  pay_type: Transaction["payType"];
  amount: number;
  assembly_amount: number | null;
  dismantle_amount: number | null;
  closing: Transaction["closing"];
  payterm: Transaction["payTerm"];
  chat_key: string;
  state: Transaction;
}

export function transactionToRow(tx: Transaction): TransactionRow {
  const assemblyAmount = tx.phases.assembly.amount;
  const dismantleAmount = tx.phases.dismantle.amount;
  const amount = (assemblyAmount ?? 0) + (dismantleAmount ?? 0);
  return {
    id: tx.id,
    // 案件との紐付けは将来のリンク用。存在しないプロジェクトへのFK違反を避けるため現状は null。
    project_id: null,
    prime_id: tx.primeId,
    partner_id: tx.partnerId,
    status: tx.status,
    category: category(tx),
    job_type: tx.jobType,
    pay_type: tx.payType,
    amount,
    assembly_amount: assemblyAmount,
    dismantle_amount: dismantleAmount,
    closing: tx.closing,
    payterm: tx.payTerm,
    chat_key: tx.chatKey,
    state: tx,
  };
}

export function rowToTransaction(row: TransactionRow): Transaction {
  return row.state;
}
