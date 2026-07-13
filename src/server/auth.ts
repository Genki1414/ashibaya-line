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
 */
export const getAuthContext = cache(async function getAuthContext(): Promise<AuthContext> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    return { user: null, isAdmin: false, companyId: null };
  }

  const user: AuthUser = { id: data.user.id, email: data.user.email ?? null };
  const isAdmin = readIsAdmin(data.user.app_metadata as Record<string, unknown> | undefined);

  let companyId: CompanyId | null = null;
  if (!isAdmin) {
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

  return { user, isAdmin, companyId };
});

export async function requireUser(): Promise<AuthContext> {
  const ctx = await getAuthContext();
  if (!ctx.user) throw new Error("NOT_AUTHENTICATED");
  return ctx;
}
