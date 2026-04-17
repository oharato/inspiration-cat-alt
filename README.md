# InspirationCatAlt

動物の写真をアップロードするだけで、AIが背景を自動除去し「閃いた！」風の合成画像を生成するブラウザアプリです。**すべての処理はブラウザ内で完結**し、画像がサーバーに送信されることはありません。

🌐 **公開URL**: https://inspiration-cat-alt.pages.dev/

Inspired by https://github.com/nyanko3141592/InspirationCat 

---

## 機能

- 📸 画像アップロード（ファイル選択 or ドラッグ&ドロップ）
- 🤖 AIによる背景自動除去（ブラウザ内処理、WebGPU / WASM 自動選択）
- 🎨 閃きエフェクト背景への合成
- 🖱️ ドラッグ / タッチで被写体の位置を調整
- 🔍 スライダーでサイズ・回転を調整
- ↔️ 左右反転
- 💾 PNG でダウンロード保存
- 𝕏 `#InspirationCat` ハッシュタグ付きで X (Twitter) にポスト
- 🔗 Web Share API によるネイティブ共有（モバイル対応）

---

## 使い方

1. ページを開き、アップロードエリアに動物の写真をドラッグ&ドロップするか、エリアをタップ/クリックしてファイルを選択します。
2. 初回はAIモデル（約25MB）をダウンロードします。進捗バーで確認できます（2回目以降はキャッシュから即時読み込み）。
3. 背景除去が完了すると、閃きエフェクト背景に被写体が合成されます。
4. 被写体をドラッグ（PC）またはスライド（スマートフォン）で位置を調整します。
5. スライダーでサイズ・回転を調整し、反転ボタンで左右反転できます。
6. 「💾 保存」で PNG としてダウンロード、または「𝕏 ポスト」で X に投稿します。

---

## 技術スタック

| カテゴリ | 技術 |
|---|---|
| ビルドツール | Vite + TypeScript |
| 背景除去 | `@huggingface/transformers` (Apache-2.0) + `Xenova/modnet` |
| ML ランタイム | ONNX Runtime Web (WASM / WebGPU 自動選択) |
| UI | Alpine.js |
| 描画 | HTML5 Canvas API |
| ホスティング | Cloudflare Pages |

すべての依存ライセンスが Apache-2.0 / MIT であり、AGPL 非依存です。

---

## セットアップ

```bash
npm install
```

### 開発サーバー起動

```bash
npm run dev
```

### ビルド

```bash
npm run build
```

### デプロイ（Cloudflare Pages）

```bash
npm run deploy
```

> 初回デプロイ時は `npx wrangler login` による認証が必要です。

---

## ライセンス

MIT

| 依存ライブラリ | ライセンス |
|---|---|
| `@huggingface/transformers` | Apache-2.0 |
| `Xenova/modnet` モデル | Apache-2.0 |
| ONNX Runtime Web | MIT |
| Alpine.js | MIT |
| Vite | MIT |
