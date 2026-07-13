import { CompanyId, Money, TransactionId } from "../shared";
import { initialBillingTrack } from "../billing";
import { initialOrderState } from "../order";
import { initialWorkTrack } from "../work";
import { ClosingDay, JobType, Phase, PayTerm, PayType, PhaseSchedule, Transaction } from "./types";

export interface CreateTransactionInput {
  readonly id: TransactionId;
  readonly projectName: string;
  readonly jobType: JobType;
  readonly region: string;
  readonly address: string;
  readonly need: number | null;
  readonly payType: PayType;
  readonly closing: ClosingDay;
  readonly payTerm: PayTerm;
  readonly primeId: CompanyId;
  readonly partnerId: CompanyId;
  readonly guaranteed: boolean;
  readonly chatKey: string;
  readonly overallSchedule: PhaseSchedule;
  readonly assemblySchedule: PhaseSchedule;
  readonly dismantleSchedule: PhaseSchedule;
  readonly assemblyAmount: Money | null;
  readonly dismantleAmount: Money | null;
}

function initialPhase(schedule: PhaseSchedule, amount: Money | null): Phase {
  return { schedule, amount, work: initialWorkTrack, bill: initialBillingTrack };
}

/** 案件から取引を起こすとき（マッチング成立時）に使う唯一の生成経路。 */
export function createTransaction(input: CreateTransactionInput): Transaction {
  return {
    id: input.id,
    projectName: input.projectName,
    jobType: input.jobType,
    region: input.region,
    address: input.address,
    need: input.need,
    payType: input.payType,
    closing: input.closing,
    payTerm: input.payTerm,
    primeId: input.primeId,
    partnerId: input.partnerId,
    guaranteed: input.guaranteed,
    chatKey: input.chatKey,
    overallSchedule: input.overallSchedule,
    phases: {
      assembly: initialPhase(input.assemblySchedule, input.assemblyAmount),
      dismantle: initialPhase(input.dismantleSchedule, input.dismantleAmount),
    },
    order: initialOrderState,
    status: "in_progress",
    completion: null,
    issues: [],
    consultations: [],
    scheduleNotice: null,
    ashibase: { linked: false, linkedAt: null },
    startedAt: null,
  };
}
