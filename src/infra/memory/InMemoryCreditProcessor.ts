import { applyCompletionAsPartner, applyCompletionAsPrime } from "../../domain/credit";
import { CompanyId } from "../../domain/shared";
import { TransactionEvent } from "../../domain/transaction";
import { CompanyRepository, CreditProcessor } from "../../application/ports";

type CompletedEvent = Extract<TransactionEvent, { name: "TransactionCompleted" }>;

/**
 * テスト／開発用の信用実績プロセッサ。Supabase 実装では DB トリガが担う処理を、
 * インメモリ経路では credit.applyCompletion* を使ってこの層で再現する。
 * 冪等化のため処理済みイベント（transactionId）を記録する。
 */
export class InMemoryCreditProcessor implements CreditProcessor {
  private readonly processed = new Set<string>();

  constructor(private readonly companies: CompanyRepository) {}

  async onTransactionCompleted(event: CompletedEvent): Promise<void> {
    const { transactionId, primeId, partnerId, onTime, avgPayDays } = event.payload;
    if (this.processed.has(transactionId)) return;

    const outcome = { onTime, avgPayDays, completedAt: event.occurredAt };
    const prime = await this.companies.load(primeId as CompanyId);
    if (prime) {
      await this.companies.save({ ...prime, metrics: applyCompletionAsPrime(prime.metrics, partnerId as CompanyId, outcome) });
    }
    const partner = await this.companies.load(partnerId as CompanyId);
    if (partner) {
      await this.companies.save({ ...partner, metrics: applyCompletionAsPartner(partner.metrics, primeId as CompanyId, outcome) });
    }
    this.processed.add(transactionId);
  }
}
