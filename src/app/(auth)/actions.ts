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

  let isAdmin = false;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) return { ok: false, error: "メールアドレスまたはパスワードが違います" };
    isAdmin = (data.user.app_metadata as Record<string, unknown> | undefined)?.is_admin === true;
  } catch (e) {
    // 設定不備（Supabase URL/キーの不正など）は白い500ではなくフォーム上に表示する。
    return { ok: false, error: `サーバー設定エラー: ${e instanceof Error ? e.message : "Supabase 接続設定を確認してください"}` };
  }

  // 遷移先は今サインインしたユーザーから直接判定（同一リクエスト内の再取得に依存しない）。
  if (next && next.startsWith("/")) redirect(next);
  redirect(isAdmin ? "/admin" : "/account");
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
