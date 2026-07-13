"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { companyToRow } from "@/infra/supabase/mappers";
import { Company } from "@/domain/company";
import { CompanyId } from "@/domain/shared";
import { VERIFY_ITEM_KEYS, initialCompanyMetrics, VerifyRecord } from "@/domain/credit";

export interface AuthActionResult {
  readonly ok: boolean;
  readonly error?: string;
}

function initialVerify(): VerifyRecord {
  return Object.fromEntries(VERIFY_ITEM_KEYS.map((k) => [k, "none"])) as VerifyRecord;
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

/**
 * セルフサインアップ：利用会社が自分で登録する。
 * auth ユーザー発行 → 会社(status=pending)作成 → メンバー(owner)紐付け → 自動ログイン。
 * 会社レコードの作成は service_role（サーバー）で行い、RLS は厳格なまま。
 * 登録後すぐ利用可だが、発注・受注は本部承認（status=active）後に解禁する。
 */
export async function signUp(_prev: AuthActionResult | null, formData: FormData): Promise<AuthActionResult> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const companyName = String(formData.get("companyName") ?? "").trim();
  const region = String(formData.get("region") ?? "").trim();
  const contact = String(formData.get("contact") ?? "").trim();
  if (!companyName) return { ok: false, error: "会社名を入力してください" };
  if (!email || password.length < 8) return { ok: false, error: "メールアドレスと8文字以上のパスワードを入力してください" };

  try {
    const admin = createAdminClient();
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (error || !data.user) {
      const dup = (error?.message ?? "").toLowerCase().includes("already");
      return { ok: false, error: dup ? "このメールアドレスは登録済みです" : `登録に失敗しました: ${error?.message ?? "unknown"}` };
    }

    const company: Company = {
      id: CompanyId(crypto.randomUUID()),
      name: companyName,
      region,
      contact,
      areas: [],
      works: [],
      registeredAt: new Date().toISOString().slice(0, 10),
      verify: initialVerify(),
      metrics: { ...initialCompanyMetrics },
      status: "pending",
    };
    const { error: companyError } = await admin.from("companies").insert({ ...companyToRow(company), updated_at: new Date().toISOString() });
    if (companyError) {
      await admin.auth.admin.deleteUser(data.user.id);
      return { ok: false, error: `会社登録に失敗しました: ${companyError.message}` };
    }

    const { error: linkError } = await admin.from("company_users").insert({ auth_user_id: data.user.id, company_id: company.id, role: "owner" });
    if (linkError) {
      await admin.from("companies").delete().eq("id", company.id);
      await admin.auth.admin.deleteUser(data.user.id);
      return { ok: false, error: `会社への紐付けに失敗しました: ${linkError.message}` };
    }
  } catch (e) {
    return { ok: false, error: `サーバー設定エラー: ${e instanceof Error ? e.message : "Supabase 接続設定を確認してください"}` };
  }

  // 自動ログイン（セッション確立）。
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { ok: false, error: "登録は完了しました。ログイン画面からログインしてください" };
  } catch {
    return { ok: false, error: "登録は完了しました。ログイン画面からログインしてください" };
  }
  redirect("/account");
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
