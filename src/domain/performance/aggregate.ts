import type { Transaction } from "../transaction";
import { activePhaseKeys } from "../transaction";
import {
  type CompanyPerformance,
  type PartnerPerformance,
  type PerfEvent,
  type PrimePerformance,
  emptyCompanyPerformance,
} from "./types";

/** 集計入力：1取引の最終状態＋その取引のイベント列。 */
export interface PerfEntry {
  readonly tx: Transaction;
  readonly events: readonly PerfEvent[];
}

const cid = (v: unknown): string => String(v);

/** 対象（請求対象）フェーズのキー。応援は assembly のみ、請負は amount!=null のフェーズ。 */
function billablePhases(tx: Transaction) {
  return activePhaseKeys(tx).filter((k) => tx.phases[k].amount != null);
}

function hasCancellation(events: readonly PerfEvent[]): boolean {
  return events.some((e) => e.type === "TransactionCancelled");
}

/** 実完了日：対象フェーズの作業終了日の最遅。全フェーズ確定していなければ null。 */
function actualCompletionDate(tx: Transaction): string | null {
  const keys = activePhaseKeys(tx);
  let latest: string | null = null;
  for (const k of keys) {
    const end = tx.phases[k].work.endDate;
    if (!end) return null;
    if (latest === null || end > latest) latest = end;
  }
  return latest;
}

/**
 * 「双方合意済みの最新の工期終了予定日」を、完了日時点の値として復元する。
 * 元請が完了後に予定を書き換えても実績を有利にできないよう、
 * 完了日より後に発生した「工期終了」変更は取り消して from に戻す。
 */
function agreedPlannedEnd(tx: Transaction, events: readonly PerfEvent[], completionDate: string): string | null {
  let agreed = tx.overallSchedule.plannedEnd;
  const endChanges: { from: string | null; to: string | null; at: string }[] = [];
  for (const e of events) {
    if (e.type !== "ScheduleChanged") continue;
    const changes = Array.isArray(e.payload.changes) ? (e.payload.changes as { field?: string; from?: string | null; to?: string | null }[]) : [];
    for (const c of changes) {
      if (c.field === "工期終了") endChanges.push({ from: c.from ?? null, to: c.to ?? null, at: e.occurredAt });
    }
  }
  // 発生の新しい順に、完了日より後の変更だけ from に巻き戻す。
  endChanges.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
  for (const ch of endChanges) {
    if (ch.at > completionDate) agreed = ch.from;
    else break;
  }
  return agreed;
}

/** 是正：フェーズごとに発生数と解決数（該当フェーズが完了確認された時点で解決）を数える。 */
function reworkCounts(tx: Transaction, events: readonly PerfEvent[]): { raised: number; resolved: number } {
  let raised = 0;
  let resolved = 0;
  for (const phase of activePhaseKeys(tx)) {
    const raisedP = events.filter((e) => e.type === "ReworkRequested" && e.payload.phase === phase).length;
    if (raisedP === 0) continue;
    const confirmed = tx.phases[phase].work.status === "confirmed";
    raised += raisedP;
    resolved += confirmed ? raisedP : 0;
  }
  return { raised, resolved };
}

interface PrimeAcc {
  completed: number;
  paid: number;
  paidOnTime: number;
  paidLate: number;
  avgPayDaysBase: number;
  unpaid: number;
  openIssues: number;
  cancelled: number;
  avgPayDaysSum: number;
  partnerCompleted: Map<string, number>;
}
interface PartnerAcc {
  completed: number;
  workConfirmed: number;
  onSchedule: number;
  overSchedule: number;
  scheduleBase: number;
  reworkRaised: number;
  reworkResolved: number;
  reworkOpen: number;
  cancelled: number;
  primeCompleted: Map<string, number>;
}

/**
 * 会社1社の実績を、その会社が当事者の取引群から集計する純粋関数。
 * 同じ取引を二重に渡さない限り二重加算はしない（呼び出し側は取引を一意集合で渡す）。
 * 差分更新（関係2社の再計算）と全再計算は、同じ入力に対して同じ結果になる。
 */
