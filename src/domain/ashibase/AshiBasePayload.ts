import { IsoDate, Money, addMoney, zeroMoney } from "../shared";
import { ClosingDay, JobType, PayTerm, PayType, PhaseKey, PhaseSchedule, Transaction, PHASE_KEYS } from "../transaction";
import { WorkStatus } from "../work";

/**
 * 施工管理側（AshiBase）へ渡す正規化ペイロード。実フィールド名・型・単位は
 * AshiBase 側のAPI仕様に合わせて別途マッピングする前提（本接続は未実装、仕様書7・9章）。
 * ここでは自社ドメインモデルからの変換だけを担う、腐敗防止層（Anti-Corruption Layer）。
 */
export interface AshiBaseScheduleRow {
  readonly plannedStart: IsoDate | null;
  readonly plannedEnd: IsoDate | null;
  readonly actualStart: IsoDate | null;
  readonly actualEnd: IsoDate | null;
  readonly workStatus: WorkStatus;
}

export interface AshiBaseAttendanceRow {
  readonly phase: PhaseKey;
  readonly date: IsoDate;
  readonly kind: "start" | "end";
  readonly people: number | null;
}

export interface AshiBaseBillingRow {
  readonly phase: PhaseKey;
  readonly invoicedAmount: Money;
  readonly invoicedAt: IsoDate;
  readonly dueDate: IsoDate;
  readonly paidAt: IsoDate | null;
  readonly depositConfirmed: boolean;
}

export interface AshiBasePayload {
  readonly project: {
    readonly name: string;
    readonly jobType: JobType;
    readonly region: string;
    readonly address: string;
    readonly overallSchedule: PhaseSchedule;
  };
  readonly schedule: { readonly assembly: AshiBaseScheduleRow; readonly dismantle: AshiBaseScheduleRow };
  readonly attendance: readonly AshiBaseAttendanceRow[];
  readonly billing: {
    readonly contractAmount: Money;
    readonly payType: PayType;
    readonly assemblyAmount: Money | null;
    readonly dismantleAmount: Money | null;
    readonly closing: ClosingDay;
    readonly payTerm: PayTerm;
    readonly rows: readonly AshiBaseBillingRow[];
  };
  readonly partner: { readonly primeName: string; readonly partnerName: string };
  readonly documents: { readonly orderIssuedAt: IsoDate | null; readonly orderAcknowledgedAt: IsoDate | null };
}

function scheduleRow(tx: Transaction, phase: PhaseKey): AshiBaseScheduleRow {
  const p = tx.phases[phase];
  return {
    plannedStart: p.schedule.plannedStart,
    plannedEnd: p.schedule.plannedEnd,
    actualStart: p.work.startDate,
    actualEnd: p.work.endDate,
    workStatus: p.work.status,
  };
}

function attendanceRows(tx: Transaction): AshiBaseAttendanceRow[] {
  return PHASE_KEYS.flatMap((phase) => tx.phases[phase].work.sessions.map((session) => ({ phase, date: session.date, kind: session.kind, people: session.people })));
}

function billingRows(tx: Transaction): AshiBaseBillingRow[] {
  return PHASE_KEYS.filter((phase) => tx.phases[phase].bill.invoice !== null).map((phase) => {
    const bill = tx.phases[phase].bill;
    const invoice = bill.invoice!;
    return {
      phase,
      invoicedAmount: invoice.amount,
      invoicedAt: invoice.issuedAt,
      dueDate: invoice.dueDate,
      paidAt: bill.payment ? bill.payment.paidAt : null,
      depositConfirmed: bill.status === "deposited",
    };
  });
}

export function buildAshiBasePayload(tx: Transaction, primeName: string, partnerName: string): AshiBasePayload {
  const assemblyAmount = tx.phases.assembly.amount;
  const dismantleAmount = tx.phases.dismantle.amount;
  const contractAmount = addMoney(assemblyAmount ?? zeroMoney(), dismantleAmount ?? zeroMoney());

  return {
    project: { name: tx.projectName, jobType: tx.jobType, region: tx.region, address: tx.address, overallSchedule: tx.overallSchedule },
    schedule: { assembly: scheduleRow(tx, "assembly"), dismantle: scheduleRow(tx, "dismantle") },
    attendance: attendanceRows(tx),
    billing: { contractAmount, payType: tx.payType, assemblyAmount, dismantleAmount, closing: tx.closing, payTerm: tx.payTerm, rows: billingRows(tx) },
    partner: { primeName, partnerName },
    documents: { orderIssuedAt: tx.order.order?.issuedAt ?? null, orderAcknowledgedAt: tx.order.acknowledgement?.issuedAt ?? null },
  };
}
