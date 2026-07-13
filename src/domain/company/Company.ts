import { CompanyId, IsoDate } from "../shared";
import {
  CompanyFacts,
  CompanyMetrics,
  CreditLevel,
  CreditLevelPolicy,
  VerifyRecord,
  companyFacts,
  determineCreditLevel,
} from "../credit";

/**
 * 会社エンティティ。identity（名前・地域・連絡先）と、信用の素材（verify / metrics）を束ねる。
 * 信用レベルや「確認できる事実」は保存せず、常に credit モジュールから導出する（利用者は編集不可）。
 */
/**
 * 会社の利用ステータス。
 * pending: 自己登録直後（ログイン・プロフィールは可、発注・受注は不可）
 * active:  本部承認済み（発注・受注可）
 * suspended: 停止
 */
export type CompanyStatus = "pending" | "active" | "suspended";

export interface Company {
  readonly id: CompanyId;
  readonly name: string;
  readonly region: string;
  readonly contact: string;
  readonly areas: readonly string[];
  readonly works: readonly string[];
  readonly registeredAt: IsoDate;
  readonly verify: VerifyRecord;
  readonly metrics: CompanyMetrics;
  /** 未設定（デモ等）は active 相当とみなす。 */
  readonly status?: CompanyStatus;
}

/** 発注・受注（案件投稿・応募・選定・取引成立）が許可されているか。 */
export function canTransact(company: Company): boolean {
  return (company.status ?? "active") === "active";
}

export function companyCreditLevel(company: Company, hasOpenIssue: boolean, policy?: CreditLevelPolicy): CreditLevel {
  return determineCreditLevel({ verify: company.verify, metrics: company.metrics, hasOpenIssue }, policy);
}

export function companyFactsOf(company: Company, hasOpenIssue: boolean, today: IsoDate): CompanyFacts {
  return companyFacts({
    verify: company.verify,
    metrics: company.metrics,
    hasOpenIssue,
    registeredAt: company.registeredAt,
    today,
  });
}
