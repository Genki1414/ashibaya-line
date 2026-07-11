-- 信用プラットフォーム 基本スキーマ（ドメイン層 src/domain に整合）
-- 方針（docs/ashiba_platform_接続指示.md §3）:
--   Transaction 集約は入れ子が深いので「1集約 = 1行のJSONBスナップショット(state)」で保存し、
--   一覧・タブ絞り込みに使う値だけ列に非正規化する。列は state から導出した複製で、
--   書き込みは集約の save 時に state と同時更新する（不整合を作らない）。
--
-- 注: 認証方式（LINEログイン）確定前の土台。ID列は text 主キー（ドメインの文字列IDと
--     そのまま対応させ、開発用シードで "A"/"B" 等の可読IDも許容する）。auth 連携は company_users。

create extension if not exists "pgcrypto";

-- ── 会社 ─────────────────────────────────────────────────────────────
-- verify / metrics の JSON 形状は src/domain/credit/types.ts に一致させる。
--   verify:  { phone,email,corp,rep,address,license,invoice,labor,liability,sole,qual,harness }
--            各値 'none'|'reviewing'|'verified'|'expired'|'rejected'
--   metrics: { completed,paidCount,onTimeCount,lateCount,avgPayDays,lastTrade,continuousPartnerIds[] }
create table companies (
  id text primary key,
  name text not null,
  region text not null,
  contact text not null default '',
  areas text[] not null default '{}',
  works text[] not null default '{}',
  registered date not null default current_date,
  verify jsonb not null default '{}'::jsonb,
  metrics jsonb not null default json_build_object(
    'completed', 0, 'paidCount', 0, 'onTimeCount', 0, 'lateCount', 0,
    'avgPayDays', 0, 'lastTrade', null, 'continuousPartnerIds', '[]'::jsonb
  ),
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- ── 案件（Project 集約） ─────────────────────────────────────────────
-- state に募集要項・日程・応募者などドメインの Project 全体を保持。列は絞り込み用の複製。
create table projects (
  id text primary key,
  prime_id text not null references companies(id),
  stage text not null default 'recruiting' check (stage in ('recruiting', 'matched')),
  name text not null,
  job_type text not null check (job_type in ('support', 'contract')),
  pay_type text not null check (pay_type in ('progress', 'lump')),
  region text not null default '',
  unit_price bigint not null default 0,
  need int,
  deadline date,
  posted date,
  guaranteed boolean not null default false,
  state jsonb not null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- ── 取引（Transaction 集約） ─────────────────────────────────────────
-- state にドメインの Transaction 全体（phases/order/issues/consultations/scheduleNotice など）を保持。
-- category は queries.category(tx) の導出値を非正規化（取引タブの絞り込み用）。
create table transactions (
  id text primary key,
  project_id text references projects(id),
  prime_id text not null references companies(id),
  partner_id text not null references companies(id),
  status text not null default 'in_progress' check (status in ('in_progress', 'completed')),
  category text not null default 'active'
    check (category in ('active', 'billing', 'rework', 'issue', 'completed')),
  job_type text not null check (job_type in ('support', 'contract')),
  pay_type text not null check (pay_type in ('progress', 'lump')),
  amount bigint not null default 0,
  assembly_amount bigint,
  dismantle_amount bigint,
  closing text not null,
  payterm text not null,
  chat_key text not null,
  state jsonb not null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- ── チャット（案件専用・応募〜取引で継続、key = "案件ID:会社ID"） ──────
create table chats (
  key text primary key,
  project_id text references projects(id),
  prime_id text not null references companies(id),
  partner_id text not null references companies(id),
  title text not null default '',
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table messages (
  id uuid primary key default gen_random_uuid(),
  chat_key text not null references chats(key) on delete cascade,
  sender_role text not null check (sender_role in ('prime', 'partner')),
  text text not null,
  created_at timestamptz not null default now()
);

-- ── ドメインイベント（監査 ＋ 信用タイムライン ＋ アウトボックス兼用） ──
-- aggregate_id は主に transactions.id。TransactionCompleted は集約あたり1件のみ（部分ユニーク索引）。
-- processed_at は信用実績プロセッサ（0002）の冪等化に使う。
create table domain_events (
  id uuid primary key default gen_random_uuid(),
  aggregate_id text not null,
  type text not null,
  payload jsonb not null default '{}'::jsonb,
  occurred_at date not null,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);

-- ── 認証ユーザー ↔ 会社（擬似ログイン切替もここ） ────────────────────
create table company_users (
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  company_id text not null references companies(id) on delete cascade,
  role text not null default 'member',
  created_at timestamptz not null default now(),
  primary key (auth_user_id, company_id)
);

-- ── インデックス ─────────────────────────────────────────────────────
create index on projects (prime_id);
create index on projects (stage);
create index on transactions (prime_id);
create index on transactions (partner_id);
create index on transactions (status);
create index on transactions (category);
create index on messages (chat_key);
create index on domain_events (aggregate_id);
create index on domain_events (type) where processed_at is null;
create index on company_users (company_id);

-- TransactionCompleted は取引ごとに1件だけ（信用実績の二重加算を索引レベルで防ぐ）。
create unique index one_completion_per_aggregate
  on domain_events (aggregate_id)
  where type = 'TransactionCompleted';
