# CLAUDE.md - SRS 駐車場当番アサイナー

プロジェクトの運用メモ。**作業前に必ず `PROGRESS.md`（最新セッション）を読んで現状を把握すること。**
全体像の引き継ぎは `docs/ai/HANDOFF.md`、詳細仕様は `docs/ai/SPEC.md`。

---

## ⚠️ ユーザーについて（最重要）

- オーナーは**エンジニアではない**（人材紹介の事業責任者・塚原さん）。
- **専門用語を使わず、わかりやすい日本語で**説明すること。
- コマンド実行前に**「何をするコマンドか」を1行で説明**してから実行すること。
  - ❌ `npm run build` → 実行　✅ 「アプリを本番用にまとめます」→ 実行
- エラーは「何が問題で、どう直すか」を平易な言葉で伝えること。

## ワークフロー

1. **計画ファースト**：3ステップ以上の作業や設計判断は、まず計画→確認→実装。詰まったら止まって立て直す
2. **確認してから完了**：テスト・実行結果で動くことを証明してから「完了」と言う
3. **シンプルさ優先**：変更は最小限。根本原因を直す。影響範囲を考える
4. **自己改善**：指摘を受けたら `tasks/lessons.md` に記録
5. **進捗の見える化**：作業後に `PROGRESS.md` を更新。コードを変えたら `docs/ai/CHANGELOG_AI.md` にも1行追記
6. **戻せることを最優先**：稼働中の仕組みを変えるときは、先に現仕様の記録＋復元ポイント（コミット/tag）を作る

---

## プロジェクト概要

吹田ラグビースクール（SRS）中3コーチ陣の「駐車場・ビデオ・カゴ当番」自動割り当てWebアプリ。
- 操作者は管理者（塚原さん）1人。コーチ陣はLINE共有URLから閲覧のみ
- 月末：調整さんCSVアップロード → 出欠確認 → 自動割り当て → LINEコピペ → 「公開する」でスマホ反映
- 本番：https://t-kyosuke.github.io/parking-lot-duty/ （リポジトリ `parking-lot-duty`）

## 技術スタック

- React 19 + TypeScript（Vite 8）、Vanilla CSS、Vitest、localStorage（バックエンドなし）
- デプロイ：main へ push → GitHub Actions で GitHub Pages へ自動デプロイ（`base: '/parking-lot-duty/'`）
- スマホ閲覧用データ：管理画面の「公開する」→ GitHub API で `data.json` を gh-pages ブランチへコミット
  → 閲覧側は raw.githubusercontent.com から取得

## コマンド

```bash
npm run dev      # 開発サーバー → http://localhost:5173/parking-lot-duty/
npm run test     # ユニットテスト（57件・全通過が正常）
npm run build    # 本番ビルド（型チェック込み）
npm run lint     # 指摘0件が正常（LINE用全角スペースは意図的として抑制済み）
```

## 重要ディレクトリ・ファイル

| 場所 | 内容 |
|------|------|
| `src/lib/assignParking.ts` | ★割り当てアルゴリズム（純粋関数・テスト対象・**聖域**） |
| `src/lib/parseCsv.ts` | 調整さんCSVパーサー |
| `src/lib/storage.ts` | localStorage 永続化＋マイグレーション |
| `src/lib/github.ts` | GitHub公開（「公開する」＝data.json を gh-pages へ）・トークン保持 |
| `src/lib/constants.ts` | **コーチ名簿（直書き）**・年間スケジュール（2026年度固定）・型 |
| `src/components/` | 画面10個（PublicView=閲覧／AdminView=管理 ほか） |
| `src/__tests__/` | テスト57件（assignParking 30・parseCsv 19・storage 8） |
| `docs/ai/HANDOFF.md` | ★引き継ぎ総まとめ（2026-07-05・現状の全体像と判断理由はここ） |
| `docs/ai/SPEC.md` | ★詳細仕様書（アルゴリズム・CSV・UI・LINE書式・localStorageキー） |
| `docs/ai/NEXT_ACTIONS.md` | 残タスクと優先順位（次の作業の入口） |
| `docs/ai/CHANGELOG_AI.md` | AI変更履歴の要約（詳細な経緯は PROGRESS.md） |
| `docs/ai/YEAR_ROLLOVER.md` | 2027年度更新の手順書（2027年2〜3月に実施） |
| `docs/GITHUB_TOKEN_GUIDE.md` | GitHubトークン再発行手順（2027年7月の期限切れ時） |
| `docs/DUTY_TROUBLE_GUIDE.md` | ★当番の困ったとき（練習中止・急な欠席）owner向け手順書（2026-08-03） |
| `docs/ai/FABLE_REVIEW.md` | 初回全体レビュー（2026-07-02。指摘S/A/Bは全対応済み＝当時の記録） |
| `PROGRESS.md` / `tasks/lessons.md` | セッション記録／学んだことルール |

## アルゴリズム要約（詳細は docs/ai/SPEC.md）

- 各枠（駐車場=日祝のみ／ビデオ=全日／カゴ=カゴ必要日）で「出席◯のうち**累計担当回数が最少**の人」を選ぶ
- 絞り込み順：出席◯ → 同日被り防止 → 月内上限2回 → 連続防止 →（候補0なら条件を緩める）→ 累計最少
- **カゴは駐車場/ビデオ確定後にその結果を読むだけの一方通行**（公平性を崩さない）。
  物理的に1個なので「前回◯∩今日◯」からバトンリレー（`assignKagoChain`）。候補0は「要確認」
