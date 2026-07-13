-- セルフサインアップ＋承認モデル（Phase 1.5）
-- 方針:
--  ・会社は自己登録後すぐ利用可（ログイン・プロフィール）。発注・受注は本部承認後。
--  ・status: 'pending'(承認待ち) → 'active'(本部承認・発注受注可) / 'suspended'(停止)
--  ・status を含む会社レコードの変更は本人が行えないよう、authenticated からの UPDATE 権限を剥奪。
--    会社の作成・承認・プロフィール編集はすべてサーバー側（service_role）の管理処理経由にする。

alter table public.companies
  add column if not exists status text not null default 'pending'
    check (status in ('pending', 'active', 'suspended')),
  add column if not exists approved_at timestamptz;

-- 既存行（開発時のみ想定・本番は空）は active 扱いにしておく。
update public.companies set status = 'active' where status = 'pending' and created_at < now();

-- 会社テーブルへの authenticated の直接 UPDATE を禁止（status 自己書き換え等を防ぐ）。
-- 参照(SELECT)は公開読み取りのまま。書き込みは service_role のサーバー処理のみ。
revoke update on public.companies from authenticated;
