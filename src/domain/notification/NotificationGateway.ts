import { CompanyId, Result, TransactionId } from "../shared";

/** 仕様書3・7章のLINE通知カテゴリ（設定画面でON/OFFできる単位）。 */
export type LineNotificationCategory =
  | "newProject"
  | "application"
  | "hired"
  | "chat"
  | "assemblyDone"
  | "dismantleDone"
  | "rework"
  | "billing"
  | "payment"
  | "deposit"
  | "completed";

export interface LineNotification {
  readonly category: LineNotificationCategory;
  readonly recipientCompanyId: CompanyId;
  readonly title: string;
  readonly body: string;
  readonly transactionId: TransactionId | null;
}

/**
 * インフラ層（実際のLINE Messaging API呼び出し）が実装するポート。ドメイン層は
 * 「どんな通知が発生したか」だけを知り、送信方法（LINE以外への差し替えも含む）は知らない。
 */
export interface NotificationGateway {
  send(notification: LineNotification): Promise<Result<void>>;
}
