import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * service_role キーで動く特権クライアント。RLS を越えて会社・メンバーの作成などを行う。
 * `server-only` により**クライアントバンドルへ混入しない**ことを保証する。
 * 秘密鍵は NEXT_PUBLIC を付けず、サーバー実行時のみ参照する。
 */
export function createAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Supabase の管理クライアントには NEXT_PUBLIC_SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY が必要です");
  }
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
