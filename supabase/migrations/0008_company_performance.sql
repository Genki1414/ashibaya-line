-- 会社別「実績データ」（客観的事実の集計）のプロジェクション。
-- 信用レベル(credit)とは分離した独立テーブル。値はドメインの純粋 aggregator が
-- domain_events ＋ transactions から再計算して書き込む（利用者・管理者は直接編集しない）。
-- 書き込みは service_role のみ（RLSをバイパス）。認証ユーザーは閲覧のみ。
--
-- 冪等: 何度実行しても同じ結果。差分更新（関係2社の再計算）と全社再計算は一致する。

create table if not exists company_performance (
  company_id  text primary key references companies(id) on delete cascade,
  as_prime    jsonb not null default '{}'::jsonb,   -- 元請（発注側）実績
  as_partner  jsonb not null default '{}'::jsonb,   -- 協力会社（受注側）実績
  event_count int  not null default 0,              -- 集計に用いたイベント数（整合性チェック用）
  computed_at timestamptz not null default now()
);

alter table company_performance enable row level security;

-- 認証ユーザーは閲覧可（自社/他社プロフィール・案件詳細の元請信用情報で表示）。
drop policy if exists company_performance_read on company_performance;
create policy company_performance_read on company_performance
  for select to authenticated using (true);

-- INSERT/UPDATE/DELETE ポリシーは作らない＝認証ユーザーは書き込み不可。
-- 書き込みは service_role（RLSバイパス）による再計算のみ。
grant select on company_performance to authenticated;
