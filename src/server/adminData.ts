import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { rowToTransaction, type TransactionRow } from "@/infra/supabase/mappers";

/**
 * 本部（Admin）ダッシュボード用の横断データ。すべて service_role で読む。
 * サービスロール鍵が未設定でもページを 500 にしないよう、失敗時は error を返して空を返す。
 */

export interface AdminKpis {
  companies: { total: number; active: number; pending: number; suspended: number };
  projects: { total: number; recruiting: number; paused: number; matched: number; closed: number };
  transactions: { total: number; inProgress: number; completed: number; grossAmount: number };
}

export interface AdminTxRow {
  id: string;
  projectName: string;
  primeName: string;
  partnerName: string;
  status: string;
  amount: number;
  startedAt: string | null;
}

export interface AdminAuditRow {
  id: string;
  action: string;
  projectName: string;
  actorName: string;
  fileName: string;
  createdAt: string;
}

export interface AdminPerfRow {
  companyId: string;
  companyName: string;
  eventCount: number;
  computedAt: string | null;
}

export interface AdminOverview {
  kpis: AdminKpis;
  transactions: AdminTxRow[];
  audit: AdminAuditRow[];
  perf: AdminPerfRow[];
  error: string | null;
}

const EMPTY_KPIS: AdminKpis = {
  companies: { total: 0, active: 0, pending: 0, suspended: 0 },
  projects: { total: 0, recruiting: 0, paused: 0, matched: 0, closed: 0 },
  transactions: { total: 0, inProgress: 0, completed: 0, grossAmount: 0 },
};

export async function loadAdminOverview(): Promise<AdminOverview> {
  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch (e) {
    return { kpis: EMPTY_KPIS, transactions: [], audit: [], perf: [], error: e instanceof Error ? e.message : "サービスロール鍵が未設定です" };
  }

  try {
    const [compRes, projRes, txRes, auditRes, perfRes] = await Promise.all([
      admin.from("companies").select("id, name, status"),
      admin.from("projects").select("stage"),
      admin.from("transactions").select("id, prime_id, partner_id, status, amount, state").order("created_at", { ascending: false }),
      admin.from("project_document_audit").select("id, action, project_id, actor_company, detail, created_at").order("created_at", { ascending: false }).limit(50),
      admin.from("company_performance").select("company_id, event_count, computed_at"),
    ]);

    const companies = (compRes.data ?? []) as { id: string; name: string; status: string | null }[];
    const nameById = new Map(companies.map((c) => [c.id, c.name]));
    const projectRows = (projRes.data ?? []) as { stage: string | null }[];
    const txRowsRaw = (txRes.data ?? []) as (TransactionRow & { state: unknown })[];
    const auditRows = (auditRes.data ?? []) as { id: string; action: string; project_id: string; actor_company: string | null; detail: Record<string, unknown>; created_at: string }[];
    const perfRows = (perfRes.data ?? []) as { company_id: string; event_count: number; computed_at: string | null }[];

    // 案件名は取引の state から拾う（project_id は現状 null のため）。監査行の project_id は案件テーブルを引く。
    const { data: projNameRows } = await admin.from("projects").select("id, name");
    const projNameById = new Map(((projNameRows ?? []) as { id: string; name: string }[]).map((p) => [p.id, p.name]));

    // KPI
    const kpis: AdminKpis = {
      companies: {
        total: companies.length,
        active: companies.filter((c) => (c.status ?? "active") === "active").length,
        pending: companies.filter((c) => c.status === "pending").length,
        suspended: companies.filter((c) => c.status === "suspended").length,
      },
      projects: {
        total: projectRows.length,
        recruiting: projectRows.filter((p) => p.stage === "recruiting").length,
        paused: projectRows.filter((p) => p.stage === "paused").length,
        matched: projectRows.filter((p) => p.stage === "matched").length,
        closed: projectRows.filter((p) => p.stage === "closed").length,
      },
      transactions: {
        total: txRowsRaw.length,
        inProgress: txRowsRaw.filter((r) => r.status !== "completed").length,
        completed: txRowsRaw.filter((r) => r.status === "completed").length,
        grossAmount: txRowsRaw.reduce((s, r) => s + (Number(r.amount) || 0), 0),
      },
    };

    const transactions: AdminTxRow[] = txRowsRaw.slice(0, 100).map((r) => {
      const tx = rowToTransaction(r as unknown as TransactionRow);
      return {
        id: r.id,
        projectName: tx.projectName,
        primeName: nameById.get(r.prime_id) ?? r.prime_id,
        partnerName: nameById.get(r.partner_id) ?? r.partner_id,
        status: r.status,
        amount: Number(r.amount) || 0,
        startedAt: tx.startedAt ?? null,
      };
    });

    const audit: AdminAuditRow[] = auditRows.map((a) => ({
      id: a.id,
      action: a.action,
      projectName: projNameById.get(a.project_id) ?? a.project_id,
      actorName: a.actor_company ? (nameById.get(a.actor_company) ?? a.actor_company) : "—",
      fileName: typeof a.detail?.fileName === "string" ? (a.detail.fileName as string) : "",
      createdAt: a.created_at,
    }));

    const perf: AdminPerfRow[] = perfRows
      .map((p) => ({ companyId: p.company_id, companyName: nameById.get(p.company_id) ?? p.company_id, eventCount: p.event_count, computedAt: p.computed_at }))
      .sort((a, b) => (b.computedAt ?? "").localeCompare(a.computedAt ?? ""));

    return { kpis, transactions, audit, perf, error: null };
  } catch (e) {
    return { kpis: EMPTY_KPIS, transactions: [], audit: [], perf: [], error: e instanceof Error ? e.message : String(e) };
  }
}
