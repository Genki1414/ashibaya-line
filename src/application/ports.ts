import { Company } from "../domain/company";
import { Project } from "../domain/project";
import { Transaction, TransactionEvent } from "../domain/transaction";
import { CompanyId, DomainEvent, IsoDate, ProjectId, TransactionId } from "../domain/shared";

/**
 * アプリケーション層が依存する永続化ポート。実装（Supabase / インメモリ）は infra 層に置く。
 * ドメイン集約をそのままやり取りし、行やSQLはここに漏らさない。
 */
export interface TransactionRepository {
  load(id: TransactionId): Promise<Transaction | null>;
  save(tx: Transaction): Promise<void>;
  listForCompany(companyId: CompanyId): Promise<Transaction[]>;
}

export interface CompanyRepository {
  load(id: CompanyId): Promise<Company | null>;
  save(company: Company): Promise<void>;
  list(): Promise<Company[]>;
}

export interface ProjectRepository {
  load(id: ProjectId): Promise<Project | null>;
  save(project: Project): Promise<void>;
  listRecruiting(): Promise<Project[]>;
}

export interface StoredEvent {
  readonly aggregateId: string;
  readonly type: string;
  readonly payload: unknown;
  readonly occurredAt: IsoDate;
}

export interface EventStore {
  append(events: readonly DomainEvent<string, unknown>[]): Promise<void>;
  timelineFor(aggregateId: string): Promise<StoredEvent[]>;
}

/**
 * TransactionCompleted を受けて相手会社の信用実績を反映する特権処理のポート。
 * Supabase 実装では DB トリガ（apply_transaction_completion）が担うため no-op、
 * インメモリ実装では credit.applyCompletion* を使ってこの層で反映する。
 * どちらでも usecase 本体は同一。
 */
export interface CreditProcessor {
  onTransactionCompleted(event: Extract<TransactionEvent, { name: "TransactionCompleted" }>): Promise<void>;
}
