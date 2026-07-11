import { DomainError } from "../domain/shared";
import { AppError } from "./AppResult";

/**
 * DomainError → ユーザー向け日本語メッセージ。ドメインのエラーは既に日本語の説明を
 * 持つが、アプリ層固有のコードや将来のUI文言差し替えを一箇所に集約するための層。
 */
const MESSAGES: Record<string, string> = {
  // アプリケーション層
  TRANSACTION_NOT_FOUND: "取引が見つかりません",
  PROJECT_NOT_FOUND: "案件が見つかりません",
  NOT_A_PARTICIPANT: "この取引の関係者ではないため操作できません",
  NOT_AUTHENTICATED: "ログインが必要です",
  NO_ACTING_COMPANY: "操作する会社が選択されていません",
  // ドメイン層のエラーは既に具体的な日本語メッセージ（「〜は協力会社のみ操作できます」等）を
  // 持つため、基本は error.message をそのまま使う。ここで上書きすると具体性が失われるので、
  // アプリ層固有コードのみを定義し、ドメインコードはフォールバックに任せる。
};

export function errorMessage(error: DomainError | AppError): string {
  const mapped = MESSAGES[error.code];
  if (mapped) return mapped;
  return error.message || "操作を完了できませんでした";
}

export function toAppError(error: DomainError | AppError): AppError {
  return { code: error.code, message: errorMessage(error) };
}
