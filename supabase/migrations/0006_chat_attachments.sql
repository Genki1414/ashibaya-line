-- ── チャット添付（写真・ファイル） ─────────────────────────────────────
-- messages に添付メタデータを持たせ、実体は Storage バケット chat-files に保存する。
-- 実体アクセスはすべてサーバー（service_role）が仲介し、関係者判定はアプリ層で行う
-- ため、storage.objects への公開ポリシーは付けない（バケットは非公開）。
-- 何度実行しても安全なように IF NOT EXISTS / ON CONFLICT を使う。

alter table messages add column if not exists attachment_path text;
alter table messages add column if not exists attachment_name text;
alter table messages add column if not exists attachment_type text;
alter table messages add column if not exists attachment_size bigint;

-- チャット添付用の非公開バケット（Supabase Storage）。
insert into storage.buckets (id, name, public)
values ('chat-files', 'chat-files', false)
on conflict (id) do nothing;
