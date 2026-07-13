import { IsoDate, Result } from "../shared";
import { AshiBasePayload } from "./AshiBasePayload";

export interface AshiBaseSyncResult {
  readonly externalId: string;
  readonly syncedAt: IsoDate;
}

/**
 * インフラ層（実際のAshiBase API呼び出し）が実装するポート。ドメイン層は
 * このインターフェースにだけ依存し、実装（未確定のAPI仕様）を知らない。
 */
export interface AshiBaseGateway {
  sync(payload: AshiBasePayload): Promise<Result<AshiBaseSyncResult>>;
}
