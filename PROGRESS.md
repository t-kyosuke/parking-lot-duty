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

### 優先度：中
3. **当番候補コーチ・除外コーチの編集UI**：Settings.tsxに追加・削除・順番変更の機能
4. **スマホ実機テスト**：CSVアップロードとLINEコピーの操作感

### 優先度：低
5. **練習時間の閲覧者向け表示確認**
6. **同日複数行のUI表示**

---

## 📝 変更履歴

| 日付 | 内容 |
|------|------|
| 2026-03-30 | プロジェクト作成、コアライブラリ実装、全コンポーネント実装 |
| 2026-03-31 | TypeScript型エラー修正（verbatimModuleSyntax対応）、ビルド成功確認 |
| 2026-03-31 | CLAUDE.md / PROGRESS.md 作成（Claude Code引き継ぎ用） |
| 2026-03-31 | 管理者モードのバグ2件修正（割り当てボタン消失・手動変更無効） |
| 2026-03-31 | GitHub Pagesデプロイ完了（https://t-kyosuke.github.io/parking-lot-duty/） |
