import { TransactionEvent } from "../../domain/transaction";
import { CreditProcessor } from "../../application/ports";

/**
 * Supabase 経路の信用実績プロセッサは no-op。
 * TransactionCompleted イベントを domain_events に insert した時点で、
 * DB の AFTER INSERT トリガ（apply_transaction_completion, SECURITY DEFINER）が
 * 相手会社の metrics を冪等に更新するため、アプリ層では何もしない。
 */
export class SupabaseCreditProcessor implements CreditProcessor {
  async onTransactionCompleted(_event: Extract<TransactionEvent, { name: "TransactionCompleted" }>): Promise<void> {
    void _event;
  }
}
