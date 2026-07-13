import { CompanyId, IsoDate } from "../shared";
import { CompanyMetrics } from "./types";

export interface TransactionCompletionOutcome {
  readonly onTime: boolean;
  readonly avgPayDays: number;
  readonly completedAt: IsoDate;
}

/**
 * 取引完了イベントを受けて双方の会社の metrics を更新する。Transaction 集約は
 * Company を直接更新せず TransactionCompleted イベントを発行するだけにして、
 * この更新はアプリケーション層のイベントハンドラからこの関数を呼んで行う想定
 * （集約をまたぐ整合性は結果整合でよい、という DDD の定石）。
 */
export function applyCompletionAsPrime(
  metrics: CompanyMetrics,
  partnerId: CompanyId,
  outcome: TransactionCompletionOutcome,
): CompanyMetrics {
  const paidCount = metrics.paidCount + 1;
  const isNewPartner = !metrics.continuousPartnerIds.includes(partnerId);
  return {
    ...metrics,
    completed: metrics.completed + 1,
    paidCount,
    onTimeCount: metrics.onTimeCount + (outcome.onTime ? 1 : 0),
    lateCount: metrics.lateCount + (outcome.onTime ? 0 : 1),
    avgPayDays: Math.round((metrics.avgPayDays * metrics.paidCount + outcome.avgPayDays) / paidCount),
    lastTrade: outcome.completedAt,
    continuousPartnerIds: isNewPartner ? [...metrics.continuousPartnerIds, partnerId] : metrics.continuousPartnerIds,
  };
}

export function applyCompletionAsPartner(
  metrics: CompanyMetrics,
  primeId: CompanyId,
  outcome: TransactionCompletionOutcome,
): CompanyMetrics {
  const isNewPartner = !metrics.continuousPartnerIds.includes(primeId);
  return {
    ...metrics,
    completed: metrics.completed + 1,
    lastTrade: outcome.completedAt,
    continuousPartnerIds: isNewPartner ? [...metrics.continuousPartnerIds, primeId] : metrics.continuousPartnerIds,
  };
}
