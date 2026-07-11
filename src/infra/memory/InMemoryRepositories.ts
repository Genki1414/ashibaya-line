import { Company } from "../../domain/company";
import { Project } from "../../domain/project";
import { Transaction, TransactionEvent } from "../../domain/transaction";
import { CompanyId, ProjectId, TransactionId } from "../../domain/shared";
import { CompanyRepository, EventStore, ProjectRepository, StoredEvent, TransactionRepository } from "../../application/ports";
import {
  companyToRow,
  projectToRow,
  rowToCompany,
  rowToProject,
  rowToTransaction,
  transactionToRow,
} from "../supabase/mappers";

/**
 * テスト／開発用のインメモリ実装。行を JSON 文字列として保持し、読み出し時に
 * JSON.parse → マッパー で復元することで、JSONB 相当のシリアライズ境界を再現する
 * （＝ save→load の完全復元をこの層でも検証できる）。
 */

function clone<T>(row: T): T {
  return JSON.parse(JSON.stringify(row)) as T;
}

export class InMemoryTransactionRepository implements TransactionRepository {
  private readonly rows = new Map<string, string>();

  async load(id: TransactionId): Promise<Transaction | null> {
    const raw = this.rows.get(id);
    return raw ? rowToTransaction(JSON.parse(raw)) : null;
  }

  async save(tx: Transaction): Promise<void> {
    this.rows.set(tx.id, JSON.stringify(transactionToRow(tx)));
  }

  async listForCompany(companyId: CompanyId): Promise<Transaction[]> {
    return [...this.rows.values()]
      .map((raw) => rowToTransaction(JSON.parse(raw)))
      .filter((tx) => tx.primeId === companyId || tx.partnerId === companyId);
  }
}

export class InMemoryCompanyRepository implements CompanyRepository {
  private readonly rows = new Map<string, string>();

  async load(id: CompanyId): Promise<Company | null> {
    const raw = this.rows.get(id);
    return raw ? rowToCompany(JSON.parse(raw)) : null;
  }

  async save(company: Company): Promise<void> {
    this.rows.set(company.id, JSON.stringify(companyToRow(company)));
  }

  async list(): Promise<Company[]> {
    return [...this.rows.values()].map((raw) => rowToCompany(JSON.parse(raw)));
  }
}

export class InMemoryProjectRepository implements ProjectRepository {
  private readonly rows = new Map<string, string>();

  async load(id: ProjectId): Promise<Project | null> {
    const raw = this.rows.get(id);
    return raw ? rowToProject(JSON.parse(raw)) : null;
  }

  async save(project: Project): Promise<void> {
    this.rows.set(project.id, JSON.stringify(projectToRow(project)));
  }

  async listRecruiting(): Promise<Project[]> {
    return [...this.rows.values()].map((raw) => rowToProject(JSON.parse(raw))).filter((p) => p.stage === "recruiting");
  }
}

interface EventPayloadWithTx {
  readonly transactionId: string;
}

export class InMemoryEventStore implements EventStore {
  readonly events: StoredEvent[] = [];

  async append(events: readonly TransactionEvent[]): Promise<void> {
    for (const event of events) {
      const payload = event.payload as EventPayloadWithTx;
      this.events.push({ aggregateId: payload.transactionId, type: event.name, payload: event.payload, occurredAt: event.occurredAt });
    }
  }

  async timelineFor(aggregateId: string): Promise<StoredEvent[]> {
    return this.events.filter((event) => event.aggregateId === aggregateId);
  }
}

export function cloneRowForTest<T>(row: T): T {
  return clone(row);
}
