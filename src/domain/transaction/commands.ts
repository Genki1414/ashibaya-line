import { CompanyId, DomainError, IsoDate, Result, andThen, createEvent, err, ok } from "../shared";
import {
  DepositInput,
  Invoice,
  InvoiceInput,
  Payment,
  PaymentInput,
  checkInvoice as checkInvoiceTrack,
  confirmDeposit as confirmDepositTrack,
  createInvoice,
  createPayment,
  evaluateDeposit,
  registerPayment as registerPaymentTrack,
  submitInvoice as submitInvoiceTrack,
} from "../billing";
import { acknowledgeOrder as acknowledgeOrderDoc, issueOrder as issueOrderDoc } from "../order";
import {
  DailySessionInput,
  ReworkRequest,
  StartWorkInput,
  WorkReport,
  completeRework as completeReworkTrack,
  confirm as confirmWorkTrack,
  recordDailySession as recordDailySessionTrack,
  reportCompletion as reportCompletionTrack,
  requestRework as requestReworkTrack,
  start as startWorkTrack,
} from "../work";
import { averagePayDays, canBillPhase, dismantleLocked, isAllOnTime, isTransactionComplete } from "./queries";
import { Actor, Issue, Phase, PhaseKey, PhaseSchedule, Transaction } from "./types";
import { TransactionEvent } from "./events";

export interface CommandResult {
  readonly transaction: Transaction;
  readonly events: readonly TransactionEvent[];
}

const ACTOR_LABEL: Record<Actor, string> = { prime: "元請", partner: "協力会社" };

function requireActor(actor: Actor, required: Actor | "either", action: string): Result<true> {
  if (required !== "either" && actor !== required) {
    return err(new DomainError("FORBIDDEN_ACTOR", `「${action}」は${ACTOR_LABEL[required]}のみ操作できます`));
  }
  return ok(true);
}

function actorCompanyId(tx: Transaction, actor: Actor): CompanyId {
  return actor === "prime" ? tx.primeId : tx.partnerId;
}

function withPhase(tx: Transaction, phase: PhaseKey, patch: Partial<Phase>): Transaction {
  return { ...tx, phases: { ...tx.phases, [phase]: { ...tx.phases[phase], ...patch } } };
}

function checkCompletion(tx: Transaction, at: IsoDate): CommandResult {
  if (!isTransactionComplete(tx)) return { transaction: tx, events: [] };
  const onTime = isAllOnTime(tx);
  const avgPayDays = averagePayDays(tx);
  const completed: Transaction = { ...tx, status: "completed", completion: { onTime, avgPayDays, completedAt: at } };
  const event = createEvent("TransactionCompleted", at, {
    transactionId: tx.id,
    primeId: tx.primeId,
    partnerId: tx.partnerId,
    onTime,
    avgPayDays,
  });
  return { transaction: completed, events: [event] };
}

/* ============================ 取引開始・契約書類 ============================ */

export function startTransaction(tx: Transaction, actor: Actor, at: IsoDate): Result<CommandResult> {
  const guard = requireActor(actor, "partner", "取引開始");
  if (!guard.ok) return guard;
  if (tx.startedAt) return err(new DomainError("TRANSACTION_ALREADY_STARTED", "取引はすでに開始されています"));
  const transaction: Transaction = { ...tx, startedAt: at };
  const event = createEvent("TransactionStarted", at, { transactionId: tx.id, startedBy: tx.partnerId });
  return ok({ transaction, events: [event] });
}

export function issueOrder(tx: Transaction, actor: Actor, at: IsoDate): Result<CommandResult> {
  const guard = requireActor(actor, "prime", "注文書の発行");
  if (!guard.ok) return guard;
  if (!tx.startedAt) return err(new DomainError("TRANSACTION_NOT_STARTED", "取引開始前は注文書を発行できません"));
  return andThen(issueOrderDoc(tx.order, at), (order) => {
    const transaction: Transaction = { ...tx, order };
    const event = createEvent("OrderIssued", at, { transactionId: tx.id });
    return ok({ transaction, events: [event] });
  });
}

export function acknowledgeOrder(tx: Transaction, actor: Actor, at: IsoDate): Result<CommandResult> {
  const guard = requireActor(actor, "partner", "注文請書の発行");
  if (!guard.ok) return guard;
  return andThen(acknowledgeOrderDoc(tx.order, at), (order) => {
    const transaction: Transaction = { ...tx, order };
    const event = createEvent("OrderAcknowledged", at, { transactionId: tx.id });
    return ok({ transaction, events: [event] });
  });
}

