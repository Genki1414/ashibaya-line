import { currentCompanyId, getDb } from "./acting";
import { createAdminClient } from "../lib/supabase/admin";
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
  /** 相手が最後にこのチャットを既読にした時刻（ISO）。自分の送信メッセージの「既読」表示に使う。 */
  counterpartyReadAt: string | null;
}

/** チャットは Supabase 接続時のみ（デモ/インメモリでは無効）。 */
export function chatAvailable(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export interface ChatUnread {
  chatKey: string;
  projectId: string;
  partnerCompanyId: string;
  projectName: string;
  counterpartyName: string;
  count: number;
  lastText: string;
}

interface ChatRow {
  key: string;
  project_id: string | null;
  prime_id: string;
  partner_id: string;
  title: string;
}
interface MsgRow {
  chat_key: string;
  sender_role: Actor;
  text: string;
  created_at: string;
}

/** 現在の会社の未読チャット（自分以外の送信で、最後に読んだ時刻より新しいもの）。 */
export async function loadUnreadChats(): Promise<ChatUnread[]> {
  if (!chatAvailable()) return [];
  const me = await currentCompanyId();
  if (!me) return [];

  const supabase = await getDb();
  const { data: chatData, error: chatErr } = await supabase
    .from("chats")
    .select("key, project_id, prime_id, partner_id, title")
    .or(`prime_id.eq.${me},partner_id.eq.${me}`);
  if (chatErr) return [];
  const chats = (chatData ?? []) as ChatRow[];
  if (chats.length === 0) return [];

  const keys = chats.map((c) => c.key);
  const [reads, msgs, companies] = await Promise.all([
    supabase.from("chat_reads").select("chat_key, last_read_at").eq("company_id", me).in("chat_key", keys),
    supabase.from("messages").select("chat_key, sender_role, text, created_at").in("chat_key", keys).order("created_at", { ascending: true }),
    supabase.from("companies").select("id, name"),
  ]);
  // chat_reads 未マイグレーション時などは既読不明として空扱い（未読バッジを出さない）。
  if (reads.error || msgs.error) return [];
  const { data: readData } = reads;
  const { data: msgData } = msgs;
  const { data: companyData } = companies;

  const lastRead = new Map((readData ?? []).map((r) => [(r as { chat_key: string }).chat_key, (r as { last_read_at: string }).last_read_at]));
  const nameById = new Map((companyData ?? []).map((c) => [(c as { id: string }).id, (c as { name: string }).name]));
  const messages = (msgData ?? []) as MsgRow[];

  const result: ChatUnread[] = [];
  for (const chat of chats) {
    const myRole: Actor = chat.prime_id === me ? "prime" : "partner";
    const partnerCompanyId = myRole === "prime" ? chat.partner_id : chat.prime_id;
    const readAt = lastRead.get(chat.key);
    const mine = messages.filter((m) => m.chat_key === chat.key && m.sender_role !== myRole);
    const unread = mine.filter((m) => !readAt || m.created_at > readAt);
    if (unread.length === 0) continue;
    result.push({
      chatKey: chat.key,
      projectId: chat.project_id ?? chat.key.split(":")[0],
      partnerCompanyId,
      projectName: chat.title,
      counterpartyName: nameById.get(partnerCompanyId) ?? partnerCompanyId,
      count: unread.length,
      lastText: unread[unread.length - 1]?.text ?? "",
    });
  }
  return result;
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
  const counterpartyId = role === "prime" ? partnerCompanyId : primeId;
  const [{ data: msgs }, { data: cRow }] = await Promise.all([
    supabase.from("messages").select("id, sender_role, text, created_at").eq("chat_key", chatKey).order("created_at", { ascending: true }),
    supabase.from("companies").select("name").eq("id", counterpartyId).maybeSingle(),
  ]);

  // 相手の既読時刻は「相手の会社」の chat_reads。RLS（自社のみ可）をまたぐため service_role で読む。
  let counterpartyReadAt: string | null = null;
  try {
    const admin = createAdminClient();
    const { data: cr } = await admin.from("chat_reads").select("last_read_at").eq("chat_key", chatKey).eq("company_id", counterpartyId).maybeSingle();
    counterpartyReadAt = (cr as { last_read_at?: string } | null)?.last_read_at ?? null;
  } catch {
    // service_role 未設定・テーブル未作成などは既読表示なしにフォールバック
  }

  return {
    chatKey,
    projectId,
    partnerCompanyId,
    projectName: project.name,
    role,
    counterpartyName: (cRow as { name?: string } | null)?.name ?? counterpartyId,
    messages: (msgs ?? []).map((m) => {
      const r = m as { id: string; sender_role: Actor; text: string; created_at: string };
      return { id: r.id, senderRole: r.sender_role, text: r.text, createdAt: r.created_at };
    }),
    counterpartyReadAt,
  };
}
