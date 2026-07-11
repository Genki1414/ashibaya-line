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
npm test   # src/domain のドメインロジックのユニットテスト（vitest）
```

`supabase/migrations/0001_init.sql` が初期スキーマ（companies / projects / transactions / chats）。
認証方式（LINEログイン等）確定後にRLSポリシーを設計する。

## ディレクトリ

- `src/domain/` — UIに依存しない純粋なドメイン層（DDD）。取引エンジン（独立二相モデル）の本体はここ。詳細は下記
- `src/app/(tabs)/` — 下部ナビ5タブ（ホーム・案件・取引・パートナー・自社）。まだ `src/domain` には未接続
- `src/types/domain.ts` — 仕様書4章のデータモデルに対応する型定義（永続化・UI向けDTO。`src/domain` の集約とは別物）
- `src/lib/theme.ts` — 青×白のブランドカラー（`docs/ashiba_platform_v8.jsx` の `T` に対応）
- `src/lib/supabase/` — ブラウザ / サーバー / ミドルウェア用Supabaseクライアント

### `src/domain`（ドメイン層）

各集約・値オブジェクトの責務を分離し、状態遷移は純粋なTypeScript関数（`Result` を返す）として実装。
UI（React/Next.js）には一切依存しない。`src/domain/index.ts` から名前空間つきで re-export しているので、
`import { transaction, billing } from "@/domain"` のように使う（`billing.submitInvoice` と `transaction.submitInvoice` のように
同名の関数が層ごとにあるため、フラットな re-export はしていない）。

- `shared/` — 共通基盤。`Result`/`DomainError`、ブランド付きID、`IsoDate`+`Clock`、`Money`、`DomainEvent`
- `credit/` — 信用レベル判定（運営管理から変更できるポリシーとして注入可能）、確認できる事実パネル、取引完了時のmetrics更新
- `order/` — 注文書・注文請書の発行/受諾
- `work/` — 作業トラック（waiting→working→reported→(rework)→confirmed）
- `billing/` — 請求トラック（none→invoiced→checked→paid→deposited）。Invoice/Payment/Deposit は値オブジェクト
- `transaction/` — Transaction集約ルート。組立/解体フェーズの合成、独立二相の不変条件（解体作業は組立作業confirmedのみが条件）、
  ロールごとの操作権限ガード、完了判定とTransactionCompletedイベントの発行、UI/通知向けの読み取りモデル（`nextHint`など）
- `project/` — Project集約（募集〜応募）
- `matching/` — Project集約とTransaction集約をまたぐドメインサービス（応募者選定→取引開始）
- `ashibase/` `notification/` `guarantee/` — AshiBase連携・LINE通知・保証会社連携の将来接続用ポート（インターフェースのみ、実装は未接続）

Next.js画面への接続（UI層からのコマンド呼び出し、永続化マッピング）は次のフェーズで行う。
