"use client";

import { useState } from "react";

/** クリックで開閉するプロフィールの項目セクション（自社/他社プロフィール共通）。 */
export function ProfileSection({ title, defaultOpen = false, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="mb-3 overflow-hidden rounded-2xl border border-(--color-brand-line) bg-white">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-1.5 px-3.5 py-3 text-left">
        <span className="h-3.5 w-1 rounded-full bg-(--color-brand-blue)" />
        <span className="text-[13.5px] font-bold text-(--color-brand-ink)">{title}</span>
        <span className="ml-auto text-[12px] text-(--color-brand-faint)">{open ? "閉じる ▲" : "開く ▼"}</span>
      </button>
      {open && <div className="border-t border-(--color-brand-line) p-3.5">{children}</div>}
    </div>
  );
}