/* ============================ 作業トラック ============================ */

export function startWork(tx: Transaction, phase: PhaseKey, actor: Actor, input: StartWorkInput, at: IsoDate): Result<CommandResult> {
  if (phase === "dismantle" && dismantleLocked(tx)) {
    return err(new DomainError("DISMANTLE_LOCKED", "組立作業の完了確認が済むまで解体作業は開始できません"));
  }
  return andThen(startWorkTrack(tx.phases[phase].work, input), (work) => {
    const transaction = withPhase(tx, phase, { work });
    const event = createEvent("WorkStarted", at, {
      transactionId: tx.id,
      phase,
      date: input.date,
      people: input.people,
      reportedBy: actorCompanyId(tx, actor),
    });
    return ok({ transaction, events: [event] });
  });
}

export function recordDailySession(
  tx: Transaction,
  phase: PhaseKey,
  actor: Actor,
  input: DailySessionInput,
  at: IsoDate,
): Result<CommandResult> {
  return andThen(recordDailySessionTrack(tx.phases[phase].work, input), (work) => {
    const transaction = withPhase(tx, phase, { work });
    const event = createEvent("WorkDailySessionRecorded", at, {
      transactionId: tx.id,
      phase,
      date: input.date,
      kind: input.kind,
      reportedBy: actorCompanyId(tx, actor),
    });
    return ok({ transaction, events: [event] });
  });
}

export function reportWorkCompletion(
  tx: Transaction,
  phase: PhaseKey,
  actor: Actor,
  report: WorkReport,
  at: IsoDate,
): Result<CommandResult> {
  const guard = requireActor(actor, "partner", "完了報告");
  if (!guard.ok) return guard;
  return andThen(reportCompletionTrack(tx.phases[phase].work, report), (work) => {
    const transaction = withPhase(tx, phase, { work });
    const event = createEvent("WorkCompletionReported", at, { transactionId: tx.id, phase, date: report.date, days: report.days });
    return ok({ transaction, events: [event] });
  });
}

export function confirmWork(tx: Transaction, phase: PhaseKey, actor: Actor, at: IsoDate): Result<CommandResult> {
  const guard = requireActor(actor, "prime", "完了確認");
  if (!guard.ok) return guard;
  return andThen(confirmWorkTrack(tx.phases[phase].work), (work) => {
    const transaction = withPhase(tx, phase, { work });
    const event = createEvent("WorkConfirmed", at, { transactionId: tx.id, phase });
    return ok({ transaction, events: [event] });
  });
}

export function requestRework(tx: Transaction, phase: PhaseKey, actor: Actor, text: string, at: IsoDate): Result<CommandResult> {
  const guard = requireActor(actor, "prime", "是正・手直し依頼");
  if (!guard.ok) return guard;
  const request: ReworkRequest = { text, requestedAt: at };
  return andThen(requestReworkTrack(tx.phases[phase].work, request), (work) => {
    const transaction = withPhase(tx, phase, { work });
    const event = createEvent("ReworkRequested", at, { transactionId: tx.id, phase, text });
    return ok({ transaction, events: [event] });
  });
}

export function completeRework(tx: Transaction, phase: PhaseKey, actor: Actor, at: IsoDate): Result<CommandResult> {
  const guard = requireActor(actor, "partner", "是正・手直し完了");
  if (!guard.ok) return guard;
  return andThen(completeReworkTrack(tx.phases[phase].work), (work) => {
    const transaction = withPhase(tx, phase, { work });
    const event = createEvent("ReworkCompleted", at, { transactionId: tx.id, phase });
    return ok({ transaction, events: [event] });
  });
}

/* ============================ 請求トラック ============================ */

function requireBillablePhase(tx: Transaction, phase: PhaseKey): Result<true> {
  if (tx.phases[phase].work.status !== "confirmed") {
    return err(new DomainError("WORK_NOT_CONFIRMED", "作業完了の確認が済むまで請求できません"));
  }
  if (!canBillPhase(tx.payType, phase)) {
    return err(new DomainError("PHASE_NOT_BILLABLE", "一括請負では組立分は請求しません（解体完了後に全額請求します）"));
  }
  return ok(true);
}

