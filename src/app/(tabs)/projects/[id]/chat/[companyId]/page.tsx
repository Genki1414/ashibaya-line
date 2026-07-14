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
  // 削除済み・閲覧権限なし・存在しない場合は 404 ではなく日本語の案内を出す（第三者にも詳細は見せない）。
  if (!chat) {
    return (
      <AppShell title="案件チャット" back="/home" noPad hideNav>
        <div className="p-8 text-center">
          <div className="text-[28px]">💬</div>
          <div className="mt-2 text-[14px] font-bold text-(--color-brand-ink)">このチャットは現在表示できません</div>
          <div className="mt-1 text-[12.5px] leading-relaxed text-(--color-brand-sub)">案件または取引が終了・削除された可能性があります。</div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title={`チャット：${chat.counterpartyName}`} back={`/projects/${id}`} noPad hideNav>
      <ChatBox projectId={chat.projectId} partnerCompanyId={chat.partnerCompanyId} role={chat.role} messages={chat.messages} counterpartyReadAt={chat.counterpartyReadAt} />
    </AppShell>
  );
}
