import { CompanyMetrics, CreditLevel, CORE_VERIFY_ITEMS, MAIN_VERIFY_ITEMS, VerifyRecord } from "./types";

export function coreVerified(verify: VerifyRecord): boolean {
  return CORE_VERIFY_ITEMS.every((key) => verify[key] === "verified");
}

export function mainVerifiedCount(verify: VerifyRecord): number {
  return MAIN_VERIFY_ITEMS.filter((key) => verify[key] === "verified").length;
}

export function onTimeRate(metrics: CompanyMetrics): number {
  const paid = metrics.onTimeCount + metrics.lateCount;
  return paid ? Math.round((metrics.onTimeCount / paid) * 100) : 0;
}

export function continuousCount(metrics: CompanyMetrics): number {
  return metrics.continuousPartnerIds.length;
}

export interface CreditLevelThreshold {
  readonly minCompleted: number;
  readonly minOnTimeRate: number;
  readonly minMainVerified: number;
  /** platinum のみ「遅延ゼロ」を要求するための上限値。未指定なら制約なし。 */
  readonly maxLateCount?: number;
  /** silver のみ「未解決の確認事項なし」を要求する。 */
  readonly requireNoOpenIssue?: boolean;
}

export interface CreditLevelPolicy {
  readonly bronze: CreditLevelThreshold;
  readonly silver: CreditLevelThreshold;
  readonly gold: CreditLevelThreshold;
  readonly platinum: CreditLevelThreshold;
}

/**
 * 仕様書8章の既定しきい値。運営管理画面から差し替えられる想定のため、
 * ハードコードせずポリシーとして注入できるようにしてある。
 */
export const DEFAULT_CREDIT_LEVEL_POLICY: CreditLevelPolicy = {
  bronze: { minCompleted: 1, minOnTimeRate: 0, minMainVerified: 0 },
  silver: { minCompleted: 5, minOnTimeRate: 90, minMainVerified: 0, requireNoOpenIssue: true },
  gold: { minCompleted: 20, minOnTimeRate: 95, minMainVerified: 3 },
  platinum: { minCompleted: 50, minOnTimeRate: 98, minMainVerified: 4, maxLateCount: 0 },
};

export interface CreditLevelInput {
  readonly verify: VerifyRecord;
  readonly metrics: CompanyMetrics;
  readonly hasOpenIssue: boolean;
}

function meetsThreshold(
  metrics: CompanyMetrics,
  rate: number,
  mainCount: number,
  hasOpenIssue: boolean,
  threshold: CreditLevelThreshold,
): boolean {
  if (metrics.completed < threshold.minCompleted) return false;
  if (rate < threshold.minOnTimeRate) return false;
  if (mainCount < threshold.minMainVerified) return false;
  if (threshold.maxLateCount !== undefined && metrics.lateCount > threshold.maxLateCount) return false;
  if (threshold.requireNoOpenIssue && hasOpenIssue) return false;
  return true;
}

/** 会社の信用レベルは常にこの関数から導出する。metrics/verify 以外の永続状態は持たない。 */
export function determineCreditLevel(input: CreditLevelInput, policy: CreditLevelPolicy = DEFAULT_CREDIT_LEVEL_POLICY): CreditLevel {
  if (!coreVerified(input.verify)) return "unverified";

  const rate = onTimeRate(input.metrics);
  const mainCount = mainVerifiedCount(input.verify);

  if (meetsThreshold(input.metrics, rate, mainCount, input.hasOpenIssue, policy.platinum)) return "platinum";
  if (meetsThreshold(input.metrics, rate, mainCount, input.hasOpenIssue, policy.gold)) return "gold";
  if (meetsThreshold(input.metrics, rate, mainCount, input.hasOpenIssue, policy.silver)) return "silver";
  if (meetsThreshold(input.metrics, rate, mainCount, input.hasOpenIssue, policy.bronze)) return "bronze";
  return "unverified";
}
