import { cookies } from "next/headers";
import { CompanyId, systemClock } from "../domain/shared";
import { Company } from "../domain/company";
import { Transaction } from "../domain/transaction";
import {
  MatchingService,
  ProjectService,
  StoredEvent,
  TransactionService,
} from "../application";
import {
  SupabaseCompanyRepository,
  SupabaseEventStore,
  SupabaseProjectRepository,
  SupabaseTransactionRepository,
} from "../infra/supabase/SupabaseRepositories";
import { SupabaseCreditProcessor } from "../infra/supabase/SupabaseCreditProcessor";
import { getDemoBackend } from "./demoStore";

export const ACTING_COMPANY_COOKIE = "acting_company_id";
const DEFAULT_ACTING_COMPANY = "A";

export interface Container {
  readonly actingCompanyId: CompanyId;
  readonly mode: "supabase" | "demo";
  readonly txService: TransactionService;
  readonly matching: MatchingService;
  readonly projectService: ProjectService;
  loadTransaction(id: string): Promise<Transaction | null>;
  listTransactionsForActing(): Promise<Transaction[]>;
  loadCompany(id: string): Promise<Company | null>;
  listCompanies(): Promise<Company[]>;
  timelineFor(id: string): Promise<StoredEvent[]>;
}

function newId(): string {
  return crypto.randomUUID();
}

async function readActingCompanyId(): Promise<CompanyId> {
  const store = await cookies();
  return CompanyId(store.get(ACTING_COMPANY_COOKIE)?.value ?? DEFAULT_ACTING_COMPANY);
}

function supabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

async function demoContainer(actingCompanyId: CompanyId): Promise<Container> {
  const backend = await getDemoBackend();
  const clock = systemClock;
  return {
    actingCompanyId,
    mode: "demo",
    txService: new TransactionService({ transactions: backend.transactions, events: backend.events, credit: backend.credit, clock }),
    matching: new MatchingService({ projects: backend.projects, transactions: backend.transactions, events: backend.events, clock, newId }),
    projectService: new ProjectService({ projects: backend.projects, clock, newId }),
    loadTransaction: (id) => backend.transactions.load(id as Parameters<typeof backend.transactions.load>[0]),
    listTransactionsForActing: () => backend.transactions.listForCompany(actingCompanyId),
    loadCompany: (id) => backend.companies.load(id as CompanyId),
    listCompanies: () => backend.companies.list(),
    timelineFor: (id) => backend.events.timelineFor(id),
  };
}

async function supabaseContainer(actingCompanyId: CompanyId): Promise<Container> {
  const { createClient } = await import("../lib/supabase/server");
  const client = await createClient();
  const transactions = new SupabaseTransactionRepository(client);
  const companies = new SupabaseCompanyRepository(client);
  const projects = new SupabaseProjectRepository(client);
  const events = new SupabaseEventStore(client);
  const credit = new SupabaseCreditProcessor();
  const clock = systemClock;
  return {
    actingCompanyId,
    mode: "supabase",
    txService: new TransactionService({ transactions, events, credit, clock }),
    matching: new MatchingService({ projects, transactions, events, clock, newId }),
    projectService: new ProjectService({ projects, clock, newId }),
    loadTransaction: (id) => transactions.load(id as Parameters<typeof transactions.load>[0]),
    listTransactionsForActing: () => transactions.listForCompany(actingCompanyId),
    loadCompany: (id) => companies.load(id as CompanyId),
    listCompanies: () => companies.list(),
    timelineFor: (id) => events.timelineFor(id),
  };
}

/**
 * 合成ルート。Supabase の環境変数があれば Supabase 実装、無ければデモ用インメモリ実装。
 * 「操作する会社（＝擬似ログイン）」は cookie で切り替える（v8 の役割スイッチの置き換え）。
 */
export async function getContainer(): Promise<Container> {
  const actingCompanyId = await readActingCompanyId();
  return supabaseConfigured() ? supabaseContainer(actingCompanyId) : demoContainer(actingCompanyId);
}
