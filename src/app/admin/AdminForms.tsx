"use client";

import { useActionState } from "react";
import { createCompany, createMember, type AdminActionResult } from "./actions";

function Result({ state }: { state: AdminActionResult | null }) {
  if (!state) return null;
  const cls = state.ok ? "bg-(--color-brand-green-soft) text-(--color-brand-green)" : "bg-(--color-brand-red-soft) text-(--color-brand-red)";
  return <div className={`mt-2 rounded-lg px-3 py-2 text-[12.5px] font-semibold ${cls}`}>{state.ok ? state.message : state.error}</div>;
}

export function AdminForms({ companies }: { companies: { id: string; name: string }[] }) {
  const [companyState, companyAction, companyPending] = useActionState<AdminActionResult | null, FormData>(createCompany, null);
  const [memberState, memberAction, memberPending] = useActionState<AdminActionResult | null, FormData>(createMember, null);

  const input = "w-full rounded-lg border border-(--color-brand-line) px-3 py-2 text-[14px]";
  const label = "mb-1 block text-[12px] font-bold text-(--color-brand-sub)";

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <form action={companyAction} className="rounded-xl border border-(--color-brand-line) bg-white p-4">
        <div className="mb-2 text-[13.5px] font-bold text-(--color-brand-ink)">会社を作成</div>
        <div className="space-y-2">
          <div><label className={label}>会社名 <span className="text-(--color-brand-red)">必須</span></label><input name="name" required className={input} /></div>
          <div><label className={label}>地域</label><input name="region" placeholder="宮城県 仙台市" className={input} /></div>
          <div><label className={label}>担当者</label><input name="contact" className={input} /></div>
        </div>
        <button disabled={companyPending} className="mt-3 w-full rounded-xl bg-(--color-brand-blue) py-2.5 text-[14px] font-bold text-white disabled:opacity-50">
          {companyPending ? "作成中…" : "会社を作成"}
        </button>
        <Result state={companyState} />
      </form>

      <form action={memberAction} className="rounded-xl border border-(--color-brand-line) bg-white p-4">
        <div className="mb-2 text-[13.5px] font-bold text-(--color-brand-ink)">会社メンバー（ログイン）を作成</div>
        <div className="space-y-2">
          <div>
            <label className={label}>所属会社 <span className="text-(--color-brand-red)">必須</span></label>
            <select name="companyId" required className={input} defaultValue="">
              <option value="" disabled>会社を選択</option>
              {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div><label className={label}>メールアドレス <span className="text-(--color-brand-red)">必須</span></label><input name="email" type="email" required className={input} /></div>
          <div><label className={label}>初期パスワード（8文字以上） <span className="text-(--color-brand-red)">必須</span></label><input name="password" type="text" required minLength={8} className={input} /></div>
        </div>
        <button disabled={memberPending} className="mt-3 w-full rounded-xl bg-(--color-brand-blue) py-2.5 text-[14px] font-bold text-white disabled:opacity-50">
          {memberPending ? "作成中…" : "メンバーを作成"}
        </button>
        <Result state={memberState} />
        {companies.length === 0 && <div className="mt-2 text-[11.5px] text-(--color-brand-faint)">先に会社を作成してください。</div>}
      </form>
    </div>
  );
}
