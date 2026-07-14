"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  PREFECTURES,
  activeFilterCount,
  defaultFilter,
  filterToQuery,
  type ProjectFilter,
  type ProjectSort,
} from "@/domain/projectSearch";

const box = "w-full rounded-lg border border-(--color-brand-line) px-3 py-2 text-[14px]";
const lbl = "mb-1 block text-[12px] font-bold text-(--color-brand-sub)";

function Seg<T extends string>({ value, options, onChange }: { value: T | null; options: [T | null, string][]; onChange: (v: T | null) => void }) {
  return (
    <div className="flex flex-wrap gap-1 rounded-xl bg-(--color-brand-bg) p-1">
      {options.map(([v, l]) => {
        const active = value === v;
        return (
          <button
            key={l}
            type="button"
            onClick={() => onChange(v)}
            className="flex-1 rounded-lg px-2 py-1.5 text-[12px] font-bold whitespace-nowrap"
            style={{ background: active ? "var(--color-brand-blue)" : "transparent", color: active ? "#fff" : "var(--color-brand-sub)" }}
          >
            {l}
          </button>
        );
      })}
    </div>
  );
}

function Toggle({ on, label, onChange }: { on: boolean; label: string; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!on)} className="flex w-full items-center justify-between rounded-lg border border-(--color-brand-line) px-3 py-2 text-[13px]">
      <span className="text-(--color-brand-ink)">{label}</span>
      <span className="rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ background: on ? "var(--color-brand-blue)" : "var(--color-brand-line)", color: on ? "#fff" : "var(--color-brand-sub)" }}>
        {on ? "ON" : "OFF"}
      </span>
    </button>
  );
}

const SORT_LABEL: Record<ProjectSort, string> = { new: "新着順", startSoon: "開始が近い順", amountDesc: "金額が高い順" };

