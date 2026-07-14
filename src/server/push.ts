import "server-only";
import webpush from "web-push";
import { createAdminClient } from "../lib/supabase/admin";

/**
 * Web Push（PWAプッシュ通知）のサーバ処理。
 * VAPID 鍵（環境変数）が未設定でも例外を投げず「無効」として静かに劣化する（graceful degradation）。
 * 購読情報は service_role で push_subscriptions に保存し、通知は会社単位で配信する。
 */

export interface SerializedSubscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  /** 同一 tag は端末上で上書き表示される（連投で埋もれない）。 */
  tag?: string;
  icon?: string;
}

let configured: boolean | null = null;

/** VAPID 鍵が揃っていればプッシュ有効。初回に web-push を設定する。 */
export function pushConfigured(): boolean {
  if (configured !== null) return configured;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) {
    configured = false;
    return false;
  }
  try {
    const subject = process.env.VAPID_SUBJECT || "mailto:support@example.com";
    webpush.setVapidDetails(subject, pub, priv);
    configured = true;
  } catch {
    configured = false;
  }
  return configured;
}

/** 購読を保存（端末×ブラウザ＝endpoint 一意で upsert）。 */
export async function saveSubscription(sub: SerializedSubscription, companyId: string | null, authUserId: string | null, userAgent: string | null): Promise<{ ok: boolean; error?: string }> {
  if (!sub?.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) return { ok: false, error: "購読情報が不正です" };
  try {
    const admin = createAdminClient();
    const { error } = await admin.from("push_subscriptions").upsert(
      {
        endpoint: sub.endpoint,
        company_id: companyId,
        auth_user_id: authUserId,
        p256dh: sub.keys.p256dh,
        auth: sub.keys.auth,
        user_agent: userAgent,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "endpoint" },
    );
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "保存に失敗しました" };
  }
}

/** 購読を削除（明示的な解除・失効時）。 */
export async function removeSubscription(endpoint: string): Promise<void> {
  if (!endpoint) return;
  try {
    const admin = createAdminClient();
    await admin.from("push_subscriptions").delete().eq("endpoint", endpoint);
  } catch {
    // 削除失敗は致命的でないため握りつぶす。
  }
}

interface SubRow {
  endpoint: string;
  p256dh: string;
  auth: string;
}

/** 指定 endpoint 群へ配信。失効（404/410）した購読は自動削除する。決して throw しない。 */
async function sendToRows(rows: SubRow[], payload: PushPayload): Promise<number> {
  if (!pushConfigured() || rows.length === 0) return 0;
  const body = JSON.stringify(payload);
  let sent = 0;
  const stale: string[] = [];
  await Promise.all(
    rows.map(async (r) => {
      try {
        await webpush.sendNotification({ endpoint: r.endpoint, keys: { p256dh: r.p256dh, auth: r.auth } }, body);
        sent++;
      } catch (e: unknown) {
        const status = (e as { statusCode?: number })?.statusCode;
        if (status === 404 || status === 410) stale.push(r.endpoint);
      }
    }),
  );
  if (stale.length > 0) {
    try {
      const admin = createAdminClient();
      await admin.from("push_subscriptions").delete().in("endpoint", stale);
    } catch {
      /* noop */
    }
  }
  return sent;
}

/** 会社に紐づく全端末へプッシュ配信。未設定・購読なしは 0 を返すだけ（副作用・例外なし）。 */
export async function sendPushToCompany(companyId: string, payload: PushPayload): Promise<number> {
  if (!pushConfigured() || !companyId) return 0;
  try {
    const admin = createAdminClient();
    const { data } = await admin.from("push_subscriptions").select("endpoint, p256dh, auth").eq("company_id", companyId);
    return await sendToRows((data ?? []) as SubRow[], payload);
  } catch {
    return 0;
  }
}

/** 単一 endpoint（自分の端末）へテスト配信。 */
export async function sendPushToEndpoint(endpoint: string, payload: PushPayload): Promise<number> {
  if (!pushConfigured() || !endpoint) return 0;
  try {
    const admin = createAdminClient();
    const { data } = await admin.from("push_subscriptions").select("endpoint, p256dh, auth").eq("endpoint", endpoint).maybeSingle();
    if (!data) return 0;
    return await sendToRows([data as SubRow], payload);
  } catch {
    return 0;
  }
}
