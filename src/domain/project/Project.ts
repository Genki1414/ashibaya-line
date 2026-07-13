import { CompanyId, DomainError, IsoDate, Money, ProjectId, Result, andThen, err, money, ok } from "../shared";
import { ClosingDay, JobType, PayTerm, PayType, PhaseSchedule } from "../transaction";
import { Project } from "./types";

export interface PostProjectInput {
  readonly id: ProjectId;
  readonly name: string;
  readonly jobType: JobType;
  readonly region: string;
  readonly address: string;
  readonly overallSchedule: PhaseSchedule;
  readonly assemblySchedule: PhaseSchedule;
  readonly dismantleSchedule: PhaseSchedule;
  readonly need: number | null;
  readonly unitPrice: number;
  readonly payType: PayType;
  readonly closing: ClosingDay;
  readonly payTerm: PayTerm;
  readonly workDescription: string;
  readonly belongings: string;
  readonly applicationDeadline: IsoDate;
  readonly postedAt: IsoDate;
  readonly guaranteed: boolean;
  readonly primeId: CompanyId;
}

export function postProject(input: PostProjectInput): Result<Project> {
  if (input.need !== null && (!Number.isInteger(input.need) || input.need <= 0)) {
    return err(new DomainError("INVALID_NEED", "募集人数は1以上の整数で指定してください"));
  }
  return andThen(money(input.unitPrice), (unitPrice) =>
    ok({
      id: input.id,
      stage: "recruiting",
      name: input.name,
      jobType: input.jobType,
      region: input.region,
      address: input.address,
      overallSchedule: input.overallSchedule,
      assemblySchedule: input.assemblySchedule,
      dismantleSchedule: input.dismantleSchedule,
      need: input.need,
      unitPrice,
      payType: input.payType,
      closing: input.closing,
      payTerm: input.payTerm,
      workDescription: input.workDescription,
      belongings: input.belongings,
      applicationDeadline: input.applicationDeadline,
      postedAt: input.postedAt,
      guaranteed: input.guaranteed,
      primeId: input.primeId,
      applicantIds: [],
    }),
  );
}

export type EditProjectInput = Omit<PostProjectInput, "id" | "postedAt" | "primeId">;

/** 募集中の案件の内容を差し替える。id/stage/応募者/元請/投稿日は保持する。 */
export function editProject(project: Project, input: EditProjectInput): Result<Project> {
  if (project.stage !== "recruiting") {
    return err(new DomainError("PROJECT_NOT_RECRUITING", "選定済みの案件は編集できません"));
  }
  if (input.need !== null && (!Number.isInteger(input.need) || input.need <= 0)) {
    return err(new DomainError("INVALID_NEED", "募集人数は1以上の整数で指定してください"));
  }
  return andThen(money(input.unitPrice), (unitPrice) =>
    ok({
      ...project,
      name: input.name,
      jobType: input.jobType,
      region: input.region,
      address: input.address,
      overallSchedule: input.overallSchedule,
      assemblySchedule: input.assemblySchedule,
      dismantleSchedule: input.dismantleSchedule,
      need: input.need,
      unitPrice,
      payType: input.payType,
      closing: input.closing,
      payTerm: input.payTerm,
      workDescription: input.workDescription,
      belongings: input.belongings,
      applicationDeadline: input.applicationDeadline,
      guaranteed: input.guaranteed,
    }),
  );
}

export function applyToProject(project: Project, partnerId: CompanyId): Result<Project> {
  if (project.stage !== "recruiting") {
    return err(new DomainError("PROJECT_NOT_RECRUITING", "この案件はすでに選定済みです"));
  }
  if (partnerId === project.primeId) {
    return err(new DomainError("SELF_APPLICATION", "自社の案件には応募できません"));
  }
  if (project.applicantIds.includes(partnerId)) {
    return err(new DomainError("ALREADY_APPLIED", "すでに応募済みです"));
  }
  return ok({ ...project, applicantIds: [...project.applicantIds, partnerId] });
}

/** 応援＝日額×募集人数（未定なら2名換算）、請負＝請負金額そのまま（元プロトタイプの計算式を踏襲）。 */
export function contractAmount(project: Project): Money {
  if (project.jobType === "contract") return project.unitPrice;
  return (project.unitPrice * (project.need ?? 2)) as Money;
}
