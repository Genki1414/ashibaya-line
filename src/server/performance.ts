import "server-only";
import { createAdminClient } from "../lib/supabase/admin";
import { rowToTransaction, type TransactionRow } from "../infra/supabase/mappers";
import { aggregateForCompany, type PerfEntry, type PerfEvent } from "../domain/performance";

interface EventRow {
  aggregate_id: string;
  type: string;
  payload: unknown;
  occurred_at: string;
}

/**
 * 実績プロジェクションの再計算。domain_events ＋ transactions を読み、
 * ドメインの純粋 aggregator で会社ごとに集計して company_performance に upsert する。
 *
 * - companyIds を渡すとその会社だけ（＝取引完了時の差分更新：関係2社を再計算）。
 * - 省略すると全社（＝Adminの全社再計算）。
 * どちらも「全取引からの再集計」なので、差分更新と全再計算は必ず一致する（冪等）。
 *
 * 値はここでしか書き込まない（利用者・管理者は直接編集できない）。修正は
 * 修正イベントを domain_events に追記して再計算する運用。
 */
export async function recomputePerformance(companyIds?: readonly string[]): Promise<number> {
  const admin = createAdminClient();

  const [txRes, evRes, compRes] = await Promise.all([
    admin.from("transactions").select("state"),
    admin.from("domain_events").select("aggregate_id, type, payload, occurred_at"),
    admin.from("companies").select("id"),
  ]);
  if (txRes.error) throw new Error(txRes.error.message);
  if (evRes.error) throw new Error(evRes.error.message);
  if (compRes.error) throw new Error(compRes.error.message);

  const txs = (txRes.data ?? []).map((r) => rowToTransaction(r as unknown as TransactionRow));

  const eventsByTx = new Map<string, PerfEvent[]>();
  for (const r of (evRes.data ?? []) as EventRow[]) {
    const arr = eventsByTx.get(r.aggregate_id) ?? [];
    arr.push({ type: r.type, payload: (r.payload ?? {}) as Record<string, unknown>, occurredAt: r.occurred_at });
    eventsByTx.set(r.aggregate_id, arr);
  }

  const allIds = (compRes.data ?? []).map((c) => (c as { id: string }).id);
  const targetIds = companyIds && companyIds.length > 0 ? companyIds.filter((id) => allIds.includes(id)) : allIds;

  const now = new Date().toISOString();
  const rows = targetIds.map((id) => {
    const entries: PerfEntry[] = txs
      .filter((tx) => String(tx.primeId) === id || String(tx.partnerId) === id)
      .map((tx) => ({ tx, events: eventsByTx.get(String(tx.id)) ?? [] }));
    const perf = aggregateForCompany(id, entries);
    const eventCount = entries.reduce((n, e) => n + e.events.length, 0);
    return { company_id: id, as_prime: perf.asPrime, as_partner: perf.asPartner, event_count: eventCount, computed_at: now };
  });

  if (rows.length > 0) {
    const { error } = await admin.from("company_performance").upsert(rows);
    if (error) throw new Error(error.message);
  }
  return rows.length;
}
