import { describe, expect, it } from "vitest";
import { CompanyId, ProjectId } from "../shared";
import { postProject, type Project } from "../project";
import {
  activeFilterCount,
  defaultFilter,
  filterToQuery,
  matchesProjectFilter,
  parseProjectFilter,
  periodsOverlap,
  projectPhases,
  sortProjects,
  type ProjectFilter,
} from "./index";

function make(over: Partial<{
  id: string; jobType: "support" | "contract"; prefecture: string; city: string;
  start: string; end: string; price: number; need: number | null; guaranteed: boolean;
  deadline: string; posted: string; primeId: string; stage: "recruiting" | "matched";
  assemblyStart: string | null; dismantleStart: string | null;
}> = {}): Project {
  const o = {
    id: "p1", jobType: "support" as const, prefecture: "宮城県", city: "仙台市青葉区",
    start: "2026-08-05", end: "2026-08-12", price: 20000, need: null as number | null, guaranteed: false,
    deadline: "2026-08-01", posted: "2026-07-01", primeId: "A", stage: "recruiting" as const,
    assemblyStart: null as string | null, dismantleStart: null as string | null, ...over,
  };
  const r = postProject({
    id: ProjectId(o.id), name: "現場" + o.id, jobType: o.jobType, prefecture: o.prefecture, city: o.city, address: "x",
    overallSchedule: { plannedStart: o.start, plannedEnd: o.end },
    assemblySchedule: { plannedStart: o.assemblyStart ?? o.start, plannedEnd: o.end },
    dismantleSchedule: { plannedStart: o.dismantleStart, plannedEnd: o.dismantleStart },
    need: o.need, unitPrice: o.price, payType: "progress", closing: "末", payTerm: "翌月末",
    workDescription: "", belongings: "", applicationDeadline: o.deadline, postedAt: o.posted,
    guaranteed: o.guaranteed, primeId: CompanyId(o.primeId),
  });
  if (!r.ok) throw r.error;
  return o.stage === "matched" ? { ...r.value, stage: "matched" } : r.value;
}

const today = "2026-07-15";
const approved = new Set(["A", "B"]);
const ctx = { today, approvedPrimeIds: approved };
const base = (over: Partial<ProjectFilter> = {}): ProjectFilter => ({ ...defaultFilter(), ...over });

describe("parseProjectFilter / filterToQuery", () => {
  it("既定は募集中・締切前・本部承認・新着順", () => {
    const f = parseProjectFilter({});
    expect(f.recruitingOnly).toBe(true);
    expect(f.includeEnded).toBe(false);
    expect(f.primeApproved).toBe(true);
    expect(f.sort).toBe("new");
  });
  it("URLクエリと相互変換できる（往復）", () => {
    const f = base({ prefecture: "宮城県", city: "仙台市", jobType: "contract", phase: "both", amountMin: 100000, need: "3plus", guaranteed: true, sort: "amountDesc" });
    expect(parseProjectFilter(Object.fromEntries(new URLSearchParams(filterToQuery(f))))).toEqual(f);
  });
  it("activeFilterCount は既定からの変更数を数える", () => {
    expect(activeFilterCount(defaultFilter())).toBe(0);
    expect(activeFilterCount(base({ prefecture: "宮城県", guaranteed: true }))).toBe(2);
  });
});

