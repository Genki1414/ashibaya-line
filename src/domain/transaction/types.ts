import { CompanyId, IsoDate, Money, TransactionId } from "../shared";
import { OrderState } from "../order";
import { BillingTrack } from "../billing";
import { WorkTrack } from "../work";

export type PhaseKey = "assembly" | "dismantle";
export type JobType = "support" | "contract";
export type PayType = "progress" | "lump";
export type ClosingDay = "末" | "25" | "20" | "15" | "10";
export type PayTerm = "翌月末" | "翌月25" | "翌月15" | "翌々月末" | "当月末払い";

/** 実際にその操作を行う権限を持つ側。ドメインコマンドはこれを検証し、UIのボタン表示だけに頼らない。 */
export type Actor = "prime" | "partner";

export interface PhaseSchedule {
  readonly plannedStart: IsoDate | null;
  readonly plannedEnd: IsoDate | null;
}

export interface Phase {
  readonly schedule: PhaseSchedule;
  /** 一括請負の組立フェーズなど、請求対象外のフェーズは null。 */
  readonly amount: Money | null;
  readonly work: WorkTrack;
  readonly bill: BillingTrack;
}

export interface Issue {
  readonly raisedBy: CompanyId;
  readonly text: string;
  readonly raisedAt: IsoDate;
  readonly resolved: boolean;
}

export interface Consultation {
  readonly requestedBy: CompanyId;
  readonly text: string;
  readonly requestedAt: IsoDate;
}

export interface ScheduleChange {
  readonly field: string;
  readonly from: IsoDate | null;
  readonly to: IsoDate | null;
}

/** 案件情報（現場・金額など）の変更差分。表示用に from/to を文字列で保持する。 */
export interface InfoChange {
  readonly field: string;
  readonly from: string;
  readonly to: string;
}

export interface ScheduleNotice {
  readonly changes: readonly ScheduleChange[];
  readonly notifiedAt: IsoDate;
  readonly acknowledged: boolean;
}

/** 案件情報（現場・金額）の変更を関係先へ通知し、確認を求める。 */
export interface InfoNotice {
  readonly changes: readonly InfoChange[];
  readonly notifiedAt: IsoDate;
  readonly acknowledged: boolean;
}

export interface AshiBaseLink {
  readonly linked: boolean;
  readonly linkedAt: IsoDate | null;
}

export type TransactionStatus = "in_progress" | "completed";

export interface CompletionRecord {
  readonly onTime: boolean;
  readonly avgPayDays: number;
  readonly completedAt: IsoDate;
}

export interface Transaction {
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
  readonly phases: { readonly assembly: Phase; readonly dismantle: Phase };
  readonly order: OrderState;
  readonly status: TransactionStatus;
  readonly completion: CompletionRecord | null;
  readonly issues: readonly Issue[];
  readonly consultations: readonly Consultation[];
  readonly scheduleNotice: ScheduleNotice | null;
  readonly infoNotice: InfoNotice | null;
  readonly ashibase: AshiBaseLink;
  /** 「取引が開始されました」（協力会社が受諾した時点）。null なら未受諾。 */
  readonly startedAt: IsoDate | null;
}

export const PHASE_KEYS: readonly PhaseKey[] = ["assembly", "dismantle"];
