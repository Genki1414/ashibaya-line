import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { CompanyId, systemClock } from "../domain/shared";
import { ACTING_COMPANY_COOKIE, currentCompanyId, getDb } from "./acting";
import { Company } from "../domain/company";
// getAuthContext は acting.ts 経由（currentCompanyId）で解決するため container では直接使わない
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

export { ACTING_COMPANY_COOKIE };
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

/** デモ運用時のみ有効な擬似ログイン（会社切替）。本番(Supabaseモード)では使わない。 */
async function readDemoCompanyId(): Promise<CompanyId> {
  const store = await cookies();
  return CompanyId(store.get(ACTING_COMPANY_COOKIE)?.value ?? DEFAULT_ACTING_COMPANY);
}

/** Supabaseモードの識別は cookie ではなくログインセッション（所属会社）から解決する。 */
const NO_COMPANY = CompanyId("__none__");

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

async function supabaseContainer(actingCompanyId: CompanyId, client: SupabaseClient): Promise<Container> {
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
 * 識別（操作主体の会社）と DB クライアントは acting.ts に集約：
 * 通常はログインセッションの所属会社＋セッションクライアント、
 * リリース前の会社切り替え有効時のみ、上書き会社＋service_role クライアント。
 * 本番(NODE_ENV=production)では Supabase 接続を必須とする。
 */
export async function getContainer(): Promise<Container> {
  if (!supabaseConfigured()) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("本番環境では Supabase 接続が必須です（NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 未設定）");
    }
    return demoContainer(await readDemoCompanyId());
  }
  const id = await currentCompanyId();
  const client = await getDb();
  return supabaseContainer(id ? CompanyId(id) : NO_COMPANY, client);
}