export function submitInvoice(tx: Transaction, phase: PhaseKey, actor: Actor, input: InvoiceInput, at: IsoDate): Result<CommandResult> {
  const roleGuard = requireActor(actor, "partner", "請求書の提出");
  if (!roleGuard.ok) return roleGuard;
  const billableGuard = requireBillablePhase(tx, phase);
  if (!billableGuard.ok) return billableGuard;

  return andThen(createInvoice(input), (invoice: Invoice) =>
    andThen(submitInvoiceTrack(tx.phases[phase].bill, invoice), (bill) => {
      const transaction = withPhase(tx, phase, { bill });
      const event = createEvent("InvoiceSubmitted", at, { transactionId: tx.id, phase, amount: invoice.amount, dueDate: invoice.dueDate });
      return ok({ transaction, events: [event] });
    }),
  );
}

export function checkInvoice(tx: Transaction, phase: PhaseKey, actor: Actor, at: IsoDate): Result<CommandResult> {
  const guard = requireActor(actor, "prime", "請求書の確認");
  if (!guard.ok) return guard;
  return andThen(checkInvoiceTrack(tx.phases[phase].bill), (bill) => {
    const transaction = withPhase(tx, phase, { bill });
    const event = createEvent("InvoiceChecked", at, { transactionId: tx.id, phase });
    return ok({ transaction, events: [event] });
  });
}

export function registerPayment(tx: Transaction, phase: PhaseKey, actor: Actor, input: PaymentInput, at: IsoDate): Result<CommandResult> {
  const guard = requireActor(actor, "prime", "支払い登録");
  if (!guard.ok) return guard;
  return andThen(createPayment(input), (payment: Payment) =>
    andThen(registerPaymentTrack(tx.phases[phase].bill, payment), (bill) => {
      const transaction = withPhase(tx, phase, { bill });
      const event = createEvent("PaymentRegistered", at, { transactionId: tx.id, phase, amount: payment.amount });
      return ok({ transaction, events: [event] });
    }),
  );
}

export function confirmDeposit(tx: Transaction, phase: PhaseKey, actor: Actor, input: DepositInput, at: IsoDate): Result<CommandResult> {
  const guard = requireActor(actor, "partner", "入金確認");
  if (!guard.ok) return guard;

  const billTrack = tx.phases[phase].bill;
  if (!billTrack.invoice) return err(new DomainError("INVOICE_MISSING", "請求書が未提出のため入金確認できません"));

  return andThen(evaluateDeposit(input, billTrack.invoice.amount), (evaluation) =>
    andThen(confirmDepositTrack(billTrack, evaluation), (result) => {
      if (result.hasDiscrepancy) {
        const issue: Issue = {
          raisedBy: tx.partnerId,
          text: `${phase === "assembly" ? "組立" : "解体"}分の入金額に請求額との差額があります。確認をお願いします。`,
          raisedAt: at,
          resolved: false,
        };
        const transaction: Transaction = { ...tx, issues: [...tx.issues, issue] };
        const event = createEvent("DepositDiscrepancyRaised", at, {
          transactionId: tx.id,
          phase,
          invoicedAmount: billTrack.invoice!.amount,
          depositedAmount: evaluation.deposit.amount,
        });
        return ok({ transaction, events: [event] });
      }

      const afterDeposit = withPhase(tx, phase, { bill: result.track });
      const depositEvent = createEvent("DepositConfirmed", at, { transactionId: tx.id, phase, amount: evaluation.deposit.amount });
      const { transaction, events: completionEvents } = checkCompletion(afterDeposit, at);
      return ok({ transaction, events: [depositEvent, ...completionEvents] });
    }),
  );
}

/* ============================ 確認事項・相談 ============================ */

export function raiseIssue(tx: Transaction, actor: Actor, text: string, at: IsoDate): Result<CommandResult> {
  const issue: Issue = { raisedBy: actorCompanyId(tx, actor), text, raisedAt: at, resolved: false };
  const transaction: Transaction = { ...tx, issues: [...tx.issues, issue] };
  const event = createEvent("IssueRaised", at, { transactionId: tx.id, raisedBy: issue.raisedBy, text });
  return ok({ transaction, events: [event] });
}

export function resolveIssue(tx: Transaction, actor: Actor, at: IsoDate): Result<CommandResult> {
  const guard = requireActor(actor, "prime", "確認事項の解決");
  if (!guard.ok) return guard;
  if (!tx.issues.some((issue) => !issue.resolved)) {
    return err(new DomainError("NO_OPEN_ISSUE", "未解決の確認事項がありません"));
  }
  const transaction: Transaction = { ...tx, issues: tx.issues.map((issue) => ({ ...issue, resolved: true })) };
  const event = createEvent("IssueResolved", at, { transactionId: tx.id });
  return ok({ transaction, events: [event] });
}

