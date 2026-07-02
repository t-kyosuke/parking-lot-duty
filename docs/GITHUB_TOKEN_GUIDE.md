# GitHubトークンの安全化ガイド（塚原さん向け・作業約10分）

作成：2026-07-03（NEXT_ACTIONS A-3）。

## なぜやるか

「🌐 公開する」ボタンに使っているGitHubトークンは、いわば**合鍵**です。
今の鍵はもし漏れた場合に他のリポジトリまで触れてしまう可能性があるため、
**「当番アプリのリポジトリ（parking-lot-duty）だけに効く鍵」に作り替えます**。
アプリの動きは何も変わりません。

## 手順（新しい鍵を作る）

1. パソコンのブラウザで **github.com** にログイン
2. 右上の自分のアイコン → **Settings**（設定）
3. 左メニューを一番下までスクロール → **Developer settings**
4. **Personal access tokens** → **Fine-grained tokens** → 緑の **Generate new token**
5. 次のとおり設定：
   - **Token name**：`srs-duty-publish`（分かる名前なら何でもOK）
   - **Expiration**（有効期限）：**1年**（Custom で一番先の日付を選ぶ。切れたときの対処は下記）
   - **Repository access**：**Only select repositories** を選び、**parking-lot-duty** を選択
   - **Permissions** → **Repository permissions** → **Contents** を **Read and write** に
     （他の項目は触らない。Metadata が自動で Read になるのは正常）
6. 一番下の **Generate token** を押す
7. 表示された `github_pat_` で始まる長い文字列を**その場でコピー**
   （⚠️ この画面を閉じると二度と表示されません。閉じてしまったら作り直せばOK）

## 手順（アプリに新しい鍵をセットする）

8. 当番アプリ（ https://t-kyosuke.github.io/parking-lot-duty/ ）→ **🔒 管理者ログイン** → **⚙️ 設定**タブ
9. 「📡 GitHub連携」の入力欄に**コピーした新しいトークンを貼り付け → 保存**
   （今までの `ghp_` と違い `github_pat_` で始まりますが、それで正常です）
10. 「📋 当番割り当て」タブに戻り、**「🌐 公開する」を1回押して成功メッセージを確認**
    （数分後にスマホでも表示されればOK）

## 手順（古い鍵を無効にする）

11. GitHub の **Developer settings** → **Personal access tokens** に戻る
12. **Tokens (classic)** と **Fine-grained tokens** の両方を見て、今回作ったもの**以外**の
    古いトークンを **Delete / Revoke** で削除
    （⚠️ 手順10の「公開する」成功を確認してから削除すること）

## 有効期限が切れたら（1年後）

「公開する」を押したときに「Bad credentials」などのエラーで失敗するようになります。
壊れたわけではありません。**このガイドの手順1〜10をもう一度やって新しい鍵に貼り替えるだけ**で直ります。

## 注意（大事）

- トークンは**合鍵そのもの**です。LINE・メールに貼らない、人に見せない、
  アプリの設定欄以外の場所にメモしない
- もし誤って人に見せてしまったら、GitHub側でそのトークンを削除（Revoke）して作り直せば無効化できます
