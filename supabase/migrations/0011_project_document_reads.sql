-- 案件資料の「新着」判定用の既読マーカー（会社×案件ごとに最後に閲覧した時刻）。
-- 資料が追加されると、応募会社（選定前）・選定会社（取引成立後）に「新しい案件資料」通知を出し、
-- その会社が案件詳細/取引詳細で資料を見た時点で last_seen_at を更新して通知を消す。
-- アクセスはサーバ(service_role)が仲介するため、認証ユーザー向けポリシーは付けない。

create table if not exists project_document_reads (
  company_id   text not null references companies(id) on delete cascade,
  project_id   text not null references projects(id) on delete cascade,
  last_seen_at timestamptz not null default now(),
  primary key (company_id, project_id)
);

alter table project_document_reads enable row level security;
