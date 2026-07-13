# 実データ接続セットアップ（Phase 1：認証基盤）

このドキュメントは、トップ「/」プロトタイプの見た目・操作感を保ったまま、ドメイン層＋Server Actions＋Supabase へ実接続するための **Phase 1（認証）** の設定手順です。

## 前提
- Supabase プロジェクト作成済み
- マイグレーション適用済み：`0001_init.sql`（スキーマ）／`0002_rls_and_credit.sql`（RLS＋信用実績トリガー）

## 1. 追補マイグレーションの適用（0003）
SQL Editor で `supabase/migrations/0003_auth_grants.sql` を実行。
- `authenticated` ロールへテーブル/関数の権限を付与（行レベルの可否は RLS が制御）
- 匿名 `anon` からはデータ権限を剥奪（未ログインでは何も読めない）

## 2. 本部管理者（admin）のブートストラップ（初回のみ）
1. Supabase → **Authentication → Users → Add user** でメール＋パスワードを作成（Auto Confirm User を ON）
2. SQL Editor で管理者フラグを付与（メールは実際の管理者に置換）：
   ```sql
   update auth.users
     set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"is_admin": true}'::jsonb
   where email = 'admin@example.com';
   ```
3. 反映のため、この管理者は一度ログインし直す（新しい JWT が必要）

## 3. メール確認の設定（テストを簡単にするため）
Supabase → **Authentication → Providers → Email** で、開発中は **Confirm email を OFF**（本部管理者が発行したメンバーが即ログインできるようにする）。本番運用ポリシーは後で調整。

## 4. 環境変数の設定
### Vercel（Project → Settings → Environment Variables、Production & Preview）
| 変数 | 値 |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<project-ref>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Publishable key（`sb_publishable_...`） |
| `SUPABASE_SERVICE_ROLE_KEY` | Secret key（`sb_secret_...`）※ Sensitive |

設定後、**Redeploy**（環境変数を反映）。

### ローカル（`.env.local`、`.env.local.example` をコピー）
同じ3変数を設定。`.env.local` は Git 管理外。

## 5. 動作確認（Phase 1）
1. `/login` にアクセス → 本部管理者のメール＋パスワードでログイン → `/admin` へ遷移
2. `/admin` で **会社を作成** → 続けて **その会社のメンバー（email+password）を作成**
3. 別ブラウザ（またはシークレット）で、作成したメンバーのメール＋パスワードで `/login` → `/account` に **所属会社名**が表示される
4. リロードしても所属会社が保持される（＝ Supabase に保存されている）

これで「ログイン」「会社」「会社メンバー」「セッション」「現在の company_id 取得」が実データで動く状態になります。

## セキュリティ構成（確認）
- ブラウザに出るのは `NEXT_PUBLIC_SUPABASE_URL` と Publishable key のみ（RLS で保護）
- **Secret key はサーバー専用**（`src/lib/supabase/admin.ts` は `server-only`）。会社・メンバー作成などの特権操作のみで使用
- 未ログイン（anon）はデータにアクセス不可。関係者限定は RLS＋アプリ層の二重で担保
- 取引ごとの「元請／協力」は所属会社と取引当事者IDから自動判定（役割スイッチは開発デモ専用）

## 補足
- 本番（`NODE_ENV=production`）で Supabase 環境変数が無い場合、`/transactions` などの接続ルートは明示エラーになります（本番は Supabase 必須）。トップ「/」プロトタイプは環境変数なしでも表示されます。
- 開発ルート `/transactions` は当面デモ確認用として残置します。
