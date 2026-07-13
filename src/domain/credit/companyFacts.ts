import { daysBetween, IsoDate } from "../shared";
import { coreVerified } from "./creditLevel";
import { CompanyMetrics, VerifyRecord } from "./types";

export interface CompanyFactsInput {
  readonly verify: VerifyRecord;
  readonly metrics: CompanyMetrics;
  readonly hasOpenIssue: boolean;
  readonly registeredAt: IsoDate;
  readonly today: IsoDate;
}

export interface CompanyFacts {
  readonly concerns: readonly string[];
  readonly positives: readonly string[];
}

const RECENTLY_REGISTERED_DAYS = 7;

/** 「安全/危険」と断定せず、確認できる事実を並べるためのパネル用データ（仕様書8章）。 */
export function companyFacts(input: CompanyFactsInput): CompanyFacts {
  const { verify, metrics, hasOpenIssue, registeredAt, today } = input;
  const verified = coreVerified(verify);
  const concerns: string[] = [];
  const positives: string[] = [];

  if (!verified) concerns.push("本人確認が完了していません");
  if (metrics.completed === 0 && metrics.paidCount === 0) concerns.push("支払い実績がまだありません");
  if (daysBetween(registeredAt, today) <= RECENTLY_REGISTERED_DAYS) concerns.push("登録から7日以内の会社です");
  if (verify.license !== "verified") concerns.push("建設業許可が未確認です");
  if (verify.labor !== "verified" && verify.liability !== "verified") concerns.push("保険加入状況が未確認です");
  if (metrics.lateCount > 0) concerns.push(`支払い遅延が${metrics.lateCount}件あります`);
  if (hasOpenIssue) concerns.push("未解決の確認事項があります");

  if (verified) positives.push("本人確認済み");
  if (metrics.paidCount > 0) positives.push(`支払い実績${metrics.paidCount}件`);
  if (metrics.onTimeCount > 0) positives.push(`期日内支払い${metrics.onTimeCount}件`);
  positives.push(`支払い遅延${metrics.lateCount}件`);
  if (metrics.continuousPartnerIds.length > 0) positives.push(`継続取引${metrics.continuousPartnerIds.length}社`);
  if (verify.license === "verified") positives.push("建設業許可確認済み");
  if (verify.labor === "verified" || verify.liability === "verified") positives.push("保険加入確認済み");

  return { concerns, positives };
}
