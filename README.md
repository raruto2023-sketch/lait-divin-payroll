# Lait Divin V8.1 Premium 1.1 — プロフィール編集

V8.1 Premium 1.0を土台に、従業員本人がプロフィールを編集できる機能を追加した版です。

## 追加機能
- プロフィール専用ページ
- アイコン画像の選択・自動軽量化
- 表示名
- Discord名
- ひとこと
- 自己紹介
- 保存直後にヘッダーへ反映

## 安全な導入順
1. Supabase SQL Editorで `sql/01_PROFILE_ADDON_SAFE.sql` を1回実行
2. GitHubの一番上へ `index.html`、`config.js`、`.nojekyll` を上書き
3. 反映後に `?v=8.1-premium-1.1` を付けて開く

SQLはprofilesテーブルへ列を追加するだけで、既存データを削除しません。

## 元に戻す場合
`backup/index.premium-1.0.html` を `index.html` に戻してください。追加されたDB列は残っても既存版の動作に影響しません。
