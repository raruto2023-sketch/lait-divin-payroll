# Lait Divin OS V10.3

管理者画面と従業員画面を分けた、Lait Divin専用の店舗運営ポータルです。

## 入っている機能

- 管理者ログイン／従業員ログイン
- 管理者ダッシュボード
- 出勤・退勤と勤務履歴
- 従業員管理
- 売上・在庫・Farm管理
- 給与明細と履歴
- ランキング
- ダークモード
- スマホ最適化
- Supabaseオンライン同期

## GitHubへの入れ方

1. このZIPを解凍します。
2. GitHubリポジトリの一番上へ、中身を直接アップロードします。
3. `index.html` と `config.js` が同じ場所に並んでいれば正解です。
4. 公開後に次のURLを一度開きます。

   `https://raruto2023-sketch.github.io/lait-divin-payroll/?v=10.3`

## Supabase設定

`config.js`には現在のSupabase URLと公開キーを設定済みです。

初回のみSupabaseのSQL Editorで、次の順番に実行してください。

1. `sql/01_complete_setup.sql`
2. エラーや出勤権限の問題がある場合のみ `sql/02_attendance_rls_fix.sql`

## 注意

- `SUPABASE_ANON_KEY`はブラウザ公開用のキーです。
- `service_role`キーは絶対にGitHubへ置かないでください。
- 古い画面が表示される場合は `Ctrl + Shift + R` を押してください。
