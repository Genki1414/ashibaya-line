import type { Project } from "../project";

/** 47都道府県（検索の都道府県セレクト用）。 */
export const PREFECTURES = [
  "北海道", "青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県",
  "茨城県", "栃木県", "群馬県", "埼玉県", "千葉県", "東京都", "神奈川県",
  "新潟県", "富山県", "石川県", "福井県", "山梨県", "長野県", "岐阜県",
  "静岡県", "愛知県", "三重県", "滋賀県", "京都府", "大阪府", "兵庫県",
  "奈良県", "和歌山県", "鳥取県", "島根県", "岡山県", "広島県", "山口県",
  "徳島県", "香川県", "愛媛県", "高知県", "福岡県", "佐賀県", "長崎県",
  "熊本県", "大分県", "宮崎県", "鹿児島県", "沖縄県",
] as const;

export type ProjectSort = "new" | "startSoon" | "amountDesc";
export type PhaseFilter = "assembly" | "dismantle" | "both";
export type NeedFilter = "1" | "2" | "3plus";

/** 案件検索の条件（URLクエリに保存する正本）。 */
export interface ProjectFilter {
  prefecture: string | null;
  /** 市区町村（部分一致：「仙台市」で「仙台市青葉区」もヒット）。 */
  city: string | null;
  jobType: "support" | "contract" | null;
  /** 組立のみ / 解体のみ / 組立＋解体。指定なしは null（＝応援などは案件種別で検索）。 */
  phase: PhaseFilter | null;
  /** 希望期間（案件工期と重なるものを表示）。 */
  periodStart: string | null;
  periodEnd: string | null;
  amountMin: number | null;
  amountMax: number | null;
  need: NeedFilter | null;
  /** 売掛保証対象のみ。 */
  guaranteed: boolean;
  /** 募集中のみ（既定 true）。 */
  recruitingOnly: boolean;
  /** 募集終了（締切超過）を含める（既定 false＝除外）。 */
  includeEnded: boolean;
  /** 本部承認済みの元請のみ（既定 true）。将来の「会社認証済みのみ」は別フラグで追加予定。 */
  primeApproved: boolean;
  sort: ProjectSort;
}

/** 何も指定しない初期状態（初期表示：募集中・締切前・本部承認済み・新着順）。 */
export function defaultFilter(): ProjectFilter {
  return {
    prefecture: null, city: null, jobType: null, phase: null,
    periodStart: null, periodEnd: null, amountMin: null, amountMax: null,
    need: null, guaranteed: false, recruitingOnly: true, includeEnded: false,
    primeApproved: true, sort: "new",
  };
}

type Params = Record<string, string | string[] | undefined>;
const one = (p: Params, k: string): string | null => {
  const v = p[k];
  const s = Array.isArray(v) ? v[0] : v;
  const t = (s ?? "").trim();
  return t === "" ? null : t;
};
const numOr = (p: Params, k: string): number | null => {
  const s = one(p, k);
  if (s == null) return null;
  const n = Number(s.replace(/[^\d]/g, ""));
  return Number.isFinite(n) && s.replace(/[^\d]/g, "") !== "" ? n : null;
};
const boolFlag = (p: Params, k: string, dflt: boolean): boolean => {
  const s = one(p, k);
  if (s == null) return dflt;
  return s === "1" || s === "true";
};

/** URLクエリ（searchParams）→ ProjectFilter。未指定は既定値。 */
export function parseProjectFilter(p: Params): ProjectFilter {
  const jt = one(p, "job");
  const ph = one(p, "phase");
  const nd = one(p, "need");
  const st = one(p, "sort");
  return {
    prefecture: one(p, "pref"),
    city: one(p, "city"),
    jobType: jt === "support" || jt === "contract" ? jt : null,
    phase: ph === "assembly" || ph === "dismantle" || ph === "both" ? ph : null,
    periodStart: one(p, "ps"),
    periodEnd: one(p, "pe"),
    amountMin: numOr(p, "min"),
    amountMax: numOr(p, "max"),
    need: nd === "1" || nd === "2" || nd === "3plus" ? nd : null,
    guaranteed: boolFlag(p, "grt", false),
    recruitingOnly: boolFlag(p, "rec", true),
    includeEnded: boolFlag(p, "end", false),
    primeApproved: boolFlag(p, "apr", true),
    sort: st === "startSoon" || st === "amountDesc" ? st : "new",
  };
}

/** ProjectFilter → URLクエリ文字列（既定値は省略して短く保つ）。 */
export function filterToQuery(f: ProjectFilter): string {
  const q = new URLSearchParams();
  if (f.prefecture) q.set("pref", f.prefecture);
  if (f.city) q.set("city", f.city);
  if (f.jobType) q.set("job", f.jobType);
  if (f.phase) q.set("phase", f.phase);
  if (f.periodStart) q.set("ps", f.periodStart);
  if (f.periodEnd) q.set("pe", f.periodEnd);
  if (f.amountMin != null) q.set("min", String(f.amountMin));
  if (f.amountMax != null) q.set("max", String(f.amountMax));
  if (f.need) q.set("need", f.need);
  if (f.guaranteed) q.set("grt", "1");
  if (!f.recruitingOnly) q.set("rec", "0");
  if (f.includeEnded) q.set("end", "1");
  if (!f.primeApproved) q.set("apr", "0");
  if (f.sort !== "new") q.set("sort", f.sort);
  return q.toString();
}