export function ProjectsFilterBar({ filter, total }: { filter: ProjectFilter; total: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<ProjectFilter>(filter);
  const [pending, start] = useTransition();
  const count = activeFilterCount(filter);

  const push = (f: ProjectFilter) => {
    const qs = filterToQuery(f);
    start(() => router.push(qs ? `/projects?${qs}` : "/projects", { scroll: false }));
  };
  const apply = () => {
    push(draft);
    setOpen(false);
  };
  const clearAll = () => {
    const d = defaultFilter();
    setDraft(d);
    push(d);
    setOpen(false);
  };
  const openSheet = () => {
    setDraft(filter); // 現在のURL条件でシートを初期化
    setOpen(true);
  };
  const set = <K extends keyof ProjectFilter>(k: K, v: ProjectFilter[K]) => setDraft((p) => ({ ...p, [k]: v }));

  const amountLabel = draft.jobType === "contract" ? "請負金額（円）" : draft.jobType === "support" ? "日額単価（円）" : "金額（円）";

  return (
    <div className="mb-3">
      <div className="flex items-center gap-2">
        <button
          onClick={openSheet}
          className="flex items-center gap-1.5 rounded-xl border border-(--color-brand-blue) bg-(--color-brand-blue-soft) px-3 py-2 text-[13px] font-bold text-(--color-brand-blue)"
        >
          <span aria-hidden>🔍</span>絞り込み
          {count > 0 && <span className="rounded-full bg-(--color-brand-blue) px-1.5 text-[11px] text-white">{count}</span>}
        </button>
        <select
          value={filter.sort}
          onChange={(e) => push({ ...filter, sort: e.target.value as ProjectSort })}
          className="rounded-xl border border-(--color-brand-line) bg-white px-2 py-2 text-[12.5px] font-bold text-(--color-brand-sub)"
        >
          {(Object.keys(SORT_LABEL) as ProjectSort[]).map((s) => <option key={s} value={s}>{SORT_LABEL[s]}</option>)}
        </select>
        <span className="ml-auto text-[12.5px] font-bold text-(--color-brand-sub)">{pending ? "…" : `${total}件`}</span>
      </div>
      {count > 0 && (
        <button onClick={clearAll} className="mt-1.5 text-[12px] font-bold text-(--color-brand-blue) underline">
          条件をすべて解除
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={() => setOpen(false)}>
          <div className="flex max-h-[88dvh] w-full max-w-[460px] flex-col rounded-t-2xl bg-white" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-(--color-brand-line) px-4 py-3">
              <span className="text-[15px] font-bold text-(--color-brand-ink)">絞り込み</span>
              <button onClick={() => setOpen(false)} className="text-[13px] font-bold text-(--color-brand-sub)">閉じる</button>
            </div>

            <div className="flex-1 space-y-3.5 overflow-y-auto p-4">
              <div>
                <label className={lbl}>都道府県</label>
                <select value={draft.prefecture ?? ""} onChange={(e) => set("prefecture", e.target.value || null)} className={box}>
                  <option value="">指定なし</option>
                  {PREFECTURES.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className={lbl}>市区町村（部分一致）</label>
                <input value={draft.city ?? ""} onChange={(e) => set("city", e.target.value || null)} placeholder="例）仙台市（「仙台市青葉区」も一致）" className={box} />
              </div>

              <div>
                <label className={lbl}>案件種別</label>
                <Seg<"support" | "contract">
                  value={draft.jobType}
                  onChange={(v) => set("jobType", v)}
                  options={[[null, "指定なし"], ["support", "応援"], ["contract", "請負"]]}
                />
              </div>

              <div>
                <label className={lbl}>{amountLabel}</label>
                {draft.jobType === null && (
                  <p className="mb-1 text-[11px] text-(--color-brand-faint)">※応援は日額単価、請負は請負総額で意味が異なります。</p>
                )}
                <div className="flex items-center gap-2">
                  <input type="number" inputMode="numeric" value={draft.amountMin ?? ""} onChange={(e) => set("amountMin", e.target.value ? Number(e.target.value) : null)} placeholder="下限" className={box} />
                  <span className="text-(--color-brand-sub)">〜</span>
                  <input type="number" inputMode="numeric" value={draft.amountMax ?? ""} onChange={(e) => set("amountMax", e.target.value ? Number(e.target.value) : null)} placeholder="上限" className={box} />
                </div>
              </div>

              <div>
                <label className={lbl}>募集人数</label>
                <Seg<"1" | "2" | "3plus">
                  value={draft.need}
                  onChange={(v) => set("need", v)}
                  options={[[null, "指定なし"], ["1", "1名"], ["2", "2名"], ["3plus", "3名以上"]]}
                />
                <p className="mt-1 text-[11px] text-(--color-brand-faint)">※人数未設定の案件は「指定なし」のときのみ表示されます。</p>
              </div>

              <div>
                <label className={lbl}>組立／解体（請負）</label>
                <Seg<"assembly" | "dismantle" | "both">
                  value={draft.phase}
                  onChange={(v) => set("phase", v)}
                  options={[[null, "指定なし"], ["assembly", "組立のみ"], ["dismantle", "解体のみ"], ["both", "組立＋解体"]]}
                />
                <p className="mt-1 text-[11px] text-(--color-brand-faint)">※応援（単一作業）は「案件種別＝応援」で検索してください。</p>
              </div>

              <div>
                <label className={lbl}>希望期間（案件工期と重なるもの）</label>
                <div className="flex items-center gap-2">
                  <input type="date" value={draft.periodStart ?? ""} onChange={(e) => set("periodStart", e.target.value || null)} className={box} />
                  <span className="text-(--color-brand-sub)">〜</span>
                  <input type="date" value={draft.periodEnd ?? ""} onChange={(e) => set("periodEnd", e.target.value || null)} className={box} />
                </div>
              </div>

              <div className="space-y-2">
                <Toggle on={draft.guaranteed} label="売掛保証対象のみ" onChange={(v) => set("guaranteed", v)} />
                <Toggle on={draft.recruitingOnly} label="募集中のみ" onChange={(v) => set("recruitingOnly", v)} />
                <Toggle on={draft.includeEnded} label="募集終了（締切超過）も含む" onChange={(v) => set("includeEnded", v)} />
                <Toggle on={draft.primeApproved} label="本部承認済みの元請のみ" onChange={(v) => set("primeApproved", v)} />
              </div>
            </div>

            <div className="flex gap-2 border-t border-(--color-brand-line) p-3" style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}>
              <button onClick={clearAll} className="flex-1 rounded-xl border border-(--color-brand-line) py-2.5 text-[13.5px] font-bold text-(--color-brand-sub)">
                すべて解除
              </button>
              <button onClick={apply} className="flex-[2] rounded-xl bg-(--color-brand-blue) py-2.5 text-[13.5px] font-bold text-white">
                この条件で検索
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
