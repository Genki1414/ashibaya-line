-- 信用プラットフォーム 初期スキーマ
-- 対応: docs/ashiba_platform_仕様まとめ.md 4章（データモデル）
-- 方針: フェーズ(ph)・書類(order等)・タイムラインなど頻繁に形が変わる構造はjsonbで保持し、
--       集計・検索が必要な列（金額・ステータス・当事者ID等）のみ正規化する。

create extension if not exists "pgcrypto";

create table companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  region text not null,
  contact text not null,
  areas text[] not null default '{}',
  works text[] not null default '{}',
  registered date not null default current_date,
  verify jsonb not null default '{}'::jsonb,
  metrics jsonb not null default json_build_object(
    'completed', 0, 'paidCount', 0, 'onTimeCount', 0, 'lateCount', 0,
    'unpaid', 0, 'avgPayDays', 0, 'lastTrade', null, 'continuous', 0
  ),
  created_at timestamptz not null default now()
);

create table projects (
  id uuid primary key default gen_random_uuid(),
  prime_id uuid not null references companies(id),
  stage text not null default 'recruiting' check (stage in ('recruiting', 'matched')),
  name text not null,
  job_type text not null check (job_type in ('support', 'contract')),
  region text not null,
  address text not null,
  start_date date not null,
  end_date date not null,
  assembly_start date,
  assembly_end date,
  dismantle_start date,
  dismantle_end date,
  need int,
  price bigint not null,
  pay_type text not null check (pay_type in ('progress', 'lump')),
  closing text not null,
  payterm text not null,
  work text,
  belongings text,
  deadline date,
  guaranteed boolean not null default false,
  applicant_ids uuid[] not null default '{}',
  created_at timestamptz not null default now()
);

create table transactions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id),
  project_name text not null,
  job_type text not null check (job_type in ('support', 'contract')),
  region text not null,
  address text not null,
  start_date date not null,
  end_date date not null,
  assembly_start date,
  assembly_end date,
  dismantle_start date,
  dismantle_end date,
  need int,
  amount bigint not null,
  pay_type text not null check (pay_type in ('progress', 'lump')),
  assembly_amount bigint,
  dismantle_amount bigint,
  closing text not null,
  payterm text not null,
  prime_id uuid not null references companies(id),
  partner_id uuid not null references companies(id),
  guaranteed boolean not null default false,
  chat_key text not null,
  "order" jsonb,
  order_ack jsonb,
  status text check (status in ('completed')),
  ph_assembly jsonb not null default json_build_object(
    'work', 'waiting', 'startDate', null, 'endDate', null, 'sessions', '[]'::jsonb,
    'report', null, 'rework', null, 'bill', 'none', 'inv', null, 'pay', null, 'dep', null
  ),
  ph_dismantle jsonb not null default json_build_object(
    'work', 'waiting', 'startDate', null, 'endDate', null, 'sessions', '[]'::jsonb,
    'report', null, 'rework', null, 'bill', 'none', 'inv', null, 'pay', null, 'dep', null
  ),
  issues jsonb not null default '[]'::jsonb,
  consultations jsonb not null default '[]'::jsonb,
  ashibase jsonb not null default json_build_object('linked', false, 'at', null),
  schedule_notice jsonb,
  timeline jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table chats (
  key text primary key, -- `${project_id}:${company_id}`
  project_id uuid not null references projects(id),
  prime_id uuid not null references companies(id),
  partner_id uuid not null references companies(id),
  title text not null,
  created_at timestamptz not null default now()
);

create table chat_messages (
  id uuid primary key default gen_random_uuid(),
  chat_key text not null references chats(key) on delete cascade,
  sender_company_id uuid not null references companies(id),
  text text not null,
  created_at timestamptz not null default now()
);

create index on projects (prime_id);
create index on transactions (prime_id);
create index on transactions (partner_id);
create index on chat_messages (chat_key);

-- RLSは認証方式（LINEログイン等、仕様書9章「未実装」）の確定後に設計する。
alter table companies enable row level security;
alter table projects enable row level security;
alter table transactions enable row level security;
alter table chats enable row level security;
alter table chat_messages enable row level security;
