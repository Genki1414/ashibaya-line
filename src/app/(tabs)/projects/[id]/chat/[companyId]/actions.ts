"use server";

import { revalidatePath } from "next/cache";
import { currentCompanyId, getDb } from "@/server/acting";
import { chatAvailable, CHAT_BUCKET } from "@/server/chatData";
import { createAdminClient } from "@/lib/supabase/admin";
import { rowToProject, type ProjectRow } from "@/infra/supabase/mappers";
import { sendPushToCompany } from "@/server/push";

export interface ChatActionResult {
  ok: boolean;
  error?: string;
}

export interface ChatAttachmentInput {
  path: string;
  name: string;
  type: string;
  size: number;
}

const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024; // 25MB

/** 元請本人 or 依頼先会社本人であることを確認し、role と案件情報を返す。 */
async function authorizeChat(projectId: string, partnerCompanyId: string) {
  const me = await currentCompanyId();
  if (!me) return { ok: false as const, error: "ログインが必要です" };
  const supabase = await getDb();
  const { data: pRow } = await supabase.from("projects").select("state").eq("id", projectId).maybeSingle();
  if (!pRow) return { ok: false as const, error: "案件が見つかりません" };
  const project = rowToProject(pRow as unknown as ProjectRow);
  const primeId = project.primeId as unknown as string;
  const role = me === primeId ? "prime" : me === partnerCompanyId ? "partner" : null;
  if (!role) return { ok: false as const, error: "このチャットに参加する権限がありません" };
  const applied = project.applicantIds.some((a) => (a as unknown as string) === partnerCompanyId);
  if (!applied) return { ok: false as const, error: "応募のある依頼先のみチャットできます" };
  return { ok: true as const, role, primeId, projectName: project.name, supabase };
}

/** チャット送信（テキスト＋任意の添付）。チャット行は初回送信時に生成する。 */
export async function sendMessageAction(
  projectId: string,
  partnerCompanyId: string,
  text: string,
  attachment?: ChatAttachmentInput,
): Promise<ChatActionResult> {
  if (!chatAvailable()) return { ok: false, error: "チャットは本番環境（Supabase接続時）で利用できます" };
  const body = text.trim();
  if (!body && !attachment) return { ok: false, error: "メッセージを入力してください" };

  const auth = await authorizeChat(projectId, partnerCompanyId);
  if (!auth.ok) return { ok: false, error: auth.error };
  const { role, primeId, projectName, supabase } = auth;

  const chatKey = `${projectId}:${partnerCompanyId}`;
  const { error: chatErr } = await supabase
    .from("chats")
    .upsert({ key: chatKey, project_id: projectId, prime_id: primeId, partner_id: partnerCompanyId, title: projectName }, { onConflict: "key", ignoreDuplicates: true });
  if (chatErr) return { ok: false, error: `チャットの初期化に失敗しました: ${chatErr.message}` };

  const row: Record<string, unknown> = { chat_key: chatKey, sender_role: role, text: body };
  if (attachment) {
    row.attachment_path = attachment.path;
    row.attachment_name = attachment.name;
    row.attachment_type = attachment.type;
    row.attachment_size = attachment.size;
  }
  const { error } = await supabase.from("messages").insert(row);
  if (error) return { ok: false, error: `送信に失敗しました: ${error.message}` };

  // 相手（元請↔協力の反対側）へプッシュ通知。同一チャットは tag で上書き。
  const recipient = role === "prime" ? partnerCompanyId : primeId;
  const preview = body ? (body.length > 40 ? body.slice(0, 40) + "…" : body) : "📎 添付ファイル";
  await sendPushToCompany(recipient, {
    title: `新着メッセージ｜${projectName}`, body: preview, url: `/projects/${projectId}/chat/${partnerCompanyId}`, tag: `chat-${chatKey}`,
  });

  revalidatePath(`/projects/${projectId}/chat/${partnerCompanyId}`);
  return { ok: true };
}

export interface UploadUrlResult {
  ok: boolean;
  error?: string;
  path?: string;
  token?: string;
}

/** 添付アップロード用の署名付きURLを発行（非公開バケット）。関係者のみ。 */
export async function createChatUploadUrl(
  projectId: string,
  partnerCompanyId: string,
  filename: string,
  size: number,
): Promise<UploadUrlResult> {
  if (!chatAvailable()) return { ok: false, error: "添付は本番環境（Supabase接続時）で利用できます" };
  if (size > MAX_ATTACHMENT_BYTES) return { ok: false, error: "ファイルサイズは25MBまでです" };

  const auth = await authorizeChat(projectId, partnerCompanyId);
  if (!auth.ok) return { ok: false, error: auth.error };

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { ok: false, error: "添付機能が未設定です（SUPABASE_SERVICE_ROLE_KEY）" };
  }
  const ext = filename.includes(".") ? filename.split(".").pop()!.replace(/[^\w]/g, "").slice(0, 8) : "";
  const path = `${projectId}/${partnerCompanyId}/${crypto.randomUUID()}${ext ? "." + ext : ""}`;
  const { data, error } = await admin.storage.from(CHAT_BUCKET).createSignedUploadUrl(path);
  if (error || !data) return { ok: false, error: `アップロードURLの発行に失敗しました: ${error?.message ?? ""}` };
  return { ok: true, path: data.path, token: data.token };
}

/** チャットを開いた/送信した時点までを既読にする。未読バッジのクリアに使う。 */
export async function markChatReadAction(projectId: string, partnerCompanyId: string): Promise<void> {
  if (!chatAvailable()) return;
  const me = await currentCompanyId();
  if (!me) return;
  const supabase = await getDb();
  const chatKey = `${projectId}:${partnerCompanyId}`;
  await supabase
    .from("chat_reads")
    .upsert({ chat_key: chatKey, company_id: me, last_read_at: new Date().toISOString() }, { onConflict: "chat_key,company_id" });
}
