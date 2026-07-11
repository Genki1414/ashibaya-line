import { Clock, CompanyId, DomainError, ProjectId, TransactionId } from "../domain/shared";
import { selectPartnerForProject } from "../domain/matching";
import { Transaction } from "../domain/transaction";
import { EventStore, ProjectRepository, TransactionRepository } from "./ports";
import { AppResult, appErr, appOk } from "./AppResult";
import { toAppError } from "./errorMessage";

export interface MatchingServiceDeps {
  readonly projects: ProjectRepository;
  readonly transactions: TransactionRepository;
  readonly events: EventStore;
  readonly clock: Clock;
  readonly newId: () => string;
}

/**
 * 応募者を選定し、案件専用チャット（案件ID:会社ID）を引き継ぐ取引を起こすユースケース。
 * Project と Transaction の2集約にまたがるため、ドメインサービス selectPartnerForProject を使う。
 * 案件の更新（matched）と取引の作成は同一リクエストで保存する。
 */
export class MatchingService {
  constructor(private readonly deps: MatchingServiceDeps) {}

  async selectPartner(primeId: CompanyId, projectId: ProjectId, partnerId: CompanyId): Promise<AppResult<Transaction>> {
    const project = await this.deps.projects.load(projectId);
    if (!project) return appErr(toAppError(new DomainError("PROJECT_NOT_FOUND", "案件が見つかりません")));
    if (project.primeId !== primeId) {
      return appErr(toAppError(new DomainError("NOT_A_PARTICIPANT", "自社の案件のみ選定できます")));
    }

    const result = selectPartnerForProject(project, partnerId, {
      transactionId: this.deps.newId() as unknown as TransactionId,
      chatKey: `${projectId}:${partnerId}`,
      at: this.deps.clock.today(),
    });
    if (!result.ok) return appErr(toAppError(result.error));

    const { project: matchedProject, transaction, events } = result.value;
    await this.deps.projects.save(matchedProject);
    await this.deps.transactions.save(transaction);
    await this.deps.events.append(events);
    return appOk(transaction);
  }
}
