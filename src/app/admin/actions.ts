"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthContext } from "@/server/auth";
import { companyToRow } from "@/infra/supabase/mappers";
import { Company } from "@/domain/company";
import { CompanyId } from "@/domain/shared";
import { VERIFY_ITEM_KEYS, initialCompanyMetrics, VerifyRecord } from "@/domain/credit";

export interface AdminActionResult {
  readonly ok: boolean;
  readonly error?: string;
  readonly message?: string;
}

function initialVerify(): VerifyRecord {
  return Object.fromEntries(VERIFY_ITEM_KEYS.map((k) => [k, "none"])) as VerifyRecord;
}

async function assertAdmin() {
  const ctx = await getAuthContext();
  if (!ctx.user) throw new Error("NOT_AUTHENTICATED");
  if (!ctx.isAdmin) throw new Error("FORBIDDEN_ADMIN");
}

/** 本部管理者による会社作成。信用実績(metrics)は初期値で開始し、以後は取引イベントからのみ更新。 */
export async function createCompany(_prev: AdminActionResult | null, formData: FormData): Promise<AdminActionResult> {
  await assertAdmin();
  const name = String(formData.get("name") ?? "").trim();
  const region = String(formData.get("region") ?? "").trim();
  const contact = String(formData.get("contact") ?? "").trim();
  if (!name) return { ok: false, error: "会社名を入力してください" };

  const company: Company = {
    id: CompanyId(crypto.randomUUID()),
    name,
    region,
    contact,
    areas: [],
    works: [],
    registeredAt: new Date().toISOString().slice(0, 10),
    verify: initialVerify(),
    metrics: { ...initialCompanyMetrics },
  };

  const admin = createAdminClient();
  const { error } = await admin.from("companies").insert({ ...companyToRow(company), updated_at: new Date().toISOString() });
  if (error) return { ok: false, error: `会社の作成に失敗しました: ${error.message}` };

  revalidatePath("/admin");
  return { ok: true, message: `会社「${name}」を作成しました` };
}

/** 会社メンバー（ログイン用アカウント）の作成。auth ユーザーを発行し company_users に紐付ける。 */
export async function createMember(_prev: AdminActionResult | null, formData: FormData): Promise<AdminActionResult> {
  await assertAdmin();
  const companyId = String(formData.get("companyId") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!companyId) return { ok: false, error: "会社を選択してください" };
  if (!email || password.length < 8) return { ok: false, error: "メールアドレスと8文字以上のパスワードを入力してください" };

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) return { ok: false, error: `アカウント作成に失敗しました: ${error?.message ?? "unknown"}` };

  const { error: linkError } = await admin.from("company_users").insert({ auth_user_id: data.user.id, company_id: companyId, role: "member" });
  if (linkError) {
    // 紐付けに失敗したら作成した auth ユーザーを掃除（不整合を残さない）。
    await admin.auth.admin.deleteUser(data.user.id);
    return { ok: false, error: `会社への紐付けに失敗しました: ${linkError.message}` };
  }

  revalidatePath("/admin");
  return { ok: true, message: `メンバー ${email} を作成しました` };
}
