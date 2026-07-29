# Lait Divin OS V10

Lait Divin専用の店舗運営ポータルです。

## 主な機能

- 従業員ログイン / 管理者ログイン
- ダッシュボード
- 出退勤管理
- 従業員管理
- 給与・ボーナス・給与明細
- 売上入力・ランキング
- 在庫管理
- Farm管理
- Supabase同期
- ダークモード
- スマホ対応
- PWA対応

## GitHub Pagesへの反映

1. このフォルダ内のファイルをGitHubリポジトリ直下へアップロードします。
2. GitHubの `Settings` → `Pages` を開きます。
3. `Deploy from a branch`、ブランチ `main`、フォルダ `/(root)` を選びます。
4. 数分後に公開URLを開きます。

## Supabase設定

`config.js` にSupabase URLと公開用Anon Keyが設定されています。
公開用Anon Keyはブラウザで使用するためのキーですが、Supabase側では必ずRLSを有効にしてください。

## 更新時の注意

PWAキャッシュで旧画面が表示される場合は、ブラウザの再読み込みを行うか、サイトデータを削除してください。

## バックアップ

`index.v8.1.backup.html` は更新前の画面です。通常の公開には不要ですが、復旧用として同梱しています。
