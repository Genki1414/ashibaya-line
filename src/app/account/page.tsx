import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthContext } from "@/server/auth";
import { createClient } from "@/lib/supabase/server";
import { rowToCompany, type CompanyRow } from "@/infra/supabase/mappers";
import { companyCreditLevel } from "@/domain/company";
import { signOut } from "@/app/(auth)/actions";
import { PushToggle } from "@/app/push/PushToggle";

export const dynamic = "force-dynamic";
export const metadata = { title: "マイアカウント" };

const LEVEL_JP: Record<string, string> = { unverified: "未認証", bronze: "Bronze", silver: "Silver", gold: "Gold", platinum: "Platinum" };

export default async function AccountPage() {
  const ctx = await getAuthContext();
  if (!ctx.user) redirect("/login?next=/account");
  if (ctx.isAdmin) redirect("/admin");

  const supabase = await createClient();
  let companyName = "（未所属）";
  let level = "unverified";
  let completed = 0;
  let status: string = "active";
  if (ctx.companyId) {
    const { data } = await supabase.from("companies").select("*").eq("id", ctx.companyId).maybeSingle();
    if (data) {
      const c = rowToCompany(data as unknown as CompanyRow);
      companyName = c.name;
      level = companyCreditLevel(c, false);
      completed = c.metrics.completed;
      status = c.status ?? "active";
    }
  }

  return (
    <div className="mx-auto min-h-dvh max-w-[420px] p-4">
      <header className="mb-4 flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-(--color-brand-blue) text-[15px] font-black text-white">足</span>
        <div className="flex-1">
          <div className="text-[15px] font-bold text-(--color-brand-ink)">マイアカウント</div>
          <div className="text-[11.5px] text-(--color-brand-sub)">{ctx.user.email}</div>
        </div>
        <form action={signOut}>
          <button className="rounded-lg border border-(--color-brand-line) px-3 py-1.5 text-[12.5px] font-bold text-(--color-brand-sub)">ログアウト</button>
        </form>
      </header>

      <div className="rounded-2xl border border-(--color-brand-line) bg-white p-4">
        <div className="text-[11.5px] font-bold text-(--color-brand-sub)">所属会社</div>
        <div className="mt-1 flex items-center gap-2">
          <span className="text-[17px] font-black text-(--color-brand-ink)">{companyName}</span>
          {ctx.companyId && <span className="rounded-full bg-(--color-brand-blue-light) px-2 py-0.5 text-[11px] font-bold text-(--color-brand-blue)">{LEVEL_JP[level] ?? level}</span>}
        </div>
        {ctx.companyId ? (
          <div className="mt-1 text-[12px] text-(--color-brand-sub)">取引完了 {completed} 件 ／ あなたはこの会社のメンバーとしてログイン中です。</div>
        ) : (
          <div className="mt-1 text-[12px] text-(--color-brand-red)">会社に所属していません。本部管理者にメンバー登録を依頼してください。</div>
        )}
      </div>

      {ctx.companyId && status !== "active" && (
        <div className="mt-3 rounded-2xl border border-(--color-brand-amber) bg-(--color-brand-amber-soft) p-4">
          <div className="text-[13px] font-bold text-(--color-brand-ink)">
            {status === "pending" ? "本部の承認待ちです" : "利用が停止されています"}
          </div>
          <div className="mt-1 text-[12px] text-(--color-brand-sub)">
            {status === "pending"
              ? "会社プロフィールや認証書類の準備は今すぐ行えます。案件の発注・受注は本部の承認後に解禁されます。"
              : "利用が停止されています。本部管理者にお問い合わせください。"}
          </div>
        </div>
      )}

      <PushToggle />

      <div className="mt-3 rounded-2xl border border-(--color-brand-line) bg-(--color-brand-blue-soft) p-4 text-[12px] leading-relaxed text-(--color-brand-sub)">
        Phase 1（認証基盤）が有効です。案件・取引などの画面は順次このアカウントに接続していきます。
        取引ごとの「元請／協力」は、この所属会社と取引の当事者IDから自動判定されます（役割スイッチは使いません）。
      </div>

      <div className="mt-3 text-center">
        <Link href="/" className="text-[12.5px] font-bold text-(--color-brand-blue)">プロトタイプ（/）を見る →</Link>
      </div>
    </div>
  );
}