/** 既定から変更された絞り込みの数（バッジ表示用。並び順・既定トグルは数えない）。 */
export function activeFilterCount(f: ProjectFilter): number {
  let n = 0;
  if (f.prefecture) n++;
  if (f.city) n++;
  if (f.jobType) n++;
  if (f.phase) n++;
  if (f.periodStart || f.periodEnd) n++;
  if (f.amountMin != null || f.amountMax != null) n++;
  if (f.need) n++;
  if (f.guaranteed) n++;
  if (!f.recruitingOnly) n++;
  if (f.includeEnded) n++;
  if (!f.primeApproved) n++;
  return n;
}

/** 案件が組立/解体フェーズを持つか（応援＝単一フェーズは分類せず false）。mapper と同一規則。 */
export function projectPhases(p: Pick<Project, "jobType" | "assemblySchedule" | "dismantleSchedule">): { assembly: boolean; dismantle: boolean } {
  if (p.jobType !== "contract") return { assembly: false, dismantle: false };
  return {
    assembly: p.assemblySchedule.plannedStart != null,
    dismantle: p.dismantleSchedule.plannedStart != null,
  };
}

/** 期間 [aStart,aEnd] と [bStart,bEnd] が重なるか。片側 open（null）は無限として扱う。 */
export function periodsOverlap(aStart: string | null, aEnd: string | null, bStart: string | null, bEnd: string | null): boolean {
  if (aStart == null || aEnd == null) return false; // 案件工期が不明なら期間検索の対象外
  if (bStart != null && aEnd < bStart) return false;
  if (bEnd != null && aStart > bEnd) return false;
  return true;
}

export interface MatchContext {
  readonly today: string;
  /** 本部承認済み会社ID集合（primeApproved フィルタ用）。省略時は承認判定をスキップしない＝全て非承認扱い。 */
  readonly approvedPrimeIds?: ReadonlySet<string>;
}

/**
 * 案件がフィルタに合致するか（純粋述語。テストとクライアント安全網に使用）。
 * サーバ検索は同じ条件を Supabase クエリに落として DB 側で絞り込む。
 */
export function matchesProjectFilter(p: Project, f: ProjectFilter, ctx: MatchContext): boolean {
  if (f.recruitingOnly && p.stage !== "recruiting") return false;
  if (!f.includeEnded && p.applicationDeadline < ctx.today) return false;
  if (f.jobType && p.jobType !== f.jobType) return false;
  if (f.prefecture && p.prefecture !== f.prefecture) return false;
  if (f.city && !p.city.includes(f.city)) return false;
  if (f.phase) {
    const ph = projectPhases(p);
    if (f.phase === "assembly" && !(ph.assembly && !ph.dismantle)) return false;
    if (f.phase === "dismantle" && !(!ph.assembly && ph.dismantle)) return false;
    if (f.phase === "both" && !(ph.assembly && ph.dismantle)) return false;
  }
  if (f.periodStart || f.periodEnd) {
    if (!periodsOverlap(p.overallSchedule.plannedStart, p.overallSchedule.plannedEnd, f.periodStart, f.periodEnd)) return false;
  }
  if (f.amountMin != null && p.unitPrice < f.amountMin) return false;
  if (f.amountMax != null && p.unitPrice > f.amountMax) return false;
  if (f.need) {
    if (p.need == null) return false; // 未設定は件数フィルタの対象外
    if (f.need === "1" && p.need !== 1) return false;
    if (f.need === "2" && p.need !== 2) return false;
    if (f.need === "3plus" && p.need < 3) return false;
  }
  if (f.guaranteed && !p.guaranteed) return false;
  if (f.primeApproved) {
    if (!ctx.approvedPrimeIds || !ctx.approvedPrimeIds.has(p.primeId as unknown as string)) return false;
  }
  return true;
}

/** 並び替え（新着＝投稿日降順、開始日が近い順、金額が高い順）。 */
export function sortProjects<T extends Project>(list: readonly T[], sort: ProjectSort): T[] {
  const arr = [...list];
  if (sort === "amountDesc") {
    arr.sort((a, b) => b.unitPrice - a.unitPrice);
  } else if (sort === "startSoon") {
    arr.sort((a, b) => {
      const as = a.overallSchedule.plannedStart;
      const bs = b.overallSchedule.plannedStart;
      if (as == null && bs == null) return 0;
      if (as == null) return 1; // 未定は後ろ
      if (bs == null) return -1;
      return as < bs ? -1 : as > bs ? 1 : 0;
    });
  } else {
    arr.sort((a, b) => (a.postedAt < b.postedAt ? 1 : a.postedAt > b.postedAt ? -1 : 0));
  }
  return arr;
}
