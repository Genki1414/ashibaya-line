# PWA プッシュ通知のセットアップ

このアプリは PWA（ホーム画面に追加）＋ Web Push 通知に対応しています。
プッシュ通知は **VAPID 鍵が設定されているときのみ有効**で、未設定でも画面は壊れず「未設定」と案内表示されます（graceful degradation）。

## 1. マイグレーションの適用

`supabase/migrations/0013_push_subscriptions.sql` を Supabase の SQL Editor で実行してください（購読情報の保存先テーブル。RLS 既定拒否＝サーバ経由のみ）。

## 2. VAPID 鍵の生成

ローカルで以下を実行すると鍵ペアが出ます（`web-push` は依存に含まれています）。

```bash
node -e "console.log(require('web-push').generateVAPIDKeys())"
```

出力例：

```json
{ "publicKey": "B...(87文字)", "privateKey": "...(43文字)" }
```

## 3. 環境変数（Vercel）

| 変数名 | 値 | 公開範囲 |
| --- | --- | --- |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | 上記 `publicKey` | クライアントに公開（公開鍵なので安全） |
| `VAPID_PRIVATE_KEY` | 上記 `privateKey` | **Secret（サーバのみ）**。絶対に公開しない |
| `VAPID_SUBJECT` | `mailto:運用担当のメール` | 任意（既定は `mailto:support@example.com`） |

設定後に **Redeploy** してください。`NEXT_PUBLIC_VAPID_PUBLIC_KEY` が無い間は、マイアカウント画面のプッシュ通知欄が「未設定」と表示されます。

## 4. 端末での有効化

1. 本番URL（HTTPS）を開く。iPhone は Safari の共有 → **「ホーム画面に追加」**（iOS 16.4 以降が必要）。
2. ホーム画面のアイコンから起動 →「マイアカウント」→「プッシュ通知」→ **通知をオンにする**。
3. 通知許可を承認 → **テスト通知** で受信を確認。

## 通知が飛ぶタイミング（サーバ側イベント）

- 案件に**応募**があった → 元請へ
- 協力会社が**選定**された → 選定された会社へ
- 案件**チャット**の新着 → 相手方へ

いずれもサーバのアクション内で `sendPushToCompany()` を呼びます。未設定・購読なしのときは何もしません（例外も投げません）。失効した購読（404/410）は自動削除されます。
