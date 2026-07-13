-- ── チャット既読管理（未読件数・新着通知のため） ──────────────────────
-- (chat_key, company_id) ごとに最後に読んだ時刻を保持する。
-- 未読 = 自分以外が送信し、last_read_at より新しいメッセージ。

create table chat_reads (
  chat_key text not null references chats(key) on delete cascade,
  company_id text not null references companies(id),
  last_read_at timestamptz not null default now(),
  primary key (chat_key, company_id)
);

alter table chat_reads enable row level security;

-- 自社の既読レコードのみ読み書き可（本部管理者は全件可）。
create policy chat_reads_self on chat_reads
  for all
  using (company_id in (select current_company_ids()) or auth_is_admin())
  with check (company_id in (select current_company_ids()) or auth_is_admin());

grant select, insert, update, delete on chat_reads to authenticated;
revoke all on chat_reads from anon;

create index on chat_reads (company_id);
