import { CompanyId, IsoDate, Money, ProjectId } from "../shared";
import { ClosingDay, JobType, PayTerm, PayType, PhaseSchedule } from "../transaction";

export type ProjectStage = "recruiting" | "matched";

export interface Project {
  readonly id: ProjectId;
  readonly stage: ProjectStage;
  readonly name: string;
  readonly jobType: JobType;
  readonly region: string;
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
}
