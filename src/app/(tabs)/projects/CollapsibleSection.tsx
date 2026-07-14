"use client";

import { useState } from "react";

/** タップで開閉するセクション（自社の投稿一覧などに使用）。既定は閉じた状態。 */
export function CollapsibleSection({ title, count, defaultOpen = false, children }: { title: string; count?: number; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="mb-4">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 rounded-xl border border-(--color-brand-line) bg-white px-3.5 py-2.5"
      >
        <span className="text-[12.5px] font-bold text-(--color-brand-ink)">{title}</span>
        {count != null && <span className="rounded-full bg-(--color-brand-blue-light) px-2 py-0.5 text-[11px] font-bold text-(--color-brand-blue)">{count}</span>}
        <span className="ml-auto text-[13px] text-(--color-brand-faint)">{open ? "▲ 閉じる" : "▼ 一覧を表示"}</span>
      </button>
      {open && <div className="mt-2.5">{children}</div>}
    </div>
  );
}
