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
