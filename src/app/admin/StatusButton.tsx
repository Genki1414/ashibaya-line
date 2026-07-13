"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setCompanyStatus } from "./actions";

/** 会社の承認/停止ボタン。実行前に必ず確認を挟む。 */
export function StatusButton({
  companyId,
  status,
  label,
  message,
  className,
}: {
  companyId: string;
  status: "active" | "suspended" | "pending";
  label: string;
  message: string;
  className: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  const run = () =>
    start(async () => {
      const fd = new FormData();
      fd.set("companyId", companyId);
      fd.set("status", status);
      await setCompanyStatus(fd);
      setOpen(false);
      router.refresh();
    });

  return (
    <>
      <button onClick={() => setOpen(true)} className={className}>
        {label}
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={() => setOpen(false)}>
          <div className="w-full max-w-[360px] rounded-t-2xl bg-white p-5 sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="text-[15px] font-bold text-(--color-brand-ink)">{label}</div>
            <div className="mt-2 text-[12.5px] text-(--color-brand-sub)">{message}</div>
            <div className="mt-4 flex gap-2">
              <button onClick={() => setOpen(false)} className="flex-1 rounded-xl border border-(--color-brand-line) py-2.5 text-[14px] font-bold text-(--color-brand-sub)">キャンセル</button>
              <button onClick={run} disabled={pending} className="flex-1 rounded-xl bg-(--color-brand-blue) py-2.5 text-[14px] font-bold text-white disabled:opacity-50">
                {pending ? "処理中…" : "実行する"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
