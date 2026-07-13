"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAuthContext } from "@/server/auth";

export interface AuthActionResult {
  readonly ok: boolean;
  readonly error?: string;
}

/** メール+パスワードでログイン。本部管理者・一般会社メンバーとも同じ入口。 */
export async function signIn(_prev: AuthActionResult | null, formData: FormData): Promise<AuthActionResult> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "");
  if (!email || !password) return { ok: false, error: "メールアドレスとパスワードを入力してください" };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { ok: false, error: "メールアドレスまたはパスワードが違います" };

  // 管理者は管理画面、一般会社は自社ダッシュボードへ。next 指定があれば優先。
  if (next && next.startsWith("/")) redirect(next);
  const ctx = await getAuthContext();
  redirect(ctx.isAdmin ? "/admin" : "/account");
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
