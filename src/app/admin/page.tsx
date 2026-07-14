import { redirect } from "next/navigation";
import { getAuthContext } from "@/server/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rowToCompany, type CompanyRow } from "@/infra/supabase/mappers";
import { companyCreditLevel } from "@/domain/company";
import { signOut } from "@/app/(auth)/actions";
import { AdminForms } from "./AdminForms";
import { StatusButton } from "./StatusButton";
import { RecomputeButton } from "./RecomputeButton";
import { AdminOverviewView } from "./AdminOverviewView";
import { loadAdminOverview } from "@/server/adminData";

export const dynamic = "force-dynamic";
export const metadata = { title: "本部管理" };

const LEVEL_JP: Record<string, string> = { unverified: "未認証", bronze: "Bronze", silver: "Silver", gold: "Gold", platinum: "Platinum" };

interface CompanyView {
  id: string;
  name: string;
  region: string;
  level: string;
  completed: number;
  primeCompleted: number;
  partnerCompleted: number;
  members: string[];
  status: string;
}

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: "承認待ち", color: "var(--color-brand-amber)", bg: "var(--color-brand-amber-soft)" },
  active: { label: "承認済み", color: "var(--color-brand-green)", bg: "var(--color-brand-green-soft)" },
  suspended: { label: "停止中", color: "var(--color-brand-red)", bg: "var(--color-brand-red-soft)" },
};

