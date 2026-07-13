import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAuthContext } from "./auth";
import { createClient } from "../lib/supabase/server";
import { createAdminClient } from "../lib/supabase/admin";

/** テスト用の会社切り替え Cookie。値は company_id。 */
export const ACTING_COMPANY_COOKIE = "acting_company_id";

/**
 * リリース前だけ有効にする「元請/協力 会社切り替え」フラグ。
 * NEXT_PUBLIC_ALLOW_ACTING_SWITCH=1 のときのみ、画面から任意の会社として操作できる。
 * 本番リリース時はこの環境変数を外す（未設定＝無効）。
 */
export function actingSwitchEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ALLOW_ACTING_SWITCH === "1";
}

/** 切り替えが有効かつ Cookie に上書き会社が指定されているときだけ、その会社IDを返す。 */
async function overrideCompanyId(): Promise<string | null> {
  if (!actingSwitchEnabled()) return null;
  const value = (await cookies()).get(ACTING_COMPANY_COOKIE)?.value?.trim();
  return value ? value : null;
}

/** いま操作主体となる会社ID。切り替え上書きがあればそれ、無ければログインセッションの所属会社。 */
export async function currentCompanyId(): Promise<string | null> {
  const override = await overrideCompanyId();
  if (override) return override;
  const ctx = await getAuthContext();
  return ctx.companyId;
}

/** 切り替えが実際に効いているか（テスト表示中バッジの判定などに使う）。 */
export async function actingOverrideActive(): Promise<boolean> {
  return (await overrideCompanyId()) != null;
}

/**
 * データアクセスに使う Supabase クライアント。
 * 会社切り替えが効いているときは、他社としての読み書きを可能にするため service_role を使う
 * （＝RLSをまたぐ。フラグ有効時のテスト専用）。それ以外は通常のセッションクライアント。
 */
export async function getDb(): Promise<SupabaseClient> {
  if (await overrideCompanyId()) {
    try {
      return createAdminClient();
    } catch {
      // service_role 未設定などのときはセッションにフォールバック
    }
  }
  return createClient();
}
