-- 案件資料（図面・写真・書類）。チャット添付とは別管理。
-- 実体は非公開バケット project-docs に保存し、アクセスはすべてサーバ（service_role）が
-- tier（公開範囲）を検証してから署名付きURLを発行する。第三者は直接取得できない。
-- 何度実行しても安全なように IF NOT EXISTS / ON CONFLICT を使う。

-- ── 案件資料本体（論理削除前提） ──
create table if not exists project_documents (
  id            uuid primary key default gen_random_uuid(),
  project_id    text not null references projects(id) on delete cascade,
  storage_path  text not null,                       -- UUID採番で一意（同名でも上書きしない）
  file_name     text not null,
  mime_type     text not null default '',
  file_size     bigint not null default 0,
  file_hash     text,                                -- SHA-256(hex)。内容差し替えの判別用
  document_type text not null default 'other',
  visibility    text not null default 'viewer' check (visibility in ('viewer', 'applicant', 'selected')),
  description   text not null default '',
  sort_order    int  not null default 0,
  uploaded_by   text not null,                        -- 会社ID
  created_at    timestamptz not null default now(),
  deleted_at    timestamptz                           -- 論理削除
);
create index if not exists project_documents_project_idx on project_documents (project_id) where deleted_at is null;

-- ── 監査履歴（追加/削除/差し替え/公開範囲変更/説明変更/種別変更/並び替え/URL発行） ──
create table if not exists project_document_audit (
  id            uuid primary key default gen_random_uuid(),
  document_id   uuid,
  project_id    text not null,
  action        text not null,        -- add|delete|replace|visibility_change|description_change|type_change|reorder|url_issued
  actor_company text,
  actor_user    uuid,
  detail        jsonb not null default '{}'::jsonb,  -- 変更前/変更後など
  created_at    timestamptz not null default now()
);
create index if not exists project_document_audit_project_idx on project_document_audit (project_id);
create index if not exists project_document_audit_doc_idx on project_document_audit (document_id);

-- ── 取引成立時の資料スナップショット（証拠保全） ──
-- 案件側の資料が後から削除・変更されても、成立時点で選定会社が閲覧可能だった資料情報を保持する。
create table if not exists transaction_document_snapshots (
  id                   uuid primary key default gen_random_uuid(),
  transaction_id       text not null references transactions(id) on delete cascade,
  original_document_id uuid,                    -- 元の project_documents.id（後で削除されても値は残す）
  file_name            text not null,
  document_type        text not null,
  visibility           text not null,
  description          text not null default '',
  file_size            bigint not null default 0,
  mime_type            text not null default '',
  storage_path         text not null,           -- 成立時点の実体参照（論理削除しても実体は消さない）
  file_hash            text,
  doc_created_at       timestamptz,
  matched_at           date not null,           -- 取引成立日時（基準）
  was_visible          boolean not null default true,  -- 成立時点で当該会社が閲覧可能だった事実
  created_at           timestamptz not null default now(),
  unique (transaction_id, original_document_id)
);
create index if not exists tx_doc_snapshots_tx_idx on transaction_document_snapshots (transaction_id);

-- ── RLS：認証ユーザー向けポリシーは作らない＝サーバ(service_role)経由のみ ──
alter table project_documents enable row level security;
alter table project_document_audit enable row level security;
alter table transaction_document_snapshots enable row level security;

-- ── 非公開バケット ──
insert into storage.buckets (id, name, public)
values ('project-docs', 'project-docs', false)
on conflict (id) do nothing;
