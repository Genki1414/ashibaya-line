import { getContainer } from "./container";
import { listProjects } from "./projectData";
import { loadUnreadChats } from "./chatData";
import { hasUnackedChange } from "./txData";

export type NotificationKind = "応募" | "選定" | "受注" | "チャット" | "変更";

export interface AppNotification {
  kind: NotificationKind;
  title: string;
  body: string;
  href: string;
}

/**
 * 現在ログイン中の会社に関係する「案件の進捗」通知を状態から導出する。
 * - 応募：自社が元請の募集中案件に応募がある
 * - 選定：自社が受注側として選定された（取引開始前）
 * - 受注：自社が元請で、相手が受注（取引開始）し、注文書がまだ未発行
 * いずれも次のアクションで自然に解消される（滞留しない）設計。
 */
export async function loadNotifications(): Promise<AppNotification[]> {
  const container = await getContainer();
  const me = container.actingCompanyId as unknown as string;
  if (!me || me === "__none__") return [];

  const [projects, txs, unreadChats] = await Promise.all([listProjects(me), container.listTransactionsForActing(), loadUnreadChats()]);
  const items: AppNotification[] = [];

  // 取引が生成済みのチャットは、変更通知と同様に取引詳細へ誘導する。
  const txIdByChatKey = new Map(txs.map((t) => [t.chatKey as string, t.id as unknown as string]));

  for (const c of unreadChats) {
    const txId = txIdByChatKey.get(c.chatKey);
    items.push({
      kind: "チャット",
      title: `「${c.projectName}」${c.counterpartyName}`,
      body: `新着メッセージ ${c.count}件：${c.lastText}`,
      href: txId ? `/transactions/${txId}` : `/projects/${c.projectId}/chat/${c.partnerCompanyId}`,
    });
  }

  for (const p of projects) {
    if (p.isOwn && p.stage === "recruiting" && p.applicants > 0) {
      items.push({ kind: "応募", title: `案件「${p.name}」`, body: `${p.applicants}社が応募しています`, href: `/projects/${p.id}` });
    }
  }

  for (const t of txs) {
    const id = t.id as unknown as string;
    const isPartner = (t.partnerId as unknown as string) === me;
    const isPrime = (t.primeId as unknown as string) === me;
    if (isPartner && t.startedAt === null) {
      items.push({ kind: "選定", title: `「${t.projectName}」`, body: "選定されました。取引を開始してください", href: `/transactions/${id}` });
    }
    if (isPrime && t.startedAt !== null && !t.order.order) {
      items.push({ kind: "受注", title: `「${t.projectName}」`, body: "受注されました。注文書を発行してください", href: `/transactions/${id}` });
    }
    // 元請による工期・案件情報の変更は、受注側に確認を求める。
    if (isPartner && hasUnackedChange(t)) {
      const kinds = [t.scheduleNotice && !t.scheduleNotice.acknowledged ? "工期・予定" : null, t.infoNotice && !t.infoNotice.acknowledged ? "案件情報" : null].filter(Boolean).join("・");
      items.push({ kind: "変更", title: `「${t.projectName}」`, body: `${kinds}の変更があります。内容を確認してください`, href: `/transactions/${id}` });
    }
  }

  return items;
}
