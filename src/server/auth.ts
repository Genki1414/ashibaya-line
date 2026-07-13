import { cache } from "react";
import { createClient } from "../lib/supabase/server";
import { CompanyId } from "../domain/shared";

export interface AuthUser {
  readonly id: string;
  readonly email: string | null;
}

export interface AuthContext {
  readonly user: AuthUser | null;
  readonly isAdmin: boolean;
  /** 一般利用者の所属会社。管理者や未所属は null。 */
  readonly companyId: CompanyId | null;
}

function readIsAdmin(appMetadata: Record<string, unknown> | undefined): boolean {
  return appMetadata?.is_admin === true;
}

/**
 * ログイン中のユーザー・権限・所属会社を解決する。
 * 役割（元請/協力）はここでは決めない — 取引ごとに prime_company_id / partner_company_id と
 * この companyId を突き合わせて自動判定する（グローバルな役割属性は持たない）。
 *
 * 認証の検証は getClaims() を使う。非対称鍵(JWT signing keys)が有効なら
 * ネットワーク往復なしでローカル検証でき、遷移ごとの待ち時間を減らせる。
 * 対称鍵(HS256)のプロジェクトでは内部で getUser() にフォールバックするため、
 * どちらでも安全（従来と同じ検証強度）。
 */
export const getAuthContext = cache(async function getAuthContext(): Promise<AuthContext> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (error || !claims?.sub) {
    return { user: null, isAdmin: false, companyId: null };
  }

  const appMeta = claims.app_metadata as Record<string, unknown> | undefined;
  const user: AuthUser = { id: String(claims.sub), email: claims.email ?? null };
  const isAdmin = readIsAdmin(appMeta);

  let companyId: CompanyId | null = null;
  if (!isAdmin) {
    // 所属会社IDは基本 JWT クレーム（app_metadata.company_id）から取得し、DB往復を省く。
    const claimCompany = typeof appMeta?.company_id === "string" ? appMeta.company_id : null;
    if (claimCompany) {
      companyId = CompanyId(claimCompany);
    } else {
      // クレーム未埋め込みの旧アカウント向けフォールバック。
      // company_users は「自分の所属のみ SELECT 可」（RLS）。所属会社を1件解決する。
      const { data: membership } = await supabase
        .from("company_users")
        .select("company_id")
        .eq("auth_user_id", user.id)
        .limit(1)
        .maybeSingle();
      const cid = (membership as { company_id?: string } | null)?.company_id;
      if (cid) companyId = CompanyId(cid);
    }
  }

  return { user, isAdmin, companyId };
});

export async function requireUser(): Promise<AuthContext> {
  const ctx = await getAuthContext();
  if (!ctx.user) throw new Error("NOT_AUTHENTICATED");
  return ctx;
}
