-- Web Push（PWAプッシュ通知）の購読情報。ブラウザ/端末ごとに1レコード（endpoint が一意）。
-- 会社ID・ユーザーIDに紐づけ、通知対象の会社へ配信する。
-- アクセスはサーバ(service_role)が仲介するため、認証ユーザー向けポリシーは付けない（RLSで既定拒否）。

create table if not exists push_subscriptions (
  endpoint     text primary key,          -- プッシュサービスのエンドポイント（端末×ブラウザで一意）
  company_id   text references companies(id) on delete cascade,
  auth_user_id uuid,                       -- 購読したユーザー（任意）
  p256dh       text not null,              -- 公開鍵（クライアント公開鍵）
  auth         text not null,              -- 認証シークレット
  user_agent   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists push_subscriptions_company_idx on push_subscriptions (company_id);

alter table push_subscriptions enable row level security;
-- INSERT/SELECT/UPDATE/DELETE ポリシーは作らない＝認証ユーザーは直接操作不可。
-- 読み書きは service_role（RLSバイパス）経由のサーバ処理のみ。
