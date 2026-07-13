import { notFound } from "next/navigation";
import { AppShell } from "@/components/app/AppShell";
import { loadChat } from "@/server/chatData";
import { ChatBox } from "./ChatBox";

export const dynamic = "force-dynamic";
export const metadata = { title: "案件チャット" };

export default async function ChatPage({ params }: { params: Promise<{ id: string; companyId: string }> }) {
  const { id, companyId } = await params;
  const chat = await loadChat(id, companyId);

  if (chat === "unavailable") {
    return (
      <AppShell title="案件チャット" back={`/projects/${id}`} noPad hideNav>
        <div className="p-6 text-center text-[13px] text-(--color-brand-sub)">チャットは本番環境（Supabase接続時）で利用できます。</div>
      </AppShell>
    );
  }
  if (!chat) notFound();

  return (
    <AppShell title={`チャット：${chat.counterpartyName}`} back={`/projects/${id}`} noPad hideNav>
      <ChatBox projectId={chat.projectId} partnerCompanyId={chat.partnerCompanyId} role={chat.role} messages={chat.messages} counterpartyReadAt={chat.counterpartyReadAt} />
    </AppShell>
  );
}
