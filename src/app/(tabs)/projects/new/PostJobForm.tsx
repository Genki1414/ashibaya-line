"use client";

import { useActionState, useState } from "react";
import { postProjectAction, type ProjectActionResult } from "../actions";

const input = "w-full rounded-lg border border-(--color-brand-line) px-3 py-2 text-[14px]";
const label = "mb-1 block text-[12.5px] font-bold text-(--color-brand-sub)";

export function PostJobForm() {
  const [state, formAction, pending] = useActionState<ProjectActionResult | null, FormData>(postProjectAction, null);
  const [jobType, setJobType] = useState("support");
  const [payType, setPayType] = useState("progress");

  return (
    <form action={formAction} className="space-y-3.5">
      <input type="hidden" name="jobType" value={jobType} />
      <input type="hidden" name="payType" value={payType} />

      <div>
        <label className={label}>案件種別</label>
        <div className="flex gap-1 rounded-xl bg-(--color-brand-bg) p-1">
          {[["support", "応援（人工）"], ["contract", "請負（一式）"]].map(([k, l]) => (
            <button type="button" key={k} onClick={() => setJobType(k)} className="flex-1 rounded-lg py-2 text-[12.5px] font-bold" style={{ background: jobType === k ? "var(--color-brand-blue)" : "transparent", color: jobType === k ? "#fff" : "var(--color-brand-sub)" }}>{l}</button>
          ))}
        </div>
      </div>

      <div><label className={label}>案件名 <span className="text-(--color-brand-red)">必須</span></label><input name="name" required placeholder="例）マンション改修 足場（組立・解体）" className={input} /></div>
      <div className="flex gap-2.5">
        <div className="flex-1"><label className={label}>地域</label><input name="region" placeholder="宮城県 仙台市" className={input} /></div>
        <div className="w-28"><label className={label}>募集人数</label><input name="need" type="number" placeholder="任意" className={input} /></div>
      </div>
      <div><label className={label}>現場住所</label><input name="address" className={input} /></div>

      <div className="flex gap-2.5">
        <div className="flex-1"><label className={label}>工期開始 <span className="text-(--color-brand-red)">必須</span></label><input name="start" type="date" required className={input} /></div>
        <div className="flex-1"><label className={label}>工期終了 <span className="text-(--color-brand-red)">必須</span></label><input name="end" type="date" required className={input} /></div>
      </div>
      <div className="text-[12px] font-bold text-(--color-brand-sub)">組立の予定</div>
      <div className="flex gap-2.5">
        <div className="flex-1"><label className={label}>組立 開始</label><input name="assemblyStart" type="date" className={input} /></div>
        <div className="flex-1"><label className={label}>組立 完了</label><input name="assemblyEnd" type="date" className={input} /></div>
      </div>
      <div className="text-[12px] font-bold text-(--color-brand-sub)">解体の予定</div>
      <div className="flex gap-2.5">
        <div className="flex-1"><label className={label}>解体 開始</label><input name="dismantleStart" type="date" className={input} /></div>
        <div className="flex-1"><label className={label}>解体 完了</label><input name="dismantleEnd" type="date" className={input} /></div>
      </div>

      <div><label className={label}>{jobType === "contract" ? "請負金額（円）" : "単価（日額・円）"} <span className="text-(--color-brand-red)">必須</span></label><input name="unitPrice" type="number" required className={input} /></div>

      <div>
        <label className={label}>支払い方式</label>
        <div className="mb-2 flex gap-1 rounded-xl bg-(--color-brand-bg) p-1">
          {[["progress", "出来高（組立/解体）"], ["lump", "一括"]].map(([k, l]) => (
            <button type="button" key={k} onClick={() => setPayType(k)} className="flex-1 rounded-lg py-2 text-[12.5px] font-bold" style={{ background: payType === k ? "var(--color-brand-blue)" : "transparent", color: payType === k ? "#fff" : "var(--color-brand-sub)" }}>{l}</button>
          ))}
        </div>
        <div className="flex gap-2.5">
          <div className="flex-1"><label className={label}>締め日</label><select name="closing" className={input} defaultValue="末">{["末", "25", "20", "15", "10"].map((o) => <option key={o} value={o}>{o}締め</option>)}</select></div>
          <div className="flex-1"><label className={label}>支払日</label><select name="payTerm" className={input} defaultValue="翌月末">{["翌月末", "翌月25", "翌月15", "翌々月末", "当月末払い"].map((o) => <option key={o} value={o}>{o}払い</option>)}</select></div>
        </div>
      </div>

      <div><label className={label}>仕事内容</label><textarea name="work" rows={3} className={input} /></div>
      <div><label className={label}>持ち物</label><input name="belongings" placeholder="ヘルメット・フルハーネス・安全靴" className={input} /></div>
      <div><label className={label}>募集締切</label><input name="deadline" type="date" className={input} /></div>
      <label className="flex items-center gap-2 text-[13px] font-bold text-(--color-brand-ink)"><input name="guaranteed" type="checkbox" defaultChecked className="h-4 w-4" />売掛保証をつける（表示のみ）</label>

      {state && !state.ok && state.error && (
        <div className="rounded-lg bg-(--color-brand-red-soft) px-3 py-2 text-[12.5px] font-semibold text-(--color-brand-red)">{state.error}</div>
      )}
      <button type="submit" disabled={pending} className="w-full rounded-xl bg-(--color-brand-blue) py-3 text-[14.5px] font-bold text-white disabled:opacity-50">
        {pending ? "公開中…" : "案件を公開する"}
      </button>
    </form>
  );
}
