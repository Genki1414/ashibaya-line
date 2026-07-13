"use client";

import { useActionState, useState } from "react";
import type { ProjectActionResult } from "./actions";

const input = "w-full rounded-lg border border-(--color-brand-line) px-3 py-2 text-[14px]";
const label = "mb-1 block text-[12.5px] font-bold text-(--color-brand-sub)";

export interface JobFormState {
  name: string;
  jobType: string;
  region: string;
  address: string;
  start: string;
  end: string;
  assemblyStart: string;
  assemblyEnd: string;
  dismantleStart: string;
  dismantleEnd: string;
  need: string;
  price: string;
  payType: string;
  closing: string;
  payTerm: string;
  work: string;
  belongings: string;
  deadline: string;
}

const EMPTY: JobFormState = {
  name: "",
  jobType: "support",
  region: "",
  address: "",
  start: "",
  end: "",
  assemblyStart: "",
  assemblyEnd: "",
  dismantleStart: "",
  dismantleEnd: "",
  need: "",
  price: "",
  payType: "progress",
  closing: "末",
  payTerm: "翌月末",
  work: "",
  belongings: "ヘルメット・フルハーネス・安全靴",
  deadline: "",
};

const fmtMoney = (raw: string) => {
  const digits = raw.replace(/[^\d]/g, "");
  return digits ? Number(digits).toLocaleString() : "";
};
const JOB_LABEL: Record<string, string> = { support: "応援（人工）", contract: "請負（一式）" };
const PAY_LABEL: Record<string, string> = { progress: "出来高（組立/解体）", lump: "一括" };

type Action = (prev: ProjectActionResult | null, fd: FormData) => Promise<ProjectActionResult>;

