import { CompanyId, DomainEvent, IsoDate, Money, TransactionId } from "../shared";
import { InfoChange, PhaseKey, ScheduleChange } from "./types";

interface Base {
  readonly transactionId: TransactionId;
}

export type TransactionStartedPayload = Base & { readonly startedBy: CompanyId };
export type OrderIssuedPayload = Base;
export type OrderAcknowledgedPayload = Base;
export type WorkStartedPayload = Base & { readonly phase: PhaseKey; readonly date: IsoDate; readonly people: number | null; readonly reportedBy: CompanyId };
export type WorkDailySessionRecordedPayload = Base & { readonly phase: PhaseKey; readonly date: IsoDate; readonly kind: "start" | "end"; readonly reportedBy: CompanyId };
export type WorkCompletionReportedPayload = Base & { readonly phase: PhaseKey; readonly date: IsoDate; readonly days: number };
export type WorkConfirmedPayload = Base & { readonly phase: PhaseKey };
export type ReworkRequestedPayload = Base & { readonly phase: PhaseKey; readonly text: string };
export type ReworkCompletedPayload = Base & { readonly phase: PhaseKey };
export type InvoiceSubmittedPayload = Base & { readonly phase: PhaseKey; readonly amount: Money; readonly dueDate: IsoDate };
export type InvoiceCheckedPayload = Base & { readonly phase: PhaseKey };
export type PaymentRegisteredPayload = Base & { readonly phase: PhaseKey; readonly amount: Money };
export type DepositConfirmedPayload = Base & { readonly phase: PhaseKey; readonly amount: Money };
export type DepositDiscrepancyRaisedPayload = Base & { readonly phase: PhaseKey; readonly invoicedAmount: Money; readonly depositedAmount: Money };
export type IssueRaisedPayload = Base & { readonly raisedBy: CompanyId; readonly text: string };
export type IssueResolvedPayload = Base;
export type ConsultationRequestedPayload = Base & { readonly requestedBy: CompanyId; readonly text: string };
export type ScheduleChangedPayload = Base & { readonly changes: readonly ScheduleChange[] };
export type ScheduleAcknowledgedPayload = Base;
export type TransactionInfoUpdatedPayload = Base & { readonly changes: readonly InfoChange[] };
export type AshiBaseLinkedPayload = Base;
export type TransactionCompletedPayload = Base & {
  readonly primeId: CompanyId;
  readonly partnerId: CompanyId;
  readonly onTime: boolean;
  readonly avgPayDays: number;
};

export type TransactionEvent =
  | DomainEvent<"TransactionStarted", TransactionStartedPayload>
  | DomainEvent<"OrderIssued", OrderIssuedPayload>
  | DomainEvent<"OrderAcknowledged", OrderAcknowledgedPayload>
  | DomainEvent<"WorkStarted", WorkStartedPayload>
  | DomainEvent<"WorkDailySessionRecorded", WorkDailySessionRecordedPayload>
  | DomainEvent<"WorkCompletionReported", WorkCompletionReportedPayload>
  | DomainEvent<"WorkConfirmed", WorkConfirmedPayload>
  | DomainEvent<"ReworkRequested", ReworkRequestedPayload>
  | DomainEvent<"ReworkCompleted", ReworkCompletedPayload>
  | DomainEvent<"InvoiceSubmitted", InvoiceSubmittedPayload>
  | DomainEvent<"InvoiceChecked", InvoiceCheckedPayload>
  | DomainEvent<"PaymentRegistered", PaymentRegisteredPayload>
  | DomainEvent<"DepositConfirmed", DepositConfirmedPayload>
  | DomainEvent<"DepositDiscrepancyRaised", DepositDiscrepancyRaisedPayload>
  | DomainEvent<"IssueRaised", IssueRaisedPayload>
  | DomainEvent<"IssueResolved", IssueResolvedPayload>
  | DomainEvent<"ConsultationRequested", ConsultationRequestedPayload>
  | DomainEvent<"ScheduleChanged", ScheduleChangedPayload>
  | DomainEvent<"ScheduleAcknowledged", ScheduleAcknowledgedPayload>
  | DomainEvent<"TransactionInfoUpdated", TransactionInfoUpdatedPayload>
  | DomainEvent<"AshiBaseLinked", AshiBaseLinkedPayload>
  | DomainEvent<"TransactionCompleted", TransactionCompletedPayload>;
