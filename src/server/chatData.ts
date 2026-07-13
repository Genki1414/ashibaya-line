import { currentCompanyId, getDb } from "./acting";
import { rowToProject, type ProjectRow } from "../infra/supabase/mappers";
import type { Actor } from "../domain/transaction";

export interface ChatMessage {
  id: string;
  senderRole: Actor;
  text: string;
  createdAt: string;
}

export interface ChatView {
  chatKey: string;
  projectId: string;
  partnerCompanyId: string;
  projectName: string;
  role: Actor;
  counterpartyName: string;
  messages: ChatMessage[];
}

/** チャットは Supabase 接続時のみ（デモ/インメモリでは無効）。 */
export function chatAvailable(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

/**
 * 案件×依頼先(会社)のチャットを解決する。閲覧できるのは元請本人か、その依頼先会社本人のみ。
 * 依頼先は応募済み（＝チャットが作られる対象）であることを要件とする。
 * チャット行はメッセージ送信時に遅延生成するため、ここでは参照のみ。
 */
export async function loadChat(projectId: string, partnerCompanyId: string): Promise<ChatView | null | "unavailable"> {
  if (!chatAvailable()) return "unavailable";
  const me = await currentCompanyId();
  if (!me) return null;

  const supabase = await getDb();
  const { data: pRow } = await supabase.from("projects").select("state").eq("id", projectId).maybeSingle();
  if (!pRow) return null;
  const project = rowToProject(pRow as unknown as ProjectRow);
  const primeId = project.primeId as unknown as string;

  const role: Actor | null = me === primeId ? "prime" : me === partnerCompanyId ? "partner" : null;
  if (!role) return null;
  const applied = project.applicantIds.some((a) => (a as unknown as string) === partnerCompanyId);
  if (!applied) return null;

  const chatKey = `${projectId}:${partnerCompanyId}`;
  const [{ data: msgs }, { data: cRow }] = await Promise.all([
    supabase.from("messages").select("id, sender_role, text, created_at").eq("chat_key", chatKey).order("created_at", { ascending: true }),
    supabase.from("companies").select("name").eq("id", role === "prime" ? partnerCompanyId : primeId).maybeSingle(),
  ]);

  return {
    chatKey,
    projectId,
    partnerCompanyId,
    projectName: project.name,
    role,
    counterpartyName: (cRow as { name?: string } | null)?.name ?? (role === "prime" ? partnerCompanyId : primeId),
    messages: (msgs ?? []).map((m) => {
      const r = m as { id: string; sender_role: Actor; text: string; created_at: string };
      return { id: r.id, senderRole: r.sender_role, text: r.text, createdAt: r.created_at };
    }),
  };
}