export function JobForm({
  action,
  mode,
  projectId,
  defaults,
}: {
  action: Action;
  mode: "create" | "edit";
  projectId?: string;
  defaults?: Partial<JobFormState>;
}) {
  const [state, formAction, pending] = useActionState<ProjectActionResult | null, FormData>(action, null);
  const [f, setF] = useState<JobFormState>({ ...EMPTY, ...defaults, price: defaults?.price ? fmtMoney(defaults.price) : "" });
  const [confirming, setConfirming] = useState(false);
  const set = <K extends keyof JobFormState>(k: K, v: JobFormState[K]) => setF((p) => ({ ...p, [k]: v }));

  const priceLabel = f.jobType === "contract" ? "請負金額（円）" : "単価（日額・円）";
  const valid = Boolean(f.name && f.region && f.start && f.end && f.price);
  const submitLabel = mode === "edit" ? "この内容で更新する" : "案件を公開する（LINEへ通知）";

  const summary: [string, string][] = [
    ["案件種別", JOB_LABEL[f.jobType] ?? f.jobType],
    ["案件名", f.name],
    ["地域", f.region],
    ["現場住所", f.address || "（後日連絡）"],
    ["工期", `${f.start} 〜 ${f.end}`],
    ["組立予定", `${f.assemblyStart || f.start} 〜 ${f.assemblyEnd || f.assemblyStart || f.start}`],
    ["解体予定", `${f.dismantleStart || f.end} 〜 ${f.dismantleEnd || f.dismantleStart || f.end}`],
    [priceLabel, f.price ? `¥${f.price}` : "-"],
    ...(f.need ? ([["募集人数", `${f.need}名`]] as [string, string][]) : []),
    ["支払方式", PAY_LABEL[f.payType] ?? f.payType],
    ["支払条件", `${f.closing}締め・${f.payTerm}払い`],
    ["持ち物", f.belongings || "-"],
    ["募集締切", f.deadline || f.start],
  ];

  return (
    <form action={formAction} className="space-y-3.5">
      {projectId && <input type="hidden" name="id" value={projectId} />}
      <input type="hidden" name="jobType" value={f.jobType} />
      <input type="hidden" name="payType" value={f.payType} />
      <input type="hidden" name="unitPrice" value={f.price} />

      <div className="rounded-xl border border-(--color-brand-blue-light) bg-(--color-brand-blue-soft) p-3 text-[12.5px] leading-relaxed text-(--color-brand-sub)">
        公開すると（LINE連携時は）グループへ新着通知が届きます。募集の入口はLINE、正式な取引はこのアプリで記録します。
      </div>

      <div>
        <label className={label}>案件種別</label>
        <div className="flex gap-1 rounded-xl bg-(--color-brand-bg) p-1">
          {[["support", "応援（人工）"], ["contract", "請負（一式）"]].map(([k, l]) => (
            <button type="button" key={k} onClick={() => set("jobType", k)} className="flex-1 rounded-lg py-2 text-[12.5px] font-bold" style={{ background: f.jobType === k ? "var(--color-brand-blue)" : "transparent", color: f.jobType === k ? "#fff" : "var(--color-brand-sub)" }}>{l}</button>
          ))}
        </div>
      </div>

      <div><label className={label}>案件名 <span className="text-(--color-brand-red)">必須</span></label><input name="name" value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="例）マンション改修 足場（組立・解体）" className={input} /></div>
      <div className="flex gap-2.5">
        <div className="flex-1"><label className={label}>地域 <span className="text-(--color-brand-red)">必須</span></label><input name="region" value={f.region} onChange={(e) => set("region", e.target.value)} placeholder="宮城県 仙台市" className={input} /></div>
        <div className="w-28"><label className={label}>募集人数</label><input name="need" value={f.need} onChange={(e) => set("need", e.target.value)} type="number" placeholder="任意" className={input} /></div>
      </div>
      <div><label className={label}>現場住所</label><input name="address" value={f.address} onChange={(e) => set("address", e.target.value)} className={input} /></div>

      <div className="flex gap-2.5">
        <div className="flex-1"><label className={label}>工期開始 <span className="text-(--color-brand-red)">必須</span></label><input name="start" value={f.start} onChange={(e) => set("start", e.target.value)} type="date" className={input} /></div>
        <div className="flex-1"><label className={label}>工期終了 <span className="text-(--color-brand-red)">必須</span></label><input name="end" value={f.end} onChange={(e) => set("end", e.target.value)} type="date" className={input} /></div>
      </div>
      <div className="text-[12px] font-bold text-(--color-brand-sub)">組立の予定</div>
      <div className="flex gap-2.5">
        <div className="flex-1"><label className={label}>組立 開始</label><input name="assemblyStart" value={f.assemblyStart} onChange={(e) => set("assemblyStart", e.target.value)} type="date" className={input} /></div>
        <div className="flex-1"><label className={label}>組立 完了</label><input name="assemblyEnd" value={f.assemblyEnd} onChange={(e) => set("assemblyEnd", e.target.value)} type="date" className={input} /></div>
      </div>
      <div className="text-[12px] font-bold text-(--color-brand-sub)">解体の予定</div>
      <div className="flex gap-2.5">
        <div className="flex-1"><label className={label}>解体 開始</label><input name="dismantleStart" value={f.dismantleStart} onChange={(e) => set("dismantleStart", e.target.value)} type="date" className={input} /></div>
        <div className="flex-1"><label className={label}>解体 完了</label><input name="dismantleEnd" value={f.dismantleEnd} onChange={(e) => set("dismantleEnd", e.target.value)} type="date" className={input} /></div>
      </div>
      <div className="-mt-1 text-[11px] leading-relaxed text-(--color-brand-faint)">※ 組立分の入金前に解体日が到来してもかまいません（組立と解体は独立して進行します）。</div>

      <div>
        <label className={label}>{priceLabel} <span className="text-(--color-brand-red)">必須</span></label>
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[14px] font-bold text-(--color-brand-sub)">¥</span>
          <input name="unitPriceDisplay" value={f.price} onChange={(e) => set("price", fmtMoney(e.target.value))} inputMode="numeric" placeholder="22,000" className={`${input} pl-7`} />
        </div>
      </div>

      <div>
        <label className={label}>支払い方式</label>
        <div className="mb-2 flex gap-1 rounded-xl bg-(--color-brand-bg) p-1">
          {[["progress", "出来高（組立/解体）"], ["lump", "一括"]].map(([k, l]) => (
            <button type="button" key={k} onClick={() => set("payType", k)} className="flex-1 rounded-lg py-2 text-[12.5px] font-bold" style={{ background: f.payType === k ? "var(--color-brand-blue)" : "transparent", color: f.payType === k ? "#fff" : "var(--color-brand-sub)" }}>{l}</button>
          ))}
        </div>
        <div className="flex gap-2.5">
          <div className="flex-1"><label className={label}>締め日</label><select name="closing" value={f.closing} onChange={(e) => set("closing", e.target.value)} className={input}>{["末", "25", "20", "15", "10"].map((o) => <option key={o} value={o}>{o}締め</option>)}</select></div>
          <div className="flex-1"><label className={label}>支払日</label><select name="payTerm" value={f.payTerm} onChange={(e) => set("payTerm", e.target.value)} className={input}>{["翌月末", "翌月25", "翌月15", "翌々月末", "当月末払い"].map((o) => <option key={o} value={o}>{o}払い</option>)}</select></div>
        </div>
      </div>

      <div><label className={label}>仕事内容</label><textarea name="work" value={f.work} onChange={(e) => set("work", e.target.value)} rows={3} className={input} /></div>
      <div><label className={label}>持ち物</label><input name="belongings" value={f.belongings} onChange={(e) => set("belongings", e.target.value)} placeholder="ヘルメット・フルハーネス・安全靴" className={input} /></div>
      <div><label className={label}>募集締切</label><input name="deadline" value={f.deadline} onChange={(e) => set("deadline", e.target.value)} type="date" className={input} /></div>

      {/* 売掛保証は受注側（協力会社）が受注時に選択する */}
      <div className="flex items-center gap-2.5 rounded-2xl border border-(--color-brand-line) bg-(--color-brand-bg) p-3.5">
        <span className="text-[20px]" aria-hidden>🛡️</span>
        <div className="flex-1 text-[12px] leading-relaxed text-(--color-brand-sub)">
          売掛保証は、代金を受け取る<span className="font-bold text-(--color-brand-ink)">受注側（協力会社）</span>が受注時に適用するか選択します。
        </div>
      </div>

      {state && !state.ok && state.error && (
        <div className="rounded-lg bg-(--color-brand-red-soft) px-3 py-2 text-[12.5px] font-semibold text-(--color-brand-red)">{state.error}</div>
      )}

      {/* 一次ボタン：送信ではなく確認へ */}
      <button
        type="button"
        disabled={!valid}
        onClick={() => setConfirming(true)}
        className="w-full rounded-xl bg-(--color-brand-blue) py-3 text-[14.5px] font-bold text-white disabled:opacity-50"
      >
        入力内容を確認する
      </button>

      {/* 確認モーダル */}
      {confirming && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={() => setConfirming(false)}>
          <div className="max-h-[85dvh] w-full max-w-[420px] overflow-y-auto rounded-t-2xl bg-white p-5 sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="text-[15.5px] font-bold text-(--color-brand-ink)">この内容で{mode === "edit" ? "更新" : "公開"}しますか？</div>
            <div className="mt-1 text-[12px] text-(--color-brand-sub)">内容をご確認ください。修正する場合は「戻る」を押してください。</div>
            <div className="mt-3 overflow-hidden rounded-xl border border-(--color-brand-line)">
              {summary.map(([k, v], i) => (
                <div key={k} className="flex gap-3 px-3.5 py-2.5" style={{ borderBottom: i < summary.length - 1 ? "1px solid var(--color-brand-line)" : "none" }}>
                  <div className="w-24 shrink-0 text-[12px] font-semibold text-(--color-brand-sub)">{k}</div>
                  <div className="text-[13px] font-semibold text-(--color-brand-ink)">{v || "-"}</div>
                </div>
              ))}
            </div>
            {f.work && <div className="mt-2 rounded-xl bg-(--color-brand-bg) p-3 text-[12.5px] leading-relaxed text-(--color-brand-ink)">{f.work}</div>}
            {state && !state.ok && state.error && (
              <div className="mt-3 rounded-lg bg-(--color-brand-red-soft) px-3 py-2 text-[12.5px] font-semibold text-(--color-brand-red)">{state.error}</div>
            )}
            <div className="mt-4 flex gap-2">
              <button type="button" onClick={() => setConfirming(false)} className="flex-1 rounded-xl border border-(--color-brand-line) py-2.5 text-[14px] font-bold text-(--color-brand-sub)">戻る</button>
              <button type="submit" disabled={pending} className="flex-1 rounded-xl bg-(--color-brand-blue) py-2.5 text-[14px] font-bold text-white disabled:opacity-50">
                {pending ? (mode === "edit" ? "更新中…" : "公開中…") : submitLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}
