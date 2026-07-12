"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setActingCompany } from "@/app/(tabs)/transactions/actions";

interface Option {
  id: string;
  name: string;
}

/**
 * 擬似ログイン（操作する会社）の切り替え。v8 の元請/協力ロールスイッチの置き換えで、
 * 認証方式が LINE ログインに変わっても、この切替を本ログインに差し替えるだけでよい。
 */
export function CompanySwitch({ options, current }: { options: Option[]; current: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const switchTo = (id: string) => {
    startTransition(async () => {
      await setActingCompany(id);
      router.refresh();
    });
  };

  return (
    <div className="flex items-center gap-1 border-b border-(--color-brand-line) bg-(--color-brand-blue-soft) px-3 py-2">
      <span className="mr-1 text-[11px] font-bold text-(--color-brand-sub)">擬似ログイン</span>
      {options.map((o) => (
        <button
          key={o.id}
          disabled={pending}
          onClick={() => switchTo(o.id)}
          className="rounded-full px-2.5 py-1 text-[11.5px] font-bold disabled:opacity-50"
          style={{
            background: o.id === current ? "var(--color-brand-blue)" : "white",
            color: o.id === current ? "white" : "var(--color-brand-sub)",
            border: "1px solid var(--color-brand-line)",
          }}
        >
          {o.name}
        </button>
      ))}
    </div>
  );
}
