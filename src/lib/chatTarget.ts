/**
 * チャット通知の遷移先を一元生成する（純粋関数）。UI 側で URL を組み立てない。
 * - 取引成立後：取引詳細のチャットセクション（#tx-chat で自動スクロール）。
 * - 取引成立前：全画面の案件チャット（companyId は常に協力会社ID）。
 * 遷移先が削除済み・権限なし・存在しない場合は、各画面側が 404 ではなく案内を表示する。
 */
export function chatTargetHref(opts: { txId?: string | null; projectId: string; partnerCompanyId: string }): string {
  return opts.txId
    ? `/transactions/${opts.txId}#tx-chat`
    : `/projects/${opts.projectId}/chat/${opts.partnerCompanyId}`;
}
