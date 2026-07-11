/**
 * ドメイン層のエントリポイント。各サブモジュールは名前空間つきで re-export する
 * （billing.submitInvoice と transaction.submitInvoice のように、値オブジェクト単体の
 * 状態遷移と集約ルートのコマンドで同名の関数があるため、フラットに展開すると衝突する）。
 */
export * as shared from "./shared";
export * as credit from "./credit";
export * as order from "./order";
export * as work from "./work";
export * as billing from "./billing";
export * as transaction from "./transaction";
export * as project from "./project";
export * as matching from "./matching";
export * as ashibase from "./ashibase";
export * as notification from "./notification";
export * as guarantee from "./guarantee";
