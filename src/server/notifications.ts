import { getContainer } from "./container";
import { listProjects } from "./projectData";

export type NotificationKind = "応募" | "選定" | "受注";

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

  const [projects, txs] = await Promise.all([listProjects(me), container.listTransactionsForActing()]);
  const items: AppNotification[] = [];

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
  }

  return items;
}
