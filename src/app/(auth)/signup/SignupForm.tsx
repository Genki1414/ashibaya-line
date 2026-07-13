"use client";

import { useActionState } from "react";
import { signUp, type AuthActionResult } from "../actions";

export function SignupForm() {
  const [state, formAction, pending] = useActionState<AuthActionResult | null, FormData>(signUp, null);
  const input = "w-full rounded-lg border border-(--color-brand-line) px-3 py-2 text-[14px]";
  const label = "mb-1 block text-[12px] font-bold text-(--color-brand-sub)";

  return (
    <form action={formAction} className="space-y-3">
      <div>
        <label className={label}>会社名 <span className="text-(--color-brand-red)">必須</span></label>
        <input name="companyName" required placeholder="株式会社みらい足場" className={input} />
      </div>
      <div>
        <label className={label}>地域</label>
        <input name="region" placeholder="宮城県 仙台市" className={input} />
      </div>
      <div>
        <label className={label}>担当者名</label>
        <input name="contact" placeholder="佐藤 誠" className={input} />
      </div>
      <div>
        <label className={label}>メールアドレス <span className="text-(--color-brand-red)">必須</span></label>
        <input name="email" type="email" autoComplete="email" required className={input} />
      </div>
      <div>
        <label className={label}>パスワード（8文字以上） <span className="text-(--color-brand-red)">必須</span></label>
        <input name="password" type="password" autoComplete="new-password" required minLength={8} className={input} />
      </div>
      {state && !state.ok && state.error && (
        <div className="rounded-lg bg-(--color-brand-red-soft) px-3 py-2 text-[12.5px] font-semibold text-(--color-brand-red)">{state.error}</div>
      )}
      <button type="submit" disabled={pending} className="w-full rounded-xl bg-(--color-brand-blue) py-2.5 text-[14px] font-bold text-white disabled:opacity-50">
        {pending ? "登録中…" : "登録する"}
      </button>
    </form>
  );
}
