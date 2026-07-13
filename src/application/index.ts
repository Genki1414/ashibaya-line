export type { AppResult, AppError } from "./AppResult";
export { appOk, appErr } from "./AppResult";
export { errorMessage, toAppError } from "./errorMessage";
export type {
  TransactionRepository,
  CompanyRepository,
  ProjectRepository,
  EventStore,
  StoredEvent,
  CreditProcessor,
} from "./ports";
export { TransactionService } from "./TransactionService";
export type { TransactionServiceDeps } from "./TransactionService";
export { ProjectService } from "./ProjectService";
export type { ProjectServiceDeps, PostProjectCommand } from "./ProjectService";
export { MatchingService } from "./MatchingService";
export type { MatchingServiceDeps } from "./MatchingService";
