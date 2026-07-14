import { CompanyId, DomainError, IsoDate, Money, ProjectId, Result, andThen, err, money, ok } from "../shared";
import { ClosingDay, JobType, PayTerm, PayType, PhaseSchedule } from "../transaction";
import { Project } from "./types";

/** prefecture / city から表示用の region を機械生成する（今後 region は検索の正本にしない）。 */
export function regionText(prefecture: string, city: string, fallback = ""): string {
  const joined = [prefecture.trim(), city.trim()].filter(Boolean).join(" ");
  return joined || fallback;
}

export interface PostProjectInput {
  readonly id: ProjectId;
  readonly name: string;
  readonly jobType: JobType;
  /** 都道府県・市区町村（検索の正本）。region は生成する。 */
  readonly prefecture?: string;
  readonly city?: string;
  /** 旧データ互換：prefecture/city 未指定時の表示用地域。 */
  readonly region?: string;
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
  const prefecture = (input.prefecture ?? "").trim();
  const city = (input.city ?? "").trim();
  return andThen(money(input.unitPrice), (unitPrice) =>
    ok({
      id: input.id,
      stage: "recruiting",
      name: input.name,
      jobType: input.jobType,
      prefecture,
      city,
      region: regionText(prefecture, city, input.region ?? ""),
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
  const prefecture = (input.prefecture ?? "").trim();
  const city = (input.city ?? "").trim();
  return andThen(money(input.unitPrice), (unitPrice) =>
    ok({
      ...project,
      name: input.name,
      jobType: input.jobType,
      prefecture,
      city,
      region: regionText(prefecture, city, input.region ?? project.region),
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
  if (project.stage === "paused") {
    return err(new DomainError("PROJECT_PAUSED", "この案件は現在、募集を一時停止しています"));
  }
  if (project.stage === "closed") {
    return err(new DomainError("PROJECT_CLOSED", "この案件は掲載を終了しています"));
  }
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

/** 応募の取り消し（応募した協力会社本人のみ）。選定前（募集中・一時停止中）のみ可能。 */
export function withdrawApplication(project: Project, partnerId: CompanyId): Result<Project> {
  if (project.stage === "matched") {
    return err(new DomainError("PROJECT_MATCHED", "選定済みのため応募を取り消せません"));
  }
  if (!project.applicantIds.includes(partnerId)) {
    return err(new DomainError("NOT_APPLIED", "この案件に応募していません"));
  }
  return ok({ ...project, applicantIds: project.applicantIds.filter((a) => a !== partnerId) });
}

/** 掲載の一時停止（元請）。募集中のみ。停止中は検索・応募不可、応募済みの情報は保持。 */
export function pauseProject(project: Project): Result<Project> {
  if (project.stage !== "recruiting") {
    return err(new DomainError("NOT_RECRUITING", "募集中の案件のみ一時停止できます"));
  }
  return ok({ ...project, stage: "paused" });
}

/** 掲載の再開（元請）。一時停止中のみ。 */
export function resumeProject(project: Project): Result<Project> {
  if (project.stage !== "paused") {
    return err(new DomainError("NOT_PAUSED", "一時停止中の案件のみ再開できます"));
  }
  return ok({ ...project, stage: "recruiting" });
}

/** 案件の削除（元請）。選定済みは取引があるため削除不可。論理削除（stage=closed）で一覧から消す。 */
export function closeProject(project: Project): Result<Project> {
  if (project.stage === "matched") {
    return err(new DomainError("PROJECT_MATCHED", "選定済み（取引中）の案件は削除できません"));
  }
  if (project.stage === "closed") {
    return err(new DomainError("ALREADY_CLOSED", "この案件はすでに削除されています"));
  }
  return ok({ ...project, stage: "closed" });
}

/** 応援＝日額×募集人数（未定なら2名換算）、請負＝請負金額そのまま（元プロトタイプの計算式を踏襲）。 */
export function contractAmount(project: Project): Money {
  if (project.jobType === "contract") return project.unitPrice;
  return (project.unitPrice * (project.need ?? 2)) as Money;
}
