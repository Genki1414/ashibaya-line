"use server";

import { revalidatePath } from "next/cache";
import { currentCompanyId, getDb } from "@/server/acting";
import { chatAvailable } from "@/server/chatData";
import { rowToProject, type ProjectRow } from "@/infra/supabase/mappers";

export interface ChatActionResult {
  ok: boolean;
  error?: string;
}

/** チャット送信。元請本人 or 依頼先会社本人のみ。チャット行は初回送信時に生成する。 */
export async function sendMessageAction(projectId: string, partnerCompanyId: string, text: string): Promise<ChatActionResult> {
  if (!chatAvailable()) return { ok: false, error: "チャットは本番環境（Supabase接続時）で利用できます" };
  const body = text.trim();
  if (!body) return { ok: false, error: "メッセージを入力してください" };

  const me = await currentCompanyId();
  if (!me) return { ok: false, error: "ログインが必要です" };

  const supabase = await getDb();
  const { data: pRow } = await supabase.from("projects").select("state").eq("id", projectId).maybeSingle();
  if (!pRow) return { ok: false, error: "案件が見つかりません" };
  const project = rowToProject(pRow as unknown as ProjectRow);
  const primeId = project.primeId as unknown as string;

  const role = me === primeId ? "prime" : me === partnerCompanyId ? "partner" : null;
  if (!role) return { ok: false, error: "このチャットに参加する権限がありません" };
  const applied = project.applicantIds.some((a) => (a as unknown as string) === partnerCompanyId);
  if (!applied) return { ok: false, error: "応募のある依頼先のみチャットできます" };

  const chatKey = `${projectId}:${partnerCompanyId}`;
  // チャット行を遅延生成（既存なら何もしない）。RLSは prime/partner 本人のみ許可。
  const { error: chatErr } = await supabase
    .from("chats")
    .upsert({ key: chatKey, project_id: projectId, prime_id: primeId, partner_id: partnerCompanyId, title: project.name }, { onConflict: "key", ignoreDuplicates: true });
  if (chatErr) return { ok: false, error: `チャットの初期化に失敗しました: ${chatErr.message}` };

  const { error } = await supabase.from("messages").insert({ chat_key: chatKey, sender_role: role, text: body });
  if (error) return { ok: false, error: `送信に失敗しました: ${error.message}` };

  revalidatePath(`/projects/${projectId}/chat/${partnerCompanyId}`);
  return { ok: true };
}

/** チャットを開いた/送信した時点までを既読にする。未読バッジのクリアに使う。 */
export async function markChatReadAction(projectId: string, partnerCompanyId: string): Promise<void> {
  if (!chatAvailable()) return;
  const me = await currentCompanyId();
  if (!me) return;
  const supabase = await getDb();
  const chatKey = `${projectId}:${partnerCompanyId}`;
  // チャット行が無い（メッセージ未送信）場合は未読も無いので、FKエラーは無視する。
  await supabase
    .from("chat_reads")
    .upsert({ chat_key: chatKey, company_id: me, last_read_at: new Date().toISOString() }, { onConflict: "chat_key,company_id" });
}
