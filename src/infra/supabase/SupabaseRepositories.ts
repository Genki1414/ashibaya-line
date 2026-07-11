import type { SupabaseClient } from "@supabase/supabase-js";
import { Company } from "../../domain/company";
import { Project } from "../../domain/project";
import { Transaction, TransactionEvent } from "../../domain/transaction";
import { CompanyId, ProjectId, TransactionId } from "../../domain/shared";
import { CompanyRepository, EventStore, ProjectRepository, StoredEvent, TransactionRepository } from "../../application/ports";
import {
  CompanyRow,
  ProjectRow,
  TransactionRow,
  companyToRow,
  projectToRow,
  rowToCompany,
  rowToProject,
  rowToTransaction,
  transactionToRow,
} from "./mappers";

/**
 * Supabase 実装。マッパーで純粋な集約に戻し、書き込みは単一 upsert（state ＋ 非正規化列 ＋ updated_at）。
 * クライアントは呼び出し側で用途に応じて渡す（通常はユーザートークン＝RLS有効なクライアント）。
 */

function nowIso(): string {
  return new Date().toISOString();
}

export class SupabaseTransactionRepository implements TransactionRepository {
  constructor(private readonly client: SupabaseClient) {}

  async load(id: TransactionId): Promise<Transaction | null> {
    const { data, error } = await this.client.from("transactions").select("state").eq("id", id).maybeSingle();
    if (error) throw error;
    return data ? rowToTransaction(data as unknown as TransactionRow) : null;
  }

  async save(tx: Transaction): Promise<void> {
    const row = { ...transactionToRow(tx), updated_at: nowIso() };
    const { error } = await this.client.from("transactions").upsert(row);
    if (error) throw error;
  }

  async listForCompany(companyId: CompanyId): Promise<Transaction[]> {
    const { data, error } = await this.client
      .from("transactions")
      .select("state")
      .or(`prime_id.eq.${companyId},partner_id.eq.${companyId}`)
      .order("updated_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map((row) => rowToTransaction(row as unknown as TransactionRow));
  }
}

export class SupabaseCompanyRepository implements CompanyRepository {
  constructor(private readonly client: SupabaseClient) {}

  async load(id: CompanyId): Promise<Company | null> {
    const { data, error } = await this.client.from("companies").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data ? rowToCompany(data as unknown as CompanyRow) : null;
  }

  async save(company: Company): Promise<void> {
    const row = { ...companyToRow(company), updated_at: nowIso() };
    const { error } = await this.client.from("companies").upsert(row);
    if (error) throw error;
  }

  async list(): Promise<Company[]> {
    const { data, error } = await this.client.from("companies").select("*");
    if (error) throw error;
    return (data ?? []).map((row) => rowToCompany(row as unknown as CompanyRow));
  }
}

export class SupabaseProjectRepository implements ProjectRepository {
  constructor(private readonly client: SupabaseClient) {}

  async load(id: ProjectId): Promise<Project | null> {
    const { data, error } = await this.client.from("projects").select("state").eq("id", id).maybeSingle();
    if (error) throw error;
    return data ? rowToProject(data as unknown as ProjectRow) : null;
  }

  async save(project: Project): Promise<void> {
    const row = { ...projectToRow(project), updated_at: nowIso() };
    const { error } = await this.client.from("projects").upsert(row);
    if (error) throw error;
  }

  async listRecruiting(): Promise<Project[]> {
    const { data, error } = await this.client.from("projects").select("state").eq("stage", "recruiting");
    if (error) throw error;
    return (data ?? []).map((row) => rowToProject(row as unknown as ProjectRow));
  }
}

interface EventPayloadWithTx {
  readonly transactionId: string;
}

export class SupabaseEventStore implements EventStore {
  constructor(private readonly client: SupabaseClient) {}

  async append(events: readonly TransactionEvent[]): Promise<void> {
    if (events.length === 0) return;
    const rows = events.map((event) => ({
      aggregate_id: (event.payload as EventPayloadWithTx).transactionId,
      type: event.name,
      payload: event.payload,
      occurred_at: event.occurredAt,
    }));
    // TransactionCompleted の挿入で DB トリガ（apply_transaction_completion）が信用実績を反映する。
    const { error } = await this.client.from("domain_events").insert(rows);
    if (error) throw error;
  }

  async timelineFor(aggregateId: string): Promise<StoredEvent[]> {
    const { data, error } = await this.client
      .from("domain_events")
      .select("aggregate_id, type, payload, occurred_at")
      .eq("aggregate_id", aggregateId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return (data ?? []).map((row) => {
      const r = row as { aggregate_id: string; type: string; payload: unknown; occurred_at: string };
      return { aggregateId: r.aggregate_id, type: r.type, payload: r.payload, occurredAt: r.occurred_at };
    });
  }
}