export function requestConsultation(tx: Transaction, actor: Actor, text: string, at: IsoDate): Result<CommandResult> {
  const consultation = { requestedBy: actorCompanyId(tx, actor), text, requestedAt: at };
  const transaction: Transaction = { ...tx, consultations: [...tx.consultations, consultation] };
  const event = createEvent("ConsultationRequested", at, { transactionId: tx.id, requestedBy: consultation.requestedBy, text });
  return ok({ transaction, events: [event] });
}

/* ============================ 工期・予定変更 ============================ */

export interface ScheduleChangeInput {
  readonly overallSchedule?: PhaseSchedule;
  readonly assemblySchedule?: PhaseSchedule;
  readonly dismantleSchedule?: PhaseSchedule;
}

export function changeSchedule(tx: Transaction, actor: Actor, input: ScheduleChangeInput, at: IsoDate): Result<CommandResult> {
  const guard = requireActor(actor, "prime", "工期・予定の変更");
  if (!guard.ok) return guard;

  const changes: { field: string; from: IsoDate | null; to: IsoDate | null }[] = [];
  if (input.overallSchedule && (input.overallSchedule.plannedStart !== tx.overallSchedule.plannedStart || input.overallSchedule.plannedEnd !== tx.overallSchedule.plannedEnd)) {
    changes.push({ field: "工期", from: tx.overallSchedule.plannedStart, to: input.overallSchedule.plannedStart });
    changes.push({ field: "工期終了", from: tx.overallSchedule.plannedEnd, to: input.overallSchedule.plannedEnd });
  }
  if (input.assemblySchedule && (input.assemblySchedule.plannedStart !== tx.phases.assembly.schedule.plannedStart || input.assemblySchedule.plannedEnd !== tx.phases.assembly.schedule.plannedEnd)) {
    changes.push({ field: "組立予定開始", from: tx.phases.assembly.schedule.plannedStart, to: input.assemblySchedule.plannedStart });
    changes.push({ field: "組立予定終了", from: tx.phases.assembly.schedule.plannedEnd, to: input.assemblySchedule.plannedEnd });
  }
  if (input.dismantleSchedule && (input.dismantleSchedule.plannedStart !== tx.phases.dismantle.schedule.plannedStart || input.dismantleSchedule.plannedEnd !== tx.phases.dismantle.schedule.plannedEnd)) {
    changes.push({ field: "解体予定開始", from: tx.phases.dismantle.schedule.plannedStart, to: input.dismantleSchedule.plannedStart });
    changes.push({ field: "解体予定終了", from: tx.phases.dismantle.schedule.plannedEnd, to: input.dismantleSchedule.plannedEnd });
  }
  if (changes.length === 0) return ok({ transaction: tx, events: [] });

  let transaction: Transaction = { ...tx, scheduleNotice: { changes, notifiedAt: at, acknowledged: false } };
  if (input.overallSchedule) transaction = { ...transaction, overallSchedule: input.overallSchedule };
  if (input.assemblySchedule) transaction = withPhase(transaction, "assembly", { schedule: input.assemblySchedule });
  if (input.dismantleSchedule) transaction = withPhase(transaction, "dismantle", { schedule: input.dismantleSchedule });

  const event = createEvent("ScheduleChanged", at, { transactionId: tx.id, changes });
  return ok({ transaction, events: [event] });
}

export function acknowledgeSchedule(tx: Transaction, actor: Actor, at: IsoDate): Result<CommandResult> {
  const guard = requireActor(actor, "partner", "工期・予定変更の確認");
  if (!guard.ok) return guard;
  if (!tx.scheduleNotice) return err(new DomainError("NO_SCHEDULE_NOTICE", "確認すべき工期・予定変更はありません"));
  const transaction: Transaction = { ...tx, scheduleNotice: { ...tx.scheduleNotice, acknowledged: true } };
  const event = createEvent("ScheduleAcknowledged", at, { transactionId: tx.id });
  return ok({ transaction, events: [event] });
}

/* ============================ AshiBase連携 ============================ */

export function linkAshiBase(tx: Transaction, actor: Actor, at: IsoDate): Result<CommandResult> {
  const guard = requireActor(actor, "prime", "AshiBase連携");
  if (!guard.ok) return guard;
  const transaction: Transaction = { ...tx, ashibase: { linked: true, linkedAt: at } };
  const event = createEvent("AshiBaseLinked", at, { transactionId: tx.id });
  return ok({ transaction, events: [event] });
}