export function aggregateForCompany(companyId: string, entries: readonly PerfEntry[]): CompanyPerformance {
  const prime: PrimeAcc = {
    completed: 0, paid: 0, paidOnTime: 0, paidLate: 0, avgPayDaysBase: 0, unpaid: 0, openIssues: 0, cancelled: 0,
    avgPayDaysSum: 0, partnerCompleted: new Map(),
  };
  const partner: PartnerAcc = {
    completed: 0, workConfirmed: 0, onSchedule: 0, overSchedule: 0, scheduleBase: 0,
    reworkRaised: 0, reworkResolved: 0, reworkOpen: 0, cancelled: 0, primeCompleted: new Map(),
  };

  for (const { tx, events } of entries) {
    const primeId = cid(tx.primeId);
    const partnerId = cid(tx.partnerId);
    const isPrime = primeId === companyId;
    const isPartner = partnerId === companyId;
    if (!isPrime && !isPartner) continue;

    const cancelled = hasCancellation(events);
    const completed = tx.status === "completed";
    const billable = billablePhases(tx);

    if (isPrime) {
      if (cancelled) {
        prime.cancelled += 1;
      } else {
        if (completed) {
          prime.completed += 1;
          if (tx.completion) {
            if (tx.completion.onTime) prime.paidOnTime += 1;
            else prime.paidLate += 1;
            prime.avgPayDaysSum += tx.completion.avgPayDays;
            prime.avgPayDaysBase += 1;
          }
          prime.partnerCompleted.set(partnerId, (prime.partnerCompleted.get(partnerId) ?? 0) + 1);
        }
        // 支払い完了：対象フェーズすべてで支払い登録済み（paid/deposited）。
        if (billable.length > 0 && billable.every((k) => ["paid", "deposited"].includes(tx.phases[k].bill.status))) {
          prime.paid += 1;
        }
        // 未入金：進行中で、請求済み（invoiced/checked）だが未払いのフェーズがある。
        if (!completed && billable.some((k) => ["invoiced", "checked"].includes(tx.phases[k].bill.status))) {
          prime.unpaid += 1;
        }
        prime.openIssues += tx.issues.filter((i) => !i.resolved).length;
      }
    }

    if (isPartner) {
      if (cancelled) {
        partner.cancelled += 1;
      } else {
        if (completed) {
          partner.completed += 1;
          partner.primeCompleted.set(primeId, (partner.primeCompleted.get(primeId) ?? 0) + 1);
        }
        const allConfirmed = activePhaseKeys(tx).length > 0 && activePhaseKeys(tx).every((k) => tx.phases[k].work.status === "confirmed");
        if (allConfirmed) {
          partner.workConfirmed += 1;
          const actual = actualCompletionDate(tx);
          const agreed = actual ? agreedPlannedEnd(tx, events, actual) : null;
          if (actual && agreed) {
            partner.scheduleBase += 1;
            if (actual <= agreed) partner.onSchedule += 1;
            else partner.overSchedule += 1;
          }
        }
        const rw = reworkCounts(tx, events);
        partner.reworkRaised += rw.raised;
        partner.reworkResolved += rw.resolved;
        partner.reworkOpen += rw.raised - rw.resolved;
      }
    }
  }

  const asPrime: PrimePerformance = {
    completed: prime.completed,
    paid: prime.paid,
    paidOnTime: prime.paidOnTime,
    paidLate: prime.paidLate,
    avgPayDays: prime.avgPayDaysBase > 0 ? Math.round(prime.avgPayDaysSum / prime.avgPayDaysBase) : null,
    avgPayDaysBase: prime.avgPayDaysBase,
    unpaid: prime.unpaid,
    openIssues: prime.openIssues,
    repeatPartners: countRepeat(prime.partnerCompleted),
    cancelled: prime.cancelled,
  };
  const asPartner: PartnerPerformance = {
    completed: partner.completed,
    workConfirmed: partner.workConfirmed,
    onSchedule: partner.onSchedule,
    overSchedule: partner.overSchedule,
    scheduleBase: partner.scheduleBase,
    reworkRaised: partner.reworkRaised,
    reworkResolved: partner.reworkResolved,
    reworkOpen: partner.reworkOpen,
    repeatPrimes: countRepeat(partner.primeCompleted),
    cancelled: partner.cancelled,
  };
  return { asPrime, asPartner };
}

function countRepeat(m: Map<string, number>): number {
  let n = 0;
  for (const v of m.values()) if (v >= 2) n += 1;
  return n;
}

/** 空実績（当事者取引が無い会社など）。 */
export { emptyCompanyPerformance };
