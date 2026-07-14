export type {
  CancellationFacts,
  PrimePerformance,
  PartnerPerformance,
  CompanyPerformance,
  PerfEvent,
} from "./types";
export {
  emptyPrimePerformance,
  emptyPartnerPerformance,
  emptyCompanyPerformance,
} from "./types";
export { aggregateForCompany, type PerfEntry } from "./aggregate";

/**
 * 率の表示は「分子/分母」から常に導出する（率を保存しない）。
 * 母数0のときは率を出さず、少数件で誤解を生まないよう母数を必ず併記する。
 * 例: rateText(2, 2) → "100%（2件中2件）"、rateText(0, 0) → "—（0件）"
 */
export function rateText(numerator: number, denominator: number): string {
  if (denominator <= 0) return "—（0件）";
  const pct = Math.round((numerator / denominator) * 100);
  return `${pct}%（${denominator}件中${numerator}件）`;
}
