-- 認証接続の追補（Phase 1）
-- 方針:
--  ・ログイン必須。匿名(anon)ロールにはテーブル権限を与えない（未ログインでは何も読めない）。
--  ・authenticated ロールにテーブル権限を付与し、行レベルの可否は 0002 の RLS で制御する。
--  ・本部管理者(app_metadata.is_admin=true)は RLS を通過（0002 の auth_is_admin）。会社/メンバーの
--    作成はサーバー側の service_role（BYPASSRLS）で行う。
--  ・秘密鍵はクライアントに出さない（service_role はサーバー専用）。

-- スキーマ利用権限（Supabaseの既定に加え明示）
grant usage on schema public to authenticated;

-- 公開読み取り（ログインユーザー内での公開）：会社の信用情報・案件一覧
grant select on public.companies to authenticated;
grant select on public.projects  to authenticated;

-- 会社は自社のみ更新可（行の可否は RLS）。案件は元請が投稿/更新（行の可否は RLS）。
grant update on public.companies to authenticated;
grant insert, update on public.projects to authenticated;

-- 関係者限定データ：取引・チャット・メッセージ・イベント・会社メンバー（行の可否は RLS）
grant select, insert, update on public.transactions  to authenticated;
grant select, insert, update on public.chats          to authenticated;
grant select, insert          on public.messages       to authenticated;
grant select, insert          on public.domain_events  to authenticated;
grant select                  on public.company_users  to authenticated;

-- RLS ヘルパー関数の実行権限
grant execute on function public.current_company_ids() to authenticated;
grant execute on function public.auth_is_admin()       to authenticated;

-- 明示的に anon からは剥奪（未ログインでのデータアクセスを禁止）
revoke all on public.companies, public.projects, public.transactions,
  public.chats, public.messages, public.domain_events, public.company_users from anon;

-- ─────────────────────────────────────────────────────────────────────
-- 本部管理者ブートストラップ（初回のみ・手動）
-- Supabase Dashboard → Authentication → Users → Add user でメール+パスワードを作成後、
-- 下記で管理者フラグを付与する（メールは実際の管理者アドレスに置換）。
--   update auth.users
--     set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"is_admin": true}'::jsonb
--   where email = 'admin@example.com';
-- 反映には対象ユーザーの再ログイン（新しいJWT発行）が必要。
-- ─────────────────────────────────────────────────────────────────────
