import { redirect } from "next/navigation";
import { getAuthContext } from "@/server/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rowToCompany, type CompanyRow } from "@/infra/supabase/mappers";
import { companyCreditLevel } from "@/domain/company";
import { signOut } from "@/app/(auth)/actions";
import { AdminForms } from "./AdminForms";

export const dynamic = "force-dynamic";

const LEVEL_JP: Record<string, string> = { unverified: "未認証", bronze: "Bronze", silver: "Silver", gold: "Gold", platinum: "Platinum" };

interface CompanyView {
  id: string;
  name: string;
  region: string;
  level: string;
  completed: number;
  members: string[];
}

export default async function AdminPage() {
  const ctx = await getAuthContext();
  if (!ctx.user) redirect("/login?next=/admin");
  if (!ctx.isAdmin) redirect("/account");

  const supabase = await createClient();
  const { data: companyRows } = await supabase.from("companies").select("*").order("created_at", { ascending: true });
  const companies = (companyRows ?? []).map((r) => rowToCompany(r as unknown as CompanyRow));

  // メンバー（会社ID→メールの一覧）。auth.users は service_role でのみ引ける。
  // サービスロール鍵が未設定でもページを 500 にせず、原因を画面に表示する。
  const membersByCompany = new Map<string, string[]>();
  let adminError: string | null = null;
  try {
    const admin = createAdminClient();
    const { data: memberships } = await admin.from("company_users").select("auth_user_id, company_id");
    const { data: userList, error: listError } = await admin.auth.admin.listUsers();
    if (listError) adminError = `メンバー一覧の取得に失敗: ${listError.message}`;
    const emailById = new Map((userList?.users ?? []).map((u) => [u.id, u.email ?? u.id]));
    for (const m of (memberships ?? []) as { auth_user_id: string; company_id: string }[]) {
      const arr = membersByCompany.get(m.company_id) ?? [];
      arr.push(emailById.get(m.auth_user_id) ?? m.auth_user_id);
      membersByCompany.set(m.company_id, arr);
    }
  } catch (e) {
    adminError = e instanceof Error ? e.message : "サービスロール鍵（SUPABASE_SERVICE_ROLE_KEY）が未設定です";
  }

  const views: CompanyView[] = companies.map((c) => ({
    id: c.id,
    name: c.name,
    region: c.region,
    level: companyCreditLevel(c, false),
    completed: c.metrics.completed,
    members: membersByCompany.get(c.id) ?? [],
  }));

  return (
    <div className="mx-auto min-h-dvh max-w-[720px] p-4">
      <header className="mb-4 flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-(--color-brand-blue) text-[15px] font-black text-white">足</span>
        <div className="flex-1">
          <div className="text-[15px] font-bold text-(--color-brand-ink)">本部管理</div>
          <div className="text-[11.5px] text-(--color-brand-sub)">{ctx.user.email}（管理者）</div>
        </div>
        <form action={signOut}>
          <button className="rounded-lg border border-(--color-brand-line) px-3 py-1.5 text-[12.5px] font-bold text-(--color-brand-sub)">ログアウト</button>
        </form>
      </header>

      {adminError && (
        <div className="mb-3 rounded-xl border border-(--color-brand-red) bg-(--color-brand-red-soft) p-3 text-[12.5px] text-(--color-brand-red)">
          <div className="font-bold">サービスロール接続エラー</div>
          <div className="mt-1">{adminError}</div>
          <div className="mt-1 text-(--color-brand-sub)">
            Vercel の環境変数 <code>SUPABASE_SERVICE_ROLE_KEY</code>（Secret key）を設定し、Redeploy してください。会社の作成・メンバー作成にはこの鍵が必要です。
          </div>
        </div>
      )}

      <AdminForms companies={views.map((v) => ({ id: v.id, name: v.name }))} />

      <h2 className="mb-2 mt-6 text-[13px] font-bold text-(--color-brand-sub)">登録会社（{views.length}）</h2>
      <div className="space-y-2">
        {views.length === 0 && (
          <div className="rounded-xl border border-(--color-brand-line) bg-white p-4 text-[13px] text-(--color-brand-sub)">
            まだ会社がありません。上のフォームから作成してください（本番の初期状態は空です）。
          </div>
        )}
        {views.map((c) => (
          <div key={c.id} className="rounded-xl border border-(--color-brand-line) bg-white p-3">
            <div className="flex items-center gap-2">
              <span className="text-[14px] font-bold text-(--color-brand-ink)">{c.name}</span>
              <span className="rounded-full bg-(--color-brand-blue-light) px-2 py-0.5 text-[11px] font-bold text-(--color-brand-blue)">{LEVEL_JP[c.level] ?? c.level}</span>
              <span className="ml-auto text-[11.5px] text-(--color-brand-sub)">取引完了 {c.completed}</span>
            </div>
            <div className="mt-1 text-[11.5px] text-(--color-brand-sub)">{c.region || "地域未設定"}</div>
            <div className="mt-1 text-[11.5px] text-(--color-brand-sub)">
              メンバー：{c.members.length > 0 ? c.members.join("、 ") : "未登録"}
            </div>
          </div>
        ))}
      </div>

      <p className="mt-6 text-[11px] leading-relaxed text-(--color-brand-faint)">
        ※ 信用実績（取引完了・期日内支払い等）の数値は取引イベントからのみ更新され、ここでは直接編集できません。
        修正が必要な場合は修正イベントを記録して再計算する方針です（今後実装）。
      </p>
    </div>
  );
}
