/**
 * 会社別「実績データ」（客観的事実の集計）。
 *
 * 方針（信用スコアの演出ではなく検証可能な事実の蓄積）:
 *  - 主観レビュー・星評価は持たない。取引イベントから導出できる事実だけを数える。
 *  - 率は保存せず「分子/分母」を保持し、UI 側で「100%（2件中2件）」のように母数付きで表示する。
 *  - 信用レベル(credit)とは完全に分離した独立モジュール。
 *  - 元請（発注側）と協力会社（受注側）の実績を分けて保持する。
 *  - 集計は純粋関数の畳み込みで、差分更新（関係2社の再計算）と全再計算が一致する（冪等）。
 */

/**
 * 将来の「取引中止(TransactionCancelled)」で区別できるようにする分類軸。
 *
 * 【重要】中止操作・合意フロー・判定ロジックは今フェーズでは未実装。
 * ここでは、将来 TransactionCancelled イベントの payload が持ちうる分類を型として先に定義し、
 * 集計側が受け入れられる拡張性だけを用意する（現状 cancelled は常に 0）。
 */
export interface CancellationFacts {
  /** 着工前中止 / 着工後中止 */
  readonly timing: "before_start" | "after_start";
  /** 双方合意 / 元請都合 / 協力会社都合 / 不可抗力 */
  readonly reason: "mutual" | "prime" | "partner" | "force_majeure";
  /** 一部精算あり */
  readonly partialSettlement: boolean;
  /** 未解決の確認事項あり */
  readonly unresolvedIssues: boolean;
}

/** 元請（発注側）としての客観実績。すべて取引イベント／状態から導出。率は持たず分子・分母のみ。 */
export interface PrimePerformance {
  /** 取引完了件数 */
  readonly completed: number;
  /** 支払い完了件数（対象フェーズすべてで支払い登録済み） */
  readonly paid: number;
  /** 期日内支払い件数（完了取引のうち paidAt ≤ dueDate） */
  readonly paidOnTime: number;
  /** 支払い遅延件数（完了取引のうち期日超過） */
  readonly paidLate: number;
  /** 平均支払日数（請求日→支払日）。対象なしは null。 */
  readonly avgPayDays: number | null;
  /** 平均支払日数の母数（＝完了取引数） */
  readonly avgPayDaysBase: number;
  /** 未入金件数（進行中で、協力の請求に対し未払いの取引数） */
  readonly unpaid: number;
  /** 未解決確認事項数（元請取引に紐づく未解決 issue の総数） */
  readonly openIssues: number;
  /** 継続取引会社数（完了取引が2件以上ある協力会社の数） */
  readonly repeatPartners: number;
  /** 取引中止件数（中止操作は未実装のため現状常に 0） */
  readonly cancelled: number;
}

/** 協力会社（受注側）としての客観実績。 */
export interface PartnerPerformance {
  /** 取引完了件数 */
  readonly completed: number;
  /** 作業完了確認件数（対象フェーズすべてが完了確認された取引数） */
  readonly workConfirmed: number;
  /** 完了予定日遵守件数（実完了日 ≤ 合意済み最新予定日） */
  readonly onSchedule: number;
  /** 完了予定日超過件数 */
  readonly overSchedule: number;
  /** 遵守率の母数（予定日を判定できた完了取引数） */
  readonly scheduleBase: number;
  /** 是正発生件数（是正依頼イベントの総数） */
  readonly reworkRaised: number;
  /** 是正解決件数（該当フェーズが完了確認された是正の数） */
  readonly reworkResolved: number;
  /** 未解決是正件数（発生 − 解決） */
  readonly reworkOpen: number;
  /** 継続取引会社数（完了取引が2件以上ある元請の数） */
  readonly repeatPrimes: number;
  /** 取引中止件数（中止操作は未実装のため現状常に 0） */
  readonly cancelled: number;
}

export interface CompanyPerformance {
  readonly asPrime: PrimePerformance;
  readonly asPartner: PartnerPerformance;
}

export function emptyPrimePerformance(): PrimePerformance {
  return {
    completed: 0,
    paid: 0,
    paidOnTime: 0,
    paidLate: 0,
    avgPayDays: null,
    avgPayDaysBase: 0,
    unpaid: 0,
    openIssues: 0,
    repeatPartners: 0,
    cancelled: 0,
  };
}

export function emptyPartnerPerformance(): PartnerPerformance {
  return {
    completed: 0,
    workConfirmed: 0,
    onSchedule: 0,
    overSchedule: 0,
    scheduleBase: 0,
    reworkRaised: 0,
    reworkResolved: 0,
    reworkOpen: 0,
    repeatPrimes: 0,
    cancelled: 0,
  };
}

export function emptyCompanyPerformance(): CompanyPerformance {
  return { asPrime: emptyPrimePerformance(), asPartner: emptyPartnerPerformance() };
}

/**
 * 集計入力の1取引ぶん。tx は最終状態（イベントの畳み込み結果の射影）、
 * events はその取引のドメインイベント列（是正回数・予定変更履歴・中止の判定に使う）。
 */
export interface PerfEvent {
  readonly type: string;
  readonly payload: Record<string, unknown>;
  /** ISO 日付（YYYY-MM-DD） */
  readonly occurredAt: string;
}
