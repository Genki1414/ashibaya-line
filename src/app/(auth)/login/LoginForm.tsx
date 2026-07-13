"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { signIn, type AuthActionResult } from "../actions";

export function LoginForm() {
  const params = useSearchParams();
  const next = params.get("next") ?? "";
  const [state, formAction, pending] = useActionState<AuthActionResult | null, FormData>(signIn, null);

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="next" value={next} />
      <div>
        <label className="mb-1 block text-[12px] font-bold text-(--color-brand-sub)">メールアドレス</label>
        <input
          name="email"
          type="email"
          autoComplete="email"
          required
          className="w-full rounded-lg border border-(--color-brand-line) px-3 py-2 text-[14px]"
        />
      </div>
      <div>
        <label className="mb-1 block text-[12px] font-bold text-(--color-brand-sub)">パスワード</label>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="w-full rounded-lg border border-(--color-brand-line) px-3 py-2 text-[14px]"
        />
      </div>
      {state && !state.ok && state.error && (
        <div className="rounded-lg bg-(--color-brand-red-soft) px-3 py-2 text-[12.5px] font-semibold text-(--color-brand-red)">{state.error}</div>
      )}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl bg-(--color-brand-blue) py-2.5 text-[14px] font-bold text-white disabled:opacity-50"
      >
        {pending ? "ログイン中…" : "ログイン"}
      </button>
    </form>
  );
}
