# SRS 駐車場当番アサイナー

吹田ラグビースクール（SRS）中3コーチ陣の「駐車場・ビデオ・カゴ当番」を自動で公平に割り当てるWebアプリ。

- **本番**：https://t-kyosuke.github.io/parking-lot-duty/
- **運用**：管理者1人が月末に調整さんCSVを取り込み → 出欠確認 → 自動割り当て → LINEに文面コピペ →
  「公開する」でコーチ陣のスマホに反映（閲覧はLINE共有URLから・ログイン不要）

## 技術構成

- React 19 + TypeScript + Vite 8／Vanilla CSS／Vitest（テスト57件）
- バックエンドなし（データは管理PCの localStorage。閲覧用データは gh-pages ブランチの `data.json`）
- main へ push → GitHub Actions で GitHub Pages へ自動デプロイ

## コマンド

```bash
npm run dev      # 開発サーバー → http://localhost:5173/parking-lot-duty/
npm run test     # ユニットテスト（57件・全通過が正常）
npm run build    # 本番ビルド（型チェック込み）
npm run lint     # 指摘0件が正常
```

## ドキュメント

| ファイル | 内容 |
|------|------|
| `CLAUDE.md` | AI（Claude Code）作業用の運用メモ。**AIはまずこれを読む** |
| `PROGRESS.md` | セッションごとの作業記録（詳細な経緯はここ） |
| `docs/ai/HANDOFF.md` | 引き継ぎ総まとめ（全体像・設計判断の理由・注意点） |
| `docs/ai/SPEC.md` | 詳細仕様書（アルゴリズム・CSV・UI・LINE書式） |
| `docs/ai/NEXT_ACTIONS.md` | 残タスクと優先順位 |
| `docs/ai/CHANGELOG_AI.md` | AIによる変更履歴の要約 |
| `docs/ai/YEAR_ROLLOVER.md` | 年度更新の手順書（2027年2〜3月に実施） |
| `docs/GITHUB_TOKEN_GUIDE.md` | GitHubトークン再発行の手順書（2027年7月ごろ） |
