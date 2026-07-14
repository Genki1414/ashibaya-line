-- 案件検索・絞り込みのための正規化列を projects に追加し、既存行を backfill する。
-- 方針:
--  * 検索の正本は prefecture / city（region は表示互換・旧データ互換で残す）。
--  * 追加列はすべて region / state(jsonb) から機械的に導出できる（べき等）。
--  * 自動分割できなかった行は prefecture を空(null)のままにして Admin で「要修正」確認する。

alter table projects add column if not exists prefecture   text;
alter table projects add column if not exists city         text;
alter table projects add column if not exists starts_on    date;
alter table projects add column if not exists ends_on      date;
alter table projects add column if not exists has_assembly boolean;
alter table projects add column if not exists has_dismantle boolean;

-- ── backfill：region を都道府県／市区町村に分割（未設定の行のみ） ──
-- 都道府県は「北海道」または「◯◯[都道府県]」（接頭2〜4字）を先頭一致で抽出。
update projects set
  prefecture = nullif(substring(region from '^(北海道|.{1,3}?[都道府県])'), ''),
  city = nullif(btrim(regexp_replace(region, '^(北海道|.{1,3}?[都道府県])', '')), '')
where prefecture is null and coalesce(region, '') <> '';

-- ── backfill：日付・フェーズ有無を state(jsonb) から導出 ──
update projects set
  starts_on = coalesce(starts_on, nullif(state->'overallSchedule'->>'plannedStart', '')::date),
  ends_on   = coalesce(ends_on,   nullif(state->'overallSchedule'->>'plannedEnd',   '')::date),
  has_assembly  = coalesce(has_assembly,  (job_type = 'contract' and nullif(state->'assemblySchedule'->>'plannedStart', '') is not null)),
  has_dismantle = coalesce(has_dismantle, (job_type = 'contract' and nullif(state->'dismantleSchedule'->>'plannedStart', '') is not null));

-- ── 絞り込み用インデックス ──
create index if not exists projects_prefecture_idx   on projects (prefecture);
create index if not exists projects_city_idx         on projects (city);
create index if not exists projects_job_type_idx     on projects (job_type);
create index if not exists projects_starts_on_idx    on projects (starts_on);
create index if not exists projects_ends_on_idx      on projects (ends_on);
create index if not exists projects_unit_price_idx   on projects (unit_price);
create index if not exists projects_deadline_idx     on projects (deadline);
