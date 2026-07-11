import { DomainError, IsoDate, Result, err, ok } from "../shared";

export type WorkStatus = "waiting" | "working" | "reported" | "rework" | "confirmed";

export interface WorkSession {
  readonly date: IsoDate;
  readonly kind: "start" | "end";
  readonly people: number | null;
  readonly note: string | null;
}

export interface WorkReport {
  readonly date: IsoDate;
  readonly days: number;
  readonly people: number | null;
  readonly content: string;
  readonly photoCount: number;
}

export interface ReworkRequest {
  readonly text: string;
  readonly requestedAt: IsoDate;
}

/**
 * 組立／解体、1フェーズ分の作業トラック。
 * waiting → working → reported →（rework）→ confirmed
 * ステータスは常にこのモジュール内の関数でのみ変化させる。
 */
export interface WorkTrack {
  readonly status: WorkStatus;
  readonly startDate: IsoDate | null;
  readonly endDate: IsoDate | null;
  readonly sessions: readonly WorkSession[];
  readonly report: WorkReport | null;
  readonly rework: ReworkRequest | null;
}

export const initialWorkTrack: WorkTrack = {
  status: "waiting",
  startDate: null,
  endDate: null,
  sessions: [],
  report: null,
  rework: null,
};

function invalidTransition(action: string, status: WorkStatus): DomainError {
  return new DomainError("WORK_INVALID_TRANSITION", `作業ステータスが「${status}」のため「${action}」はできません`);
}

export interface StartWorkInput {
  readonly date: IsoDate;
  readonly people: number | null;
}

export function start(track: WorkTrack, input: StartWorkInput): Result<WorkTrack> {
  if (track.status !== "waiting") return err(invalidTransition("作業開始", track.status));
  const session: WorkSession = { date: input.date, kind: "start", people: input.people, note: "作業開始" };
  return ok({ ...track, status: "working", startDate: input.date, sessions: [...track.sessions, session] });
}

export interface DailySessionInput {
  readonly date: IsoDate;
  readonly kind: "start" | "end";
  readonly people: number | null;
  readonly note: string | null;
}

/** 複数日工期の日次の作業開始／作業終了報告。ステータスは変えない。 */
export function recordDailySession(track: WorkTrack, input: DailySessionInput): Result<WorkTrack> {
  if (track.status !== "working") return err(invalidTransition("日次の作業報告", track.status));
  const session: WorkSession = { date: input.date, kind: input.kind, people: input.people, note: input.note };
  return ok({ ...track, sessions: [...track.sessions, session] });
}

export function reportCompletion(track: WorkTrack, report: WorkReport): Result<WorkTrack> {
  if (track.status !== "working") return err(invalidTransition("完了報告", track.status));
  return ok({ ...track, status: "reported", endDate: report.date, report });
}

export function confirm(track: WorkTrack): Result<WorkTrack> {
  if (track.status !== "reported") return err(invalidTransition("完了確認", track.status));
  return ok({ ...track, status: "confirmed" });
}

export function requestRework(track: WorkTrack, request: ReworkRequest): Result<WorkTrack> {
  if (track.status !== "reported") return err(invalidTransition("是正・手直し依頼", track.status));
  return ok({ ...track, status: "rework", rework: request });
}

/** 是正・手直し完了。元の rework 履歴は保持したまま reported へ戻り、再度確認/是正を受けられる。 */
export function completeRework(track: WorkTrack): Result<WorkTrack> {
  if (track.status !== "rework") return err(invalidTransition("是正・手直し完了", track.status));
  return ok({ ...track, status: "reported" });
}

/**
 * のべ作業日数（重複日除外）。日次報告がある複数日工期の完了報告で、日数入力を
 * 自動プリフィルするために使う参考値（仕様書v7）。単日案件は呼び出し側で手入力する。
 */
export function countWorkedDays(track: WorkTrack, completionDate: IsoDate): number {
  const dates = new Set(track.sessions.map((session) => session.date));
  dates.add(completionDate);
  return dates.size;
}
