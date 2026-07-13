import { IsoDate, Money, Result, TransactionId } from "../shared";

export interface GuaranteeRequest {
  readonly transactionId: TransactionId;
  readonly amount: Money;
  readonly requestedAt: IsoDate;
}

export interface GuaranteeDecision {
  readonly approved: boolean;
  readonly referenceId: string;
  readonly decidedAt: IsoDate;
}

/**
 * 売掛保証会社との連携ポート。仕様書9・10章のとおり、現状は表示・導線のみで
 * 資金処理は未実装（貸金業・保険業等の要専門家確認事項のため）。将来の実装が
 * ここに差し込めるよう型だけ用意しておく。
 */
export interface GuaranteeGateway {
  requestCoverage(request: GuaranteeRequest): Promise<Result<GuaranteeDecision>>;
}