describe("matchesProjectFilter", () => {
  it("初期条件：募集終了（締切超過）・選定済みは除外", () => {
    expect(matchesProjectFilter(make({ deadline: "2026-07-10" }), defaultFilter(), ctx)).toBe(false); // 締切超過
    expect(matchesProjectFilter(make({ stage: "matched" }), defaultFilter(), ctx)).toBe(false);
    expect(matchesProjectFilter(make(), defaultFilter(), ctx)).toBe(true);
  });
  it("本部承認済みの元請のみ（初期）", () => {
    expect(matchesProjectFilter(make({ primeId: "Z" }), defaultFilter(), ctx)).toBe(false);
    expect(matchesProjectFilter(make({ primeId: "A" }), defaultFilter(), ctx)).toBe(true);
    // primeApproved を外せば非承認元請も出る
    expect(matchesProjectFilter(make({ primeId: "Z" }), base({ primeApproved: false }), ctx)).toBe(true);
  });
  it("都道府県一致・市区町村は部分一致（区を含む）", () => {
    expect(matchesProjectFilter(make(), base({ city: "仙台市" }), ctx)).toBe(true); // 仙台市青葉区 に部分一致
    expect(matchesProjectFilter(make(), base({ city: "名取市" }), ctx)).toBe(false);
    expect(matchesProjectFilter(make(), base({ prefecture: "東京都" }), ctx)).toBe(false);
  });
  it("募集人数：null は指定時に除外、3名以上は>=3", () => {
    expect(matchesProjectFilter(make({ need: null }), base({ need: "1" }), ctx)).toBe(false);
    expect(matchesProjectFilter(make({ need: 1 }), base({ need: "1" }), ctx)).toBe(true);
    expect(matchesProjectFilter(make({ need: 5 }), base({ need: "3plus" }), ctx)).toBe(true);
    expect(matchesProjectFilter(make({ need: 2 }), base({ need: "3plus" }), ctx)).toBe(false);
    expect(matchesProjectFilter(make({ need: null }), defaultFilter(), ctx)).toBe(true); // 指定なしなら出る
  });
  it("組立/解体：請負のみ分類、応援は分類されない", () => {
    const contractBoth = make({ jobType: "contract", assemblyStart: "2026-08-05", dismantleStart: "2026-08-10" });
    expect(matchesProjectFilter(contractBoth, base({ phase: "both" }), ctx)).toBe(true);
    expect(matchesProjectFilter(contractBoth, base({ phase: "assembly" }), ctx)).toBe(false);
    const support = make({ jobType: "support" });
    expect(projectPhases(support)).toEqual({ assembly: false, dismantle: false });
    expect(matchesProjectFilter(support, base({ phase: "assembly" }), ctx)).toBe(false);
  });
  it("希望期間と案件工期が重なるものを表示", () => {
    const p = make({ start: "2026-08-05", end: "2026-08-12" });
    expect(matchesProjectFilter(p, base({ periodStart: "2026-08-01", periodEnd: "2026-08-10" }), ctx)).toBe(true);
    expect(matchesProjectFilter(p, base({ periodStart: "2026-08-13", periodEnd: "2026-08-20" }), ctx)).toBe(false);
  });
  it("金額の下限・上限", () => {
    expect(matchesProjectFilter(make({ price: 20000 }), base({ amountMin: 25000 }), ctx)).toBe(false);
    expect(matchesProjectFilter(make({ price: 30000 }), base({ amountMin: 25000, amountMax: 40000 }), ctx)).toBe(true);
  });
});

describe("periodsOverlap", () => {
  it("工期不明は対象外、片側openは無限扱い", () => {
    expect(periodsOverlap(null, "2026-08-10", "2026-08-01", "2026-08-05")).toBe(false);
    expect(periodsOverlap("2026-08-05", "2026-08-12", "2026-08-01", null)).toBe(true);
    expect(periodsOverlap("2026-08-05", "2026-08-12", null, "2026-08-01")).toBe(false);
  });
});

describe("sortProjects", () => {
  it("金額が高い順・新着順・開始が近い順", () => {
    const a = make({ id: "a", price: 10000, start: "2026-09-01", posted: "2026-07-01" });
    const b = make({ id: "b", price: 30000, start: "2026-08-01", posted: "2026-07-10" });
    expect(sortProjects([a, b], "amountDesc").map((p) => p.id)).toEqual(["b", "a"]);
    expect(sortProjects([a, b], "new").map((p) => p.id)).toEqual(["b", "a"]);
    expect(sortProjects([a, b], "startSoon").map((p) => p.id)).toEqual(["b", "a"]);
  });
});
