import { Transaction, TransactionEvent } from "../transaction";
import { LineNotification } from "./NotificationGateway";

const PHASE_LABEL: Record<"assembly" | "dismantle", string> = { assembly: "組立", dismantle: "解体" };

/** ドメインイベントを LINE 通知の候補に変換する。実送信はしない（純粋関数）。 */
export function notificationsForEvent(tx: Transaction, event: TransactionEvent): LineNotification[] {
  switch (event.name) {
    case "WorkCompletionReported": {
      const label = PHASE_LABEL[event.payload.phase];
      return [
        {
          category: event.payload.phase === "assembly" ? "assemblyDone" : "dismantleDone",
          recipientCompanyId: tx.primeId,
          title: `${label}完了報告`,
          body: `${tx.projectName}の${label}完了が報告されました。確認をお願いします。`,
          transactionId: tx.id,
        },
      ];
    }
    case "ReworkRequested": {
      const label = PHASE_LABEL[event.payload.phase];
      return [
        {
          category: "rework",
          recipientCompanyId: tx.partnerId,
          title: "是正・手直し依頼",
          body: `${tx.projectName}の${label}に是正・手直しの依頼があります。`,
          transactionId: tx.id,
        },
      ];
    }
    case "InvoiceSubmitted": {
      const label = PHASE_LABEL[event.payload.phase];
      return [
        {
          category: "billing",
          recipientCompanyId: tx.primeId,
          title: "請求書が提出されました",
          body: `${tx.projectName}（${label}分）の請求書が提出されました。`,
          transactionId: tx.id,
        },
      ];
    }
    case "PaymentRegistered": {
      const label = PHASE_LABEL[event.payload.phase];
      return [
        {
          category: "payment",
          recipientCompanyId: tx.partnerId,
          title: "支払いが登録されました",
          body: `${tx.projectName}（${label}分）が支払い済みとして登録されました。入金確認をお願いします。`,
          transactionId: tx.id,
        },
      ];
    }
    case "DepositConfirmed": {
      const label = PHASE_LABEL[event.payload.phase];
      return [
        {
          category: "deposit",
          recipientCompanyId: tx.primeId,
          title: "入金が確認されました",
          body: `${tx.projectName}（${label}分）の入金が確認されました。`,
          transactionId: tx.id,
        },
      ];
    }
    case "TransactionCompleted": {
      const body = `${tx.projectName}の取引が完了しました。`;
      return [
        { category: "completed", recipientCompanyId: event.payload.primeId, title: "取引完了", body, transactionId: tx.id },
        { category: "completed", recipientCompanyId: event.payload.partnerId, title: "取引完了", body, transactionId: tx.id },
      ];
    }
    default:
      return [];
  }
}