export default async function AdminPage() {
  const ctx = await getAuthContext();
  if (!ctx.user) redirect("/login?next=/admin");
  if (!ctx.isAdmin) redirect("/account");

  const supabase = await createClient();
  const { data: companyRows } = await supabase.from("companies").select("*").order("created_at", { ascending: true });
  const companies = (companyRows ?? []).map((r) => rowToCompany(r as unknown as CompanyRow));

  // 地域が自動分割できなかった案件（prefecture 未設定）＝要修正として確認する。
  const { data: unsplitRows } = await supabase.from("projects").select("id, name, region").is("prefecture", null);
  const unsplit = (unsplitRows ?? []) as { id: string; name: string; region: string | null }[];

  // 実績プロジェクション（元請/協力の取引完了件数などを一覧確認用に読む）。
  const { data: perfRows } = await supabase.from("company_performance").select("company_id, as_prime, as_partner");
  const perfById = new Map(
    ((perfRows ?? []) as { company_id: string; as_prime: { completed?: number }; as_partner: { completed?: number } }[]).map((r) => [
      r.company_id,
      { prime: r.as_prime?.completed ?? 0, partner: r.as_partner?.completed ?? 0 },
    ]),
  );

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

  const overview = await loadAdminOverview();

  const views: CompanyView[] = companies.map((c) => ({
    id: c.id,
    name: c.name,
    region: c.region,
    level: companyCreditLevel(c, false),
    completed: c.metrics.completed,
    primeCompleted: perfById.get(c.id)?.prime ?? 0,
    partnerCompleted: perfById.get(c.id)?.partner ?? 0,
    members: membersByCompany.get(c.id) ?? [],
    status: c.status ?? "active",
  }));

  return (
    <div className="min-h-dvh bg-(--color-brand-bg)">
      <header className="flex items-center gap-2 bg-(--color-brand-blue) px-4 py-3 text-white">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/20 text-[13px] font-black">足</span>
        <div className="flex-1">
          <div className="text-[15px] font-bold">本部管理</div>
          <div className="text-[11px] text-white/80">{ctx.user.email}（管理者）</div>
        </div>
        <form action={signOut}>
          <button className="rounded-lg bg-white/15 px-3 py-1.5 text-[12px] font-bold text-white">ログアウト</button>
        </form>
      </header>

      <div className="mx-auto max-w-[720px] p-4">
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

      <RecomputeButton />

      <AdminOverviewView overview={overview} />

      {unsplit.length > 0 && (
        <div className="mt-6 rounded-xl border border-(--color-brand-amber) bg-(--color-brand-amber-soft) p-3">
          <div className="text-[13px] font-bold text-(--color-brand-amber)">地域が未分割の案件（要修正）：{unsplit.length}件</div>
          <div className="mt-1 text-[11.5px] text-(--color-brand-sub)">
            都道府県を自動判定できませんでした。各案件の編集画面で都道府県・市区町村を設定してください。
          </div>
          <ul className="mt-2 space-y-1">
            {unsplit.map((p) => (
              <li key={p.id} className="text-[12px] text-(--color-brand-ink)">・{p.name}<span className="text-(--color-brand-sub)">（{p.region || "地域未入力"}）</span></li>
            ))}
          </ul>
        </div>
      )}

      <h2 className="mb-2 mt-6 text-[13px] font-bold text-(--color-brand-sub)">登録会社（{views.length}）</h2>
      <div className="space-y-2">
        {views.length === 0 && (
          <div className="rounded-xl border border-(--color-brand-line) bg-white p-4 text-[13px] text-(--color-brand-sub)">
            まだ会社がありません。上のフォームから作成してください（本番の初期状態は空です）。
          </div>
        )}
        {views.map((c) => (
          <div key={c.id} className="rounded-xl border border-(--color-brand-line) bg-white p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[14px] font-bold text-(--color-brand-ink)">{c.name}</span>
              <span
                className="rounded-full px-2 py-0.5 text-[11px] font-bold"
                style={{ color: STATUS_META[c.status]?.color, background: STATUS_META[c.status]?.bg }}
              >
                {STATUS_META[c.status]?.label ?? c.status}
              </span>
              <span className="rounded-full bg-(--color-brand-blue-light) px-2 py-0.5 text-[11px] font-bold text-(--color-brand-blue)">{LEVEL_JP[c.level] ?? c.level}</span>
              <span className="ml-auto text-[11.5px] text-(--color-brand-sub)">取引完了 {c.completed}</span>
            </div>
            <div className="mt-1 text-[11.5px] text-(--color-brand-sub)">{c.region || "地域未設定"}</div>
            <div className="mt-1 text-[11.5px] text-(--color-brand-sub)">
              実績データ：元請 完了 {c.primeCompleted}件 ／ 協力 完了 {c.partnerCompleted}件
            </div>
            <div className="mt-1 text-[11.5px] text-(--color-brand-sub)">
              メンバー：{c.members.length > 0 ? c.members.join("、 ") : "未登録"}
            </div>
            <div className="mt-2 flex gap-2">
              {c.status !== "active" && (
                <StatusButton
                  companyId={c.id}
                  status="active"
                  label="承認する（発注・受注を解禁）"
                  message={`${c.name} を承認し、発注・受注を解禁します。`}
                  className="rounded-lg bg-(--color-brand-green) px-3 py-1.5 text-[12px] font-bold text-white"
                />
              )}
              {c.status !== "suspended" && (
                <StatusButton
                  companyId={c.id}
                  status="suspended"
                  label="停止"
                  message={`${c.name} の利用を停止します。発注・受注ができなくなります。`}
                  className="rounded-lg border border-(--color-brand-red) px-3 py-1.5 text-[12px] font-bold text-(--color-brand-red)"
                />
              )}
              {c.status === "suspended" && (
                <StatusButton
                  companyId={c.id}
                  status="pending"
                  label="停止解除（承認待ちへ）"
                  message={`${c.name} の停止を解除し、承認待ちに戻します。`}
                  className="rounded-lg border border-(--color-brand-line) px-3 py-1.5 text-[12px] font-bold text-(--color-brand-sub)"
                />
              )}
            </div>
          </div>
        ))}
      </div>

      <p className="mt-6 text-[11px] leading-relaxed text-(--color-brand-faint)">
        ※ 信用実績（取引完了・期日内支払い等）の数値は取引イベントからのみ更新され、ここでは直接編集できません。
        修正が必要な場合は修正イベントを記録して再計算する方針です（今後実装）。
      </p>
      </div>
    </div>
  );
}
