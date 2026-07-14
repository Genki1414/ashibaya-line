"use server";

import { headers } from "next/headers";
import { getAuthContext } from "@/server/auth";
import { saveSubscription, removeSubscription, sendPushToEndpoint, pushConfigured, type SerializedSubscription } from "@/server/push";

/** プッシュ購読を保存（ログイン中の会社・ユーザーに紐づけ）。 */
export async function subscribeUser(sub: SerializedSubscription): Promise<{ ok: boolean; error?: string }> {
  const ctx = await getAuthContext();
  if (!ctx.user) return { ok: false, error: "ログインが必要です" };
  const ua = (await headers()).get("user-agent");
  return saveSubscription(sub, ctx.companyId as unknown as string | null, ctx.user.id, ua);
}

/** プッシュ購読を解除。 */
export async function unsubscribeUser(endpoint: string): Promise<{ ok: boolean }> {
  await removeSubscription(endpoint);
  return { ok: true };
}

/** 自分の端末へテスト通知を送る（購読直後の動作確認用）。 */
export async function sendTestNotification(endpoint: string): Promise<{ ok: boolean; error?: string }> {
  const ctx = await getAuthContext();
  if (!ctx.user) return { ok: false, error: "ログインが必要です" };
  if (!pushConfigured()) return { ok: false, error: "サーバのプッシュ設定（VAPID鍵）が未設定です" };
  const n = await sendPushToEndpoint(endpoint, {
    title: "テスト通知",
    body: "プッシュ通知は正常に受信できています。",
    url: "/home",
    tag: "test",
  });
  return n > 0 ? { ok: true } : { ok: false, error: "送信できませんでした（購読が失効している可能性があります）" };
}
