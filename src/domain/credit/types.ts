import { CompanyId, IsoDate } from "../shared";

export const VERIFY_ITEM_KEYS = [
  "phone",
  "email",
  "corp",
  "rep",
  "address",
  "license",
  "invoice",
  "labor",
  "liability",
  "sole",
  "qual",
  "harness",
] as const;
export type VerifyItemKey = (typeof VERIFY_ITEM_KEYS)[number];

export type VerifyStatus = "none" | "reviewing" | "verified" | "expired" | "rejected";
export type VerifyRecord = Record<VerifyItemKey, VerifyStatus>;

/** 本人確認の必須項目。ひとつでも未確認だと会社は「未認証」に留まる。 */
export const CORE_VERIFY_ITEMS: readonly VerifyItemKey[] = ["phone", "email", "corp", "rep", "address"];
/** 信用レベル判定の主要業務認証（許可・インボイス・労災・賠責）。 */
export const MAIN_VERIFY_ITEMS: readonly VerifyItemKey[] = ["license", "invoice", "labor", "liability"];

export type CreditLevel = "unverified" | "bronze" | "silver" | "gold" | "platinum";

export interface CompanyMetrics {
  readonly completed: number;
  readonly paidCount: number;
  readonly onTimeCount: number;
  readonly lateCount: number;
  readonly avgPayDays: number;
  readonly lastTrade: IsoDate | null;
  /** 継続取引した相手会社の集合。件数は導出値（continuousCount）にして二重管理を避ける。 */
  readonly continuousPartnerIds: readonly CompanyId[];
}

export const initialCompanyMetrics: CompanyMetrics = {
  completed: 0,
  paidCount: 0,
  onTimeCount: 0,
  lateCount: 0,
  avgPayDays: 0,
  lastTrade: null,
  continuousPartnerIds: [],
};
