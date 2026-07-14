"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { applyAction, selectPartnerAction, withdrawApplicationAction, setListingStateAction, setDisclosureAction } from "../actions";

function Toast({ msg, ok }: { msg: string; ok: boolean }) {
  return (
    <div
      className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full px-4 py-2 text-[13px] font-bold text-white shadow-lg"
      style={{ background: ok ? "var(--color-brand-green)" : "var(--color-brand-red)" }}
    >
      {msg}
    </div>
  );
}

function ConfirmOverlay({ title, message, pending, onConfirm, onClose, danger, confirmLabel }: { title: string; message: string; pending: boolean; onConfirm: () => void; onClose: () => void; danger?: boolean; confirmLabel?: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div className="w-full max-w-[360px] rounded-t-2xl bg-white p-5 sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="text-[15px] font-bold text-(--color-brand-ink)">{title}</div>
        <div className="mt-2 text-[12.5px] text-(--color-brand-sub)">{message}</div>
        <div className="mt-4 flex gap-2">
          <button onClick={onClose} className="flex-1 rounded-xl border border-(--color-brand-line) py-2.5 text-[14px] font-bold text-(--color-brand-sub)">キャンセル</button>
          <button onClick={onConfirm} disabled={pending} className="flex-1 rounded-xl py-2.5 text-[14px] font-bold text-white disabled:opacity-50" style={{ background: danger ? "var(--color-brand-red)" : "var(--color-brand-blue)" }}>
            {pending ? "処理中…" : confirmLabel ?? "実行する"}
          </button>
        </div>
      </div>
    </div>
  );
}

/** 応募の取り消し（応募会社本人）。 */
export function WithdrawButton({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [open, setOpen] = useState(false);
  const show = (msg: string, ok: boolean) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 2800); };
  const run = () =>
    start(async () => {
      const r = await withdrawApplicationAction(projectId);
      if (r.ok) { setOpen(false); show("応募を取り消しました", true); router.refresh(); }
      else show(r.error ?? "失敗しました", false);
    });
  return (
    <>
      <button onClick={() => setOpen(true)} disabled={pending} className="w-full rounded-xl border border-(--color-brand-red) py-2.5 text-[13.5px] font-bold text-(--color-brand-red) disabled:opacity-50">
        応募を取り消す
      </button>
      {open && <ConfirmOverlay title="応募を取り消しますか？" message="この案件への応募を取り消します。あとで募集中であれば再度応募できます。" pending={pending} onConfirm={run} onClose={() => setOpen(false)} danger confirmLabel="取り消す" />}
      {toast && <Toast msg={toast.msg} ok={toast.ok} />}
    </>
  );
}

/** 応募会社ごとに募集要項の閲覧を許可／取消（元請）。 */
export function DisclosureToggle({ projectId, partnerId, granted }: { projectId: string; partnerId: string; granted: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [open, setOpen] = useState(false);
  const show = (msg: string, ok: boolean) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 2800); };
  const run = () =>
    start(async () => {
      const r = await setDisclosureAction(projectId, partnerId, !granted);
      if (r.ok) { setOpen(false); show(granted ? "募集要項の許可を取り消しました" : "募集要項を開示しました", true); router.refresh(); }
      else show(r.error ?? "失敗しました", false);
    });
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        disabled={pending}
        className={`rounded-xl px-3 py-2 text-[13px] font-bold disabled:opacity-50 ${granted ? "border border-(--color-brand-green) bg-(--color-brand-green-soft) text-(--color-brand-green)" : "border border-(--color-brand-blue) text-(--color-brand-blue)"}`}
      >
        {granted ? "募集要項 開示中" : "募集要項を開示"}
      </button>
      {open && (
        <ConfirmOverlay
          title={granted ? "募集要項の開示を取り消しますか？" : "この会社に募集要項を開示しますか？"}
          message={granted ? "この会社は詳しい募集要項（現場住所・工期・仕事内容など）を見られなくなります。" : "この会社に、詳しい募集要項（現場住所・工期・仕事内容など）を公開します。"}
          pending={pending}
          onConfirm={run}
          onClose={() => setOpen(false)}
          danger={granted}
          confirmLabel={granted ? "取り消す" : "開示する"}
        />
      )}
      {toast && <Toast msg={toast.msg} ok={toast.ok} />}
    </>
  );
}

