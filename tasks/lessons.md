# lessons.md - 学んだこと・ルール

ユーザーからの指摘やハマったポイントを記録し、同じミスを繰り返さないためのメモ。

---

## TypeScript

### verbatimModuleSyntax に注意
- `tsconfig.app.json` で `verbatimModuleSyntax: true` が有効
- 型（interface, type）のimportは必ず `import type { ... }` を使う
- これを忘れるとブラウザでランタイムエラーになる（ビルドも失敗する）

---

## 作業の進め方

（ユーザーからの指摘があればここに追加する）
