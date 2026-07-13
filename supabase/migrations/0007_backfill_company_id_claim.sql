-- 既存アカウントの app_metadata に所属会社ID(company_id)を後追いで埋め込む。
-- これにより getAuthContext が毎リクエストで company_users を引かずに済み、遷移が速くなる。
-- app_metadata は管理者のみ変更可能なため、JWTクレームとして信頼できる。
--
-- 注意:
--  * 反映は「次回のトークン更新／ログイン時に発行される新しいJWT」から。
--    既存セッションは既存のJWTを使い続けるため、最大でアクセストークン有効期限
--    （既定1時間）ほどでクレームに載る。その間はアプリ側がフォールバックで
--    company_users を参照するため動作に支障はない。
--  * べき等: 既に company_id を持つユーザーは対象外。何度実行しても安全。

update auth.users u
set raw_app_meta_data =
  coalesce(u.raw_app_meta_data, '{}'::jsonb)
  || jsonb_build_object('company_id', cu.company_id::text)
from public.company_users cu
where cu.auth_user_id = u.id
  and coalesce(u.raw_app_meta_data->>'company_id', '') = '';
