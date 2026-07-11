# ashibaya-line

足場会社向け 信用プラットフォーム。仕様の背景は [`docs/ashiba_platform_仕様まとめ.md`](docs/ashiba_platform_仕様まとめ.md)、
UI/業務ロジックの参照実装（単一ファイルReactプロトタイプ）は [`docs/ashiba_platform_v8.jsx`](docs/ashiba_platform_v8.jsx) を参照。

`ashibase-app`（足場資材管理ツール）とは別プロダクトで、将来的な連携先という位置づけ。

## 技術構成

- Next.js (App Router) + TypeScript + Tailwind CSS v4
- Supabase（`src/lib/supabase/`）

## セットアップ

```bash
npm install
cp .env.local.example .env.local  # Supabase / LINE の値を設定
npm run dev
```

`supabase/migrations/0001_init.sql` が初期スキーマ（companies / projects / transactions / chats）。
認証方式（LINEログイン等）確定後にRLSポリシーを設計する。

## ディレクトリ

- `src/app/(tabs)/` — 下部ナビ5タブ（ホーム・案件・取引・パートナー・自社）
- `src/types/domain.ts` — 仕様書4章のデータモデルに対応する型定義
- `src/lib/theme.ts` — 青×白のブランドカラー（`docs/ashiba_platform_v8.jsx` の `T` に対応）
- `src/lib/supabase/` — ブラウザ / サーバー / ミドルウェア用Supabaseクライアント
