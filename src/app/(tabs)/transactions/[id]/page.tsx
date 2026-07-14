import { notFound } from "next/navigation";
import { AppShell } from "@/components/app/AppShell";
import { TxWorkspace, type EmbeddedChat } from "@/components/tx/TxWorkspace";
import { TxDocsSection } from "@/components/project/DocsDisplay";
import { loadTxDetail, statusLabel } from "@/server/txData";
import { loadChat, loadUnreadChats } from "@/server/chatData";
import { loadTransactionDocuments } from "@/server/projectDocs";
import { currentCompanyId } from "@/server/acting";
import { availableActions, nextHint } from "@/domain/transaction";

export const dynamic = "force-dynamic";

export default async function TransactionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await loadTxDetail(id);
  if (!detail) notFound();
  const { tx, role, prime, partner, timeline } = detail;

  // 取引内に埋め込む案件チャット（応募〜取引で同一チャットを継続）。
  const [projectId, partnerCompanyId] = (tx.chatKey as string).split(":");
  const [chatDetail, unreadChats] = await Promise.all([loadChat(projectId, partnerCompanyId), loadUnreadChats()]);
  const unread = unreadChats.find((c) => c.chatKey === (tx.chatKey as string))?.count ?? 0;
  const chat: EmbeddedChat | null =
    chatDetail && chatDetail !== "unavailable"
      ? { projectId: chatDetail.projectId, partnerCompanyId: chatDetail.partnerCompanyId, role: chatDetail.role, messages: chatDetail.messages, unread, counterpartyReadAt: chatDetail.counterpartyReadAt }
      : null;

  // 案件資料（成立時点のスナップショット＋成立後の追加。既存取引は現在共有中を表示）。
  // 取引当事者なら 0 件でもセクションを常時表示する（当事者でなければ非表示）。
  const me = await currentCompanyId();
  const txDocs = await loadTransactionDocuments(id, me);
  const documentsSlot = txDocs.ok ? <TxDocsSection docs={txDocs.docs} /> : null;

  return (
    <AppShell title={tx.projectName} back="/transactions" noPad>
      <TxWorkspace
        tx={tx}
        role={role}
        actions={availableActions(tx, role)}
        prime={prime}
        partner={partner}
        statusLabel={statusLabel(tx)}
        nextHint={nextHint(tx)}
        timeline={timeline}
        chat={chat}
        documentsSlot={documentsSlot}
      />
    </AppShell>
  );
}
