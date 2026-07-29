# Lait Divin OS V11

本格デザインのGitHub Pages対応版です。

## 最速で公開する方法
1. このZIPを解凍
2. GitHubリポジトリ直下の古いファイルを削除
3. 解凍した中身をすべてアップロード
4. 1〜3分後に `https://raruto2023-sketch.github.io/lait-divin-payroll/?v=11` を開く
5. 最初は「デモ画面を開く」で見た目と操作を確認

## Supabaseログイン
`config.js` は設定済みです。Supabase Authenticationでユーザーを作成するとログインできます。
管理者判定は `config.js` の `ADMIN_EMAIL` と一致するメールアドレスです。

## データについて
現時点の画面操作データはブラウザのlocalStorageに保存されます。まずデザイン・導線・入力画面をすぐ使える状態にしています。
Supabaseデータベースへ完全同期する場合は `sql/01_safe_setup.sql` を実行後、次の実装段階でAPI連携を追加できます。

## キャッシュ更新
表示が古い場合は `Ctrl + Shift + R` を押してください。
