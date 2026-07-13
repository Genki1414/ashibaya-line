"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) return { ok: false, error: "メールアドレスまたはパスワードが違います" };

  // 遷移先は今サインインしたユーザーから直接判定（同一リクエスト内の再取得に依存しない）。
  if (next && next.startsWith("/")) redirect(next);
  const isAdmin = (data.user.app_metadata as Record<string, unknown> | undefined)?.is_admin === true;
  redirect(isAdmin ? "/admin" : "/account");
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
