import { Clock, CompanyId, DomainError, Result, TransactionId } from "../domain/shared";
import {
  Actor,
  CommandResult,
  ScheduleChangeInput,
  Transaction,
  TransactionEvent,
  acknowledgeOrder,
  acknowledgeSchedule,
  changeSchedule,
  checkInvoice,
  completeRework,
  confirmDeposit,
  confirmWork,
  issueOrder,
  linkAshiBase,
  raiseIssue,
  recordDailySession,
  registerPayment,
  reportWorkCompletion,
  requestConsultation,
  requestRework,
  resolveIssue,
  startTransaction,
  startWork,
  submitInvoice,
} from "../domain/transaction";
import { DailySessionInput, StartWorkInput, WorkReport } from "../domain/work";
import { InvoiceInput, PaymentInput, DepositInput } from "../domain/billing";
import { CreditProcessor, EventStore, TransactionRepository } from "./ports";
import { AppResult, appErr, appOk } from "./AppResult";
import { toAppError } from "./errorMessage";

export interface TransactionServiceDeps {
  readonly transactions: TransactionRepository;
  readonly events: EventStore;
  readonly credit: CreditProcessor;
  readonly clock: Clock;
}

function roleOf(tx: Transaction, companyId: CompanyId): Actor | null {
  if (tx.primeId === companyId) return "prime";
  if (tx.partnerId === companyId) return "partner";
  return null;
}

/**
 * 取引ユースケース。各メソッドは load → 役割解決 → ドメインコマンド → save ＋ イベント永続化 ＋
 * 完了イベントのディスパッチ、という共通の骨格（run）を通す。役割は取引ごとに
 * 「自社が prime_id か partner_id か」で決まる（グローバルな属性ではない）。
 */
export class TransactionService {
  constructor(private readonly deps: TransactionServiceDeps) {}

  private async run(
    actingCompanyId: CompanyId,
    txId: TransactionId,
    command: (tx: Transaction, role: Actor, at: string) => Result<CommandResult>,
  ): Promise<AppResult<Transaction>> {
    const tx = await this.deps.transactions.load(txId);
    if (!tx) return appErr(toAppError(new DomainError("TRANSACTION_NOT_FOUND", "取引が見つかりません")));

    const role = roleOf(tx, actingCompanyId);
    if (!role) return appErr(toAppError(new DomainError("NOT_A_PARTICIPANT", "この取引の関係者ではありません")));

    const result = command(tx, role, this.deps.clock.today());
    if (!result.ok) return appErr(toAppError(result.error));

    const { transaction, events } = result.value;
    await this.deps.transactions.save(transaction);
    await this.deps.events.append(events);
    for (const event of events) {
      if (event.name === "TransactionCompleted") {
        await this.deps.credit.onTransactionCompleted(event as Extract<TransactionEvent, { name: "TransactionCompleted" }>);
      }
    }
    return appOk(transaction);
  }

  accept(companyId: CompanyId, txId: TransactionId, guaranteed: boolean) {
    return this.run(companyId, txId, (tx, role, at) => startTransaction(tx, role, at, guaranteed));
  }

  issueOrder(companyId: CompanyId, txId: TransactionId) {
    return this.run(companyId, txId, (tx, role, at) => issueOrder(tx, role, at));
  }

  acknowledgeOrder(companyId: CompanyId, txId: TransactionId) {
    return this.run(companyId, txId, (tx, role, at) => acknowledgeOrder(tx, role, at));
  }

  startWork(companyId: CompanyId, txId: TransactionId, phase: "assembly" | "dismantle", input: StartWorkInput) {
    return this.run(companyId, txId, (tx, role, at) => startWork(tx, phase, role, input, at));
  }

  recordDailySession(companyId: CompanyId, txId: TransactionId, phase: "assembly" | "dismantle", input: DailySessionInput) {
    // 日次報告はドメイン側で working 前提のガードを持つ。
    return this.run(companyId, txId, (tx, role, at) => recordDailySession(tx, phase, role, input, at));
  }

  reportWorkCompletion(companyId: CompanyId, txId: TransactionId, phase: "assembly" | "dismantle", report: WorkReport) {
    return this.run(companyId, txId, (tx, role, at) => reportWorkCompletion(tx, phase, role, report, at));
  }

  confirmWork(companyId: CompanyId, txId: TransactionId, phase: "assembly" | "dismantle") {
    return this.run(companyId, txId, (tx, role, at) => confirmWork(tx, phase, role, at));
  }

  requestRework(companyId: CompanyId, txId: TransactionId, phase: "assembly" | "dismantle", text: string) {
    return this.run(companyId, txId, (tx, role, at) => requestRework(tx, phase, role, text, at));
  }

  completeRework(companyId: CompanyId, txId: TransactionId, phase: "assembly" | "dismantle") {
    return this.run(companyId, txId, (tx, role, at) => completeRework(tx, phase, role, at));
  }

  submitInvoice(companyId: CompanyId, txId: TransactionId, phase: "assembly" | "dismantle", input: InvoiceInput) {
    return this.run(companyId, txId, (tx, role, at) => submitInvoice(tx, phase, role, input, at));
  }

  checkInvoice(companyId: CompanyId, txId: TransactionId, phase: "assembly" | "dismantle") {
    return this.run(companyId, txId, (tx, role, at) => checkInvoice(tx, phase, role, at));
  }

  registerPayment(companyId: CompanyId, txId: TransactionId, phase: "assembly" | "dismantle", input: PaymentInput) {
    return this.run(companyId, txId, (tx, role, at) => registerPayment(tx, phase, role, input, at));
  }

  confirmDeposit(companyId: CompanyId, txId: TransactionId, phase: "assembly" | "dismantle", input: DepositInput) {
    return this.run(companyId, txId, (tx, role, at) => confirmDeposit(tx, phase, role, input, at));
  }

  raiseIssue(companyId: CompanyId, txId: TransactionId, text: string) {
    return this.run(companyId, txId, (tx, role, at) => raiseIssue(tx, role, text, at));
  }

  resolveIssue(companyId: CompanyId, txId: TransactionId) {
    return this.run(companyId, txId, (tx, role, at) => resolveIssue(tx, role, at));
  }

  requestConsultation(companyId: CompanyId, txId: TransactionId, text: string) {
    return this.run(companyId, txId, (tx, role, at) => requestConsultation(tx, role, text, at));
  }

  changeSchedule(companyId: CompanyId, txId: TransactionId, input: ScheduleChangeInput) {
    return this.run(companyId, txId, (tx, role, at) => changeSchedule(tx, role, input, at));
  }

  acknowledgeSchedule(companyId: CompanyId, txId: TransactionId) {
    return this.run(companyId, txId, (tx, role, at) => acknowledgeSchedule(tx, role, at));
  }

  linkAshiBase(companyId: CompanyId, txId: TransactionId) {
    return this.run(companyId, txId, (tx, role, at) => linkAshiBase(tx, role, at));
  }
}
