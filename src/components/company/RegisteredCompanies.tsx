"use client";

import { useState } from "react";
import { LevelBadge, MiniStat, VerifyBadges } from "./parts";

export interface CompanyCard {
  id: string;
  name: string;
  region: string;
  works: string;
  level: string;
  completed: number;
  onTimeCount: number;
  lateCount: number;
  continuous: number;
  verify: Record<string, string>;
  isSelf: boolean;
}

const LEVEL_ORDER: Record<string, number> = { platinum: 5, gold: 4, silver: 3, bronze: 2, unverified: 1 };

export function RegisteredCompanies({ companies }: { companies: CompanyCard[] }) {
  const [sort, setSort] = useState<"level" | "completed">("level");
  const sorted = [...companies].sort((a, b) =>
    sort === "level" ? (LEVEL_ORDER[b.level] ?? 0) - (LEVEL_ORDER[a.level] ?? 0) : b.completed - a.completed,
  );

  return (
    <div>
      <div className="mb-3.5 rounded-2xl border border-(--color-brand-blue-light) bg-(--color-brand-blue-soft) p-3 text-[12px] leading-relaxed text-(--color-brand-sub)">
        各社の信用レベル・支払い実績・認証は公開情報です。個別取引の中身（金額や現場）は関係者しか見られません。
      </div>
      <div className="mb-3.5 flex gap-2">
        {([["level", "信用レベル順"], ["completed", "取引件数順"]] as const).map(([k, l]) => (
          <button
            key={k}
            onClick={() => setSort(k)}
            className="rounded-full px-3.5 py-1.5 text-[12.5px] font-bold"
            style={{
              border: `1px solid ${sort === k ? "var(--color-brand-blue)" : "var(--color-brand-line)"}`,
              background: sort === k ? "var(--color-brand-blue)" : "#fff",
              color: sort === k ? "#fff" : "var(--color-brand-sub)",
            }}
          >
            {l}
          </button>
        ))}
      </div>
      {sorted.map((c) => (
        <div
          key={c.id}
          className="mb-3 rounded-2xl border bg-white p-3.5"
          style={{ borderColor: c.isSelf ? "var(--color-brand-blue)" : "var(--color-brand-line)" }}
        >
          <div className="mb-2.5 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-(--color-brand-blue) text-[18px] font-black text-white">{c.name.slice(0, 1)}</div>
            <div className="flex-1">
              <div className="flex items-center gap-1.5">
                <span className="text-[14.5px] font-bold text-(--color-brand-ink)">{c.name}</span>
                {c.isSelf && <span className="rounded-full bg-(--color-brand-blue-light) px-1.5 py-0.5 text-[10px] font-bold text-(--color-brand-blue)">自社</span>}
              </div>
              <div className="text-[11.5px] text-(--color-brand-sub)">{[c.region, c.works].filter(Boolean).join(" ・ ")}</div>
            </div>
            <LevelBadge level={c.level} />
          </div>
          <div className="mb-2.5 flex gap-3">
            <MiniStat n={c.completed} label="取引完了" />
            <MiniStat n={c.onTimeCount} label="期日内支払い" />
            <MiniStat n={c.lateCount} label="遅延" red={c.lateCount > 0} />
            <MiniStat n={c.continuous} label="継続取引" />
          </div>
          <VerifyBadges verify={c.verify} />
        </div>
      ))}
    </div>
  );
}
