"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setActingCompanyAction, clearActingCompanyAction } from "./actions";

export interface DevCompany {
  id: string;
  name: string;
  status: string | null;
}

const STATUS_JP: Record<string, string> = { pending: "承認待ち", active: "取引可", suspended: "停止中" };

/** リリース前限定：操作する会社（元請/協力）を画面から切り替えるフローティングツール。 */
export function DevSwitcherClient({ companies, actingId }: { companies: DevCompany[]; actingId: string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const current = companies.find((c) => c.id === actingId) ?? null;

  const pick = (id: string) => {
    start(async () => {
      await setActingCompanyAction(id);
      setOpen(false);
      router.refresh();
    });
  };
  const clear = () => {
    start(async () => {
      await clearActingCompanyAction();
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <div className="fixed bottom-24 right-3 z-50">
      {open && (
        <div className="mb-2 max-h-[60dvh] w-64 overflow-y-auto rounded-2xl border border-(--color-brand-line) bg-white p-2 shadow-xl">
          <div className="px-2 py-1.5 text-[11px] font-bold text-(--color-brand-faint)">テスト用：操作する会社を選択</div>
          {companies.map((c) => {
            const active = c.id === actingId;
            return (
              <button
                key={c.id}
                onClick={() => pick(c.id)}
                disabled={pending}
                className="flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left disabled:opacity-50"
                style={{ background: active ? "var(--color-brand-blue-soft)" : "transparent" }}
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-(--color-brand-blue) text-[12px] font-black text-white">{c.name.slice(0, 1)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-bold text-(--color-brand-ink)">{c.name}</span>
                  <span className="block text-[10.5px] text-(--color-brand-sub)">{STATUS_JP[c.status ?? "active"] ?? c.status}</span>
                </span>
                {active && <span className="shrink-0 text-[11px] font-bold text-(--color-brand-blue)">選択中</span>}
              </button>
            );
          })}
          {companies.length === 0 && <div className="px-2 py-3 text-[12px] text-(--color-brand-sub)">会社がありません</div>}
          <button onClick={clear} disabled={pending} className="mt-1 w-full rounded-xl border border-(--color-brand-line) px-2 py-2 text-[12px] font-bold text-(--color-brand-sub) disabled:opacity-50">
            切り替えを解除（ログイン会社に戻す）
          </button>
        </div>
      )}
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-full border border-(--color-brand-amber) bg-white px-3.5 py-2 text-[12px] font-bold shadow-lg"
        style={{ color: "#9A6612" }}
      >
        <span aria-hidden>🧪</span>
        <span className="max-w-[130px] truncate">{current ? current.name : "会社を切替"}</span>
        <span className="text-(--color-brand-faint)">{open ? "▾" : "▸"}</span>
      </button>
    </div>
  );
}