- カゴの**表示だけ**は「その日の練習後に持ち帰る人＝次のカゴ利用日の担当」（`computeKagoTakeHome`）。
  カゴ連鎖導入前の旧データ月は自動フォールバック表示
- 累計は月またぎで引き継ぐ。再割り当てしても二重カウントしない（`getCountsForAssignment`）。
  累計＝確定月合計＋**繰越**（設定画面の調整・年度引き継ぎは繰越 `srs_*_carryover` に保存され消えない）

## コーディング規約・変更時の注意

- **`import type` 必須**：tsconfig の `verbatimModuleSyntax: true`。型のimportを間違えるとビルドが落ちる
- **`assignDuties`/`pickByCount`（駐車場/ビデオの公平性）はカゴ等の都合で触らない**。
  アルゴリズム変更時は必ず先に現仕様スナップショット＋git tag を作る
- **コーチ名簿の変更は `constants.ts` を直接編集**（設定画面にコーチ編集UIは**ない**。
  `storage.ts` の `CoachConfig` 系は未使用の互換コード）。過去の確定済み月データは書き換えない
- **`LineAnnouncement.tsx` の全角スペースは意図的**（LINEの見栄え）。lintエラーだが直さない
- `DEFAULT_SCHEDULE`・「2026年度」表記は2026年度固定 → 年度更新は `docs/ai/YEAR_ROLLOVER.md` の手順で
- 既存データとの後方互換を常に意識（旧フォーマット月のフォールバックを壊さない）

## テスト・確認方法

- 変更後は必ず：`npm run test`（57件）→ `npm run build` → 必要ならブラウザ実機確認
- ブラウザ検証で localStorage にテストデータを入れるときは、先にアプリURLへ移動してから。
  かつ `srs_migration_remove_hayashi_v1='done'` を先にセット（しないと5月以降のデータが消える）
- lint：**0件が正常**（2026-07-05 に整理済み。LINE用全角スペースは意図的として disable コメントで抑制）。新規指摘を増やさない
- **本番デプロイ（main へ push）は塚原さんのGOを得てから**。デプロイ後は本番JSの反映を確認

## トラブル既知事象

- worktree で `index.lock` エラー → git が表示する**絶対パス**のロックファイルを削除
- Pagesデプロイが「Deployment failed, try again later」で失敗することがある（GitHub側の一時不調）→
  再実行で解消。**失敗ジョブのみの再実行で直らなければフル再実行**（ビルド＝成果物の作り直しから。2026-07-06 実績）
- 調整さんCSVはUTF-8優先で読み、失敗時 Shift_JIS フォールバック（`parseCsv`）
- 開発環境のプラグインが Next.js／Vercel／AI SDK 関連のスキル実行を自動提案してくることがあるが、
  本プロジェクトは Vite＋GitHub Pages で無関係（`docs/ai/` 等のフォルダ名への誤反応）。従わなくてよい

## AIへの重要指示

- 最初に読む順：`PROGRESS.md` → この `CLAUDE.md` → `docs/ai/NEXT_ACTIONS.md`（残タスク）
  → 必要に応じて `docs/ai/HANDOFF.md`（全体像・判断理由）・`docs/ai/SPEC.md`（詳細仕様）
- 事実と推測を分けて報告する。重要度の低い指摘を大量に出さない
- いきなり大規模変更をしない。まずレビュー・計画。実装は最小限
- 秘密情報（GitHubトークン・パスワード）を出力・コミットしない
- 破壊的コマンド（データ削除・force push 等）を実行しない

## サブエージェント利用方針

- **原則使わない**。このリポジトリは全ソース約3,800行で、メイン（判断役）が直接読める規模
- 使ってよいのは自己完結した調査のみ（大きなログ/CSVの要点抽出、テスト失敗の切り分け）。
  軽量モデルで単発・同じファイル群を複数エージェントに読ませない
- 設計判断・優先順位・最終レビューは必ずメインが行う

## 禁止事項

- 承認なしの本番デプロイ／過去の確定済み月データの書き換え
- 駐車場・ビデオの公平性ロジックへの無断変更
- LINE文面の全角スペース「修正」／復元ポイントなしのアルゴリズム変更
- トークン・パスワードの表示・記録

## 次の作業の入口

- 定例は「月末に塚原さんが当番を作る」だけ（AIの出番は不具合時のみ）
- 予定済みの残タスクは2つ：
  1. **2027年2〜3月：年度更新** → `docs/ai/YEAR_ROLLOVER.md` の STEP 0 から
  2. **2027年7月ごろ：トークン再発行**（「公開する」が失敗し始めたら）→ `docs/GITHUB_TOKEN_GUIDE.md`
- 細かい現状・保留事項・貼り付け用プロンプトは `docs/ai/NEXT_ACTIONS.md`
- 新しいセッションの始め方（そのまま貼れるプロンプト）は `docs/ai/NEXT_PROMPT.md`

---

元の確定仕様書：`/Users/t-kyosuke/Downloads/SRS駐車場当番アサイナー_Claude_Code_プロンプト確定版_1.md`