/** 掲載の一時停止／再開／削除（元請）。 */
export function ListingButton({ projectId, op }: { projectId: string; op: "pause" | "resume" | "close" }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [open, setOpen] = useState(false);
  const show = (msg: string, ok: boolean) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 2800); };
  const meta = {
    pause: { btn: "掲載を一時停止", title: "掲載を一時停止しますか？", message: "検索・一覧に表示されなくなり、新規応募を停止します。応募済みの情報は保持され、いつでも再開できます。", done: "一時停止しました", danger: false, cls: "border border-(--color-brand-amber) text-(--color-brand-amber)" },
    resume: { btn: "募集を再開", title: "募集を再開しますか？", message: "再び検索・一覧に表示され、応募を受け付けます。", done: "募集を再開しました", danger: false, cls: "border border-(--color-brand-green) text-(--color-brand-green)" },
    close: { btn: "案件を削除", title: "この案件を削除しますか？", message: "一覧・検索から削除され、新規応募もできなくなります。選定済み（取引中）の案件は削除できません。", done: "案件を削除しました", danger: true, cls: "border border-(--color-brand-red) text-(--color-brand-red)" },
  }[op];
  const run = () =>
    start(async () => {
      const r = await setListingStateAction(projectId, op);
      if (r.ok) { setOpen(false); show(meta.done, true); if (op === "close") router.push("/projects"); else router.refresh(); }
      else show(r.error ?? "失敗しました", false);
    });
  return (
    <>
      <button onClick={() => setOpen(true)} disabled={pending} className={`w-full rounded-xl py-2.5 text-[13.5px] font-bold disabled:opacity-50 ${meta.cls}`}>
        {meta.btn}
      </button>
      {open && <ConfirmOverlay title={meta.title} message={meta.message} pending={pending} onConfirm={run} onClose={() => setOpen(false)} danger={meta.danger} confirmLabel={op === "close" ? "削除する" : "実行する"} />}
      {toast && <Toast msg={toast.msg} ok={toast.ok} />}
    </>
  );
}

export function ApplyButton({ projectId, disabled }: { projectId: string; disabled?: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [open, setOpen] = useState(false);
  const show = (msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 2800);
  };
  const run = () =>
    start(async () => {
      const r = await applyAction(projectId);
      if (r.ok) {
        setOpen(false);
        show("応募しました", true);
        router.refresh();
      } else show(r.error ?? "失敗しました", false);
    });
  return (
    <>
      <button
        disabled={pending || disabled}
        onClick={() => setOpen(true)}
        className="w-full rounded-xl bg-(--color-brand-blue) py-3 text-[14.5px] font-bold text-white disabled:opacity-50"
      >
        この案件に応募する
      </button>
      {open && <ConfirmOverlay title="この案件に応募しますか？" message="応募すると元請に通知され、選定を待ちます。" pending={pending} onConfirm={run} onClose={() => setOpen(false)} />}
      {toast && <Toast msg={toast.msg} ok={toast.ok} />}
    </>
  );
}

export function SelectButton({ projectId, partnerId }: { projectId: string; partnerId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [open, setOpen] = useState(false);
  const show = (msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 2800);
  };
  const run = () =>
    start(async () => {
      const r = await selectPartnerAction(projectId, partnerId);
      if (r.ok) {
        setOpen(false);
        show("この会社に依頼しました（取引を作成）", true);
        router.refresh();
      } else show(r.error ?? "失敗しました", false);
    });
  return (
    <>
      <button
        disabled={pending}
        onClick={() => setOpen(true)}
        className="flex-1 rounded-xl bg-(--color-brand-blue) py-2.5 text-[13.5px] font-bold text-white disabled:opacity-50"
      >
        この会社に依頼
      </button>
      {open && (
        <ConfirmOverlay
          title="この会社に依頼しますか？"
          message="選定すると取引が作成され、他の応募は締め切られます。この操作は取り消せません。"
          pending={pending}
          onConfirm={run}
          onClose={() => setOpen(false)}
        />
      )}
      {toast && <Toast msg={toast.msg} ok={toast.ok} />}
    </>
  );
}
