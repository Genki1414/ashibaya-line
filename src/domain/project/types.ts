import { CompanyId, IsoDate, Money, ProjectId } from "../shared";
import { ClosingDay, JobType, PayTerm, PayType, PhaseSchedule } from "../transaction";

/** recruiting=募集中, paused=一時停止, matched=選定済み, closed=削除（掲載終了）。 */
export type ProjectStage = "recruiting" | "paused" | "matched" | "closed";

export interface Project {
  readonly id: ProjectId;
  readonly stage: ProjectStage;
  readonly name: string;
  readonly jobType: JobType;
  /** 都道府県（検索の正本）。旧データで未分割のものは空文字。 */
  readonly prefecture: string;
  /** 市区町村（検索の正本）。 */
  readonly city: string;
  /** 表示用の地域文字列。prefecture/city から機械生成（旧データ互換で残す）。 */
  readonly region: string;
  /** 町名・番地などの詳細住所（一覧には出しすぎず、詳細で関係範囲に応じて表示）。 */
  readonly address: string;
  readonly overallSchedule: PhaseSchedule;
  readonly assemblySchedule: PhaseSchedule;
  readonly dismantleSchedule: PhaseSchedule;
  /** 応援のときだけ意味を持つ募集人数。任意項目（仕様書7章）。 */
  readonly need: number | null;
  /** 応援＝日額/人工、請負＝請負金額 一式。 */
  readonly unitPrice: Money;
  readonly payType: PayType;
  readonly closing: ClosingDay;
  readonly payTerm: PayTerm;
  readonly workDescription: string;
  readonly belongings: string;
  readonly applicationDeadline: IsoDate;
  readonly postedAt: IsoDate;
  readonly guaranteed: boolean;
  readonly primeId: CompanyId;
  readonly applicantIds: readonly CompanyId[];
  /** 募集要項の詳細を閲覧許可した会社（応募者単位）。元請が許可する。選定会社は自動許可。 */
  readonly disclosedTo: readonly CompanyId[];
}
