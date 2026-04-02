# PROGRESS.md - 進捗管理

## 現在の状態：基本実装完了 ✅

---

## ✅ 完了済み

### 2026-03-30〜31：基本実装
- プロジェクトセットアップ（Vite + React + TypeScript）
- コアライブラリ4本（constants / assignParking / parseCsv / storage）
- コンポーネント10本すべて実装
- CSS（ラグビー緑 + ゴールドのデザイン）
- ユニットテスト 3件全通過（アルゴリズムが確定版テストデータと完全一致）
- 本番ビルド成功
- ブラウザで閲覧者モード表示確認（コンソールエラーなし）

### 2026-03-31：土曜日が当番対象になるバグ修正（AdminView.tsx）
- **バグ修正**：CSVアップロード時、土曜日が「練習」扱いになり当番がアサインされていた
  - 原因：csvSchedule生成時に土曜日チェックが抜けていた（DEFAULT_SCHEDULEに土曜はないため fallback で 'practice' になっていた）
  - 修正：`d.dayOfWeek === '土'` なら `'off'` を自動設定する条件を追加
- GitHub Pagesに再デプロイ済み

### 2026-03-31：CSVパーサーのエンコーディング誤判定バグ修正（parseCsv.ts）
- **バグ修正**：UTF-8のCSVがShift_JISとして誤デコードされ「日程」が文字化けするバグを修正
  - 原因：`isShiftJIS()`が `0xE0〜0xFC` 範囲でチェックしていたが、UTF-8日本語バイト列も同範囲に含まれるため誤判定
  - 修正：Shift_JIS判定関数を廃止し、「UTF-8で読んで失敗したらShift_JISにフォールバック」方式に変更
- GitHub Pagesに再デプロイ済み

### 2026-03-31：管理者モードのバグ修正（AdminView.tsx）
- **バグ1修正**：同月2回目のCSVアップロード時に「当番を決定する」ボタンが消えるバグを修正
  - 原因：`displayAssignments = assignments || savedData` で savedData が confirmed=true だとボタン条件が false になっていた
  - 修正：出欠確認中は古い保存データを参照しないよう `confirmedAttendance ? assignments : (assignments || savedData)` に変更
  - 合わせてボタン条件を `assignments === null` に変更
- **バグ2修正**：保存済み結果の担当者を手動変更しても保存されないバグを修正
  - 原因：`handleResultUpdate` が `assignments === null` の場合に早期リターンしていた
  - 修正：`assignments || savedData` をベースに更新するよう変更

---

## 🔜 残りの作業

### 優先度：高
1. ~~**管理者モードの動作確認**~~ → ✅ コードレビューで2件のバグを発見・修正済み
2. ~~**GitHub Pagesデプロイ**~~ → ✅ https://t-kyosuke.github.io/parking-lot-duty/ で公開済み
3. ~~**スマホで「まだ決まっていません」になるバグ**~~ → ✅ GitHub API経由でデータ公開・取得する方式に変更

### 優先度：中
4. **当番候補コーチ・除外コーチの編集UI**：Settings.tsxに追加・削除・順番変更の機能
5. **スマホ実機テスト**：CSVアップロードとLINEコピーの操作感

### 優先度：低
5. **練習時間の閲覧者向け表示確認**
6. **同日複数行のUI表示**

### 2026-03-31：UIリデザイン（Dark Rugby テーマ）
- **デザイン第2弾**：強豪ラグビーチームサイト風ダークテーマに全面変更
- 漆黒背景 + スクールイエロー（#F0DC00）で強烈なコントラスト
- ヘッダーに斜めストライプ装飾・黄色ボーダーライン
- 月表示を5remの極太Barlow Condensed 900weightに
- 背景に微細グリッドテクスチャ
- TODAY行を黄色反転（全行が黄色に）
- スケジュールタイトルにダイヤモンド型黄色アイコン
- Toastを黄色地・黒字・ALL CAPSに

### 2026-03-31：UIリデザイン（Black & Gold テーマ）
- **デザイン全面刷新**：深緑ベースから吹田ラグビースクールのスクールカラー（黒×黄色）に変更
- SRS公式ロゴ画像をヘッダーに追加（2倍解像度）
- Barlow Condensed フォント導入（月表示・見出しの力強さ向上）
- コーチバッジ：黒地・黄文字のピル型
- TODAY バッジ：スクールイエロー + パルスアニメーション
- タブ：黒地・黄文字のセグメントコントロール
- ログインカード：黄色トップバー
- 次回ポインタ：スクールイエロー全面カード

### ✅ 動作確認済み（2026-03-31）
- CSVアップロード（UTF-8・複数月入り）→ 選択月のみ処理される
- 土曜日の自動除外
- 4月・5月それぞれ正常に割り当て動作
- 2ポインタアルゴリズム（代役が毎回異なる・担当回数が均一）
- 月をまたいだポインタの引き継ぎ

---

## 📝 変更履歴

| 日付 | 内容 |
|------|------|
| 2026-03-30 | プロジェクト作成、コアライブラリ実装、全コンポーネント実装 |
| 2026-03-31 | TypeScript型エラー修正（verbatimModuleSyntax対応）、ビルド成功確認 |
| 2026-03-31 | CLAUDE.md / PROGRESS.md 作成（Claude Code引き継ぎ用） |
| 2026-03-31 | 管理者モードのバグ2件修正（割り当てボタン消失・手動変更無効） |
| 2026-03-31 | GitHub Pagesデプロイ完了（https://t-kyosuke.github.io/parking-lot-duty/） |
| 2026-04-01 | 閲覧者画面にお知らせ文を追加（黒地・黄色強調デザイン） |
| 2026-04-01 | スマホ対応：GitHub API経由でデータ公開・取得する方式に変更（publishToGithub / fetchPublishedData） |
| 2026-04-01 | デプロイ手順を確立（.envのGITHUB_TOKENを使うgit remote set-url方式） |
| 2026-04-02 | OGPタグ追加（LINE共有時の表示改善） |
| 2026-04-02 | エクスポート/インポートの2ポインタ不整合修正（owed+searchFromを保存） |
| 2026-04-02 | AdminView.tsxのany型をAssignmentResult[]に修正 |
| 2026-04-02 | fetchPublishedDataをraw.githubusercontent.comに変更（APIレート制限対策） |
