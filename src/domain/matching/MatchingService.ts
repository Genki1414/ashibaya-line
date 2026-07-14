import { CompanyId, DomainError, DomainEvent, IsoDate, Money, Result, TransactionId, createEvent, err, ok } from "../shared";
import { Project, contractAmount } from "../project";
import { CommandResult, Transaction, createTransaction } from "../transaction";

export interface SelectPartnerInput {
  readonly transactionId: TransactionId;
  readonly chatKey: string;
  readonly at: IsoDate;
}

export type ProjectMatchedPayload = { readonly projectId: string; readonly transactionId: TransactionId; readonly primeId: CompanyId; readonly partnerId: CompanyId };
export type ProjectMatchedEvent = DomainEvent<"ProjectMatched", ProjectMatchedPayload>;

export interface SelectPartnerResult {
  readonly project: Project;
  readonly transaction: Transaction;
  readonly events: readonly (CommandResult["events"][number] | ProjectMatchedEvent)[];
}

function splitPhaseAmounts(project: Project): { assemblyAmount: Money | null; dismantleAmount: Money | null } {
  const base = contractAmount(project);
  // 応援（人工）は単相。全額を作業フェーズ（assembly）に置き、解体は使わない。
  if (project.jobType === "support") {
    return { assemblyAmount: base, dismantleAmount: null };
  }
  if (project.payType === "lump") {
    return { assemblyAmount: null, dismantleAmount: base };
  }
  const assemblyAmount = Math.round(base / 2) as Money;
  const dismantleAmount = (base - assemblyAmount) as Money;
  return { assemblyAmount, dismantleAmount };
}

/**
 * 応募者ごとの案件専用チャットを引き継ぐ形で取引を起こす（仕様書3・7章）。
 * Project 集約と Transaction 集約をまたぐため、どちらのメソッドにも属さない
 * ドメインサービスとして実装する。
 */
export function selectPartnerForProject(project: Project, partnerId: CompanyId, input: SelectPartnerInput): Result<SelectPartnerResult> {
  if (project.stage !== "recruiting") {
    return err(new DomainError("PROJECT_NOT_RECRUITING", "この案件はすでに選定済みです"));
  }
  if (!project.applicantIds.includes(partnerId)) {
    return err(new DomainError("NOT_AN_APPLICANT", "応募していない会社を選定することはできません"));
  }

  // 選定会社には募集要項の閲覧を自動許可する。
  const disclosedTo = project.disclosedTo.includes(partnerId) ? project.disclosedTo : [...project.disclosedTo, partnerId];
  const matchedProject: Project = { ...project, stage: "matched", disclosedTo };
  const { assemblyAmount, dismantleAmount } = splitPhaseAmounts(project);

  const transaction = createTransaction({
    id: input.transactionId,
    projectName: project.name,
    jobType: project.jobType,
    region: project.region,
    address: project.address,
    need: project.need,
    payType: project.payType,
    closing: project.closing,
    payTerm: project.payTerm,
    primeId: project.primeId,
    partnerId,
    // 売掛保証は受注側が取引開始（受諾）時に選択するため、生成時は未適用で始める。
    guaranteed: false,
    chatKey: input.chatKey,
    overallSchedule: project.overallSchedule,
    assemblySchedule: project.assemblySchedule,
    dismantleSchedule: project.dismantleSchedule,
    assemblyAmount,
    dismantleAmount,
  });

  const event = createEvent("ProjectMatched", input.at, {
    projectId: project.id,
    transactionId: transaction.id,
    primeId: project.primeId,
    partnerId,
  });

  return ok({ project: matchedProject, transaction, events: [event] });
}
