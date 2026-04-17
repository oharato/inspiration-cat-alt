# InspirationCat クローン — 仕様書

> 参照元: https://inspiration-cat.pages.dev/  
> ライセンス方針: ソースコードは独自実装（AGPL 依存なし）

---

## 1. アプリ概要

動物の写真をアップロードするだけで、AIが背景を自動除去し「閃いた！」風の合成画像を生成するブラウザアプリ。**すべての処理はクライアント側で完結**（画像がサーバーに送信されない）。

---

## 2. 背景除去ライブラリ比較・選定

### 候補

| ライブラリ | ライセンス | 精度 | 速度 | 備考 |
|---|---|---|---|---|
| `@imgly/background-removal` v1.7.0 | **AGPL-3.0** | ★★★ | ★★ | 元実装。ソースコード公開義務あり |
| `@huggingface/transformers` + `Xenova/modnet` | **Apache-2.0** | ★★☆ | ★★★ | 軽量・商用可・WebGPU対応 |
| `@huggingface/transformers` + `briaai/RMBG-1.4` | CC BY-NC 4.0 | ★★★ | ★★ | 非商用のみ |
| `briaai/RMBG-2.0` | CC BY-NC 4.0 | ★★★ | ★★★ | 非商用のみ（商用は有料API） |
| `rembg-webgpu` | MIT互換（Attribution） | ★★★ | ★★★ | WebGPU FP16/FP32 + WASM自動選択。実績少 |

### 採用決定: `@huggingface/transformers` (Apache-2.0) + `Xenova/modnet`

**理由:**
- **ライセンスが最もクリーン**: Apache-2.0 でソースコード公開義務なし・商用利用可
- **AGPL 問題を完全回避**: `@imgly/background-removal` の AGPL-3.0 は、ネットワーク越しに提供するサービスにもコピーレフトが及ぶ
- WebGPU / WASM 両対応で幅広いブラウザで動作
- Transformers.js は週間 70 万DL、活発にメンテナンスされている
- `background-removal` タスクが公式サポート済み

```
npm install @huggingface/transformers
```

---

## 3. 機能要件

### 3.1 コア機能

| # | 機能 | 詳細 |
|---|---|---|
| F-01 | 画像アップロード | ファイル選択ダイアログ（`accept="image/*"`）またはエリアタップ |
| F-02 | AI背景除去 | `@huggingface/transformers` の `background-removal` pipeline でブラウザ内処理 |
| F-03 | Canvas合成 | 「閃きエフェクト」背景画像の上に透過処理済み被写体を重ねる |
| F-04 | 位置調整 | マウスドラッグ / タッチスライドで被写体を任意の位置へ移動 |
| F-05 | サイズ調整 | スライダー（0.05〜3.0x） / ピンチ操作 |
| F-06 | 回転調整 | スライダー（-180°〜+180°） |
| F-07 | 左右反転 | 被写体を水平反転 |
| F-08 | リセット | 位置・サイズ・回転・反転を初期値に戻す |
| F-09 | 画像保存 | Canvas を PNG でローカルダウンロード |
| F-10 | X (Twitter) ポスト | `#InspirationCat` ハッシュタグ付きで X の投稿画面を開く |
| F-11 | Web Share API | モバイルのネイティブ共有ダイアログ呼び出し |
| F-12 | ハッシュタグコピー | `#InspirationCat` クリップボードコピー（クリック/タップで） |
| F-13 | ドラッグガイド | 初回処理完了後にドラッグ操作の案内を一時表示 |
| F-14 | 処理中表示 | スピナー + 進捗テキスト（モデル読み込み中 / 背景除去中 など） |
| F-15 | エラーハンドリング | メモリ不足・処理失敗時のメッセージ表示（リトライ誘導） |

### 3.2 UI/UX

| 要件 | 詳細 |
|---|---|
| レスポンシブ | スマートフォン（縦持ち）〜PC まで対応 |
| タッチ対応 | ピンチズーム（2本指）、1本指ドラッグ |
| スクロール禁止 | Canvas タッチ時は `e.preventDefault()` でスクロール抑制 |
| ヒントテキスト | タッチ端末では「スライドで位置調整・ピンチでサイズ変更」、PCは「ドラッグで位置を調整」 |
| モデルキャッシュ | `Cache API` / `IndexedDB` でモデル重みをキャッシュ（2回目以降は即時） |
| 初回ロード | モデルダウンロード中の進捗をパーセンテージで表示 |

---

## 4. 技術スタック

| カテゴリ | 技術 |
|---|---|
| ビルドツール | **Vite 8** + TypeScript 6 |
| 背景除去 | **`@huggingface/transformers`** (Apache-2.0) + `Xenova/modnet` |
| ML ランタイム | ONNX Runtime Web (WASM / WebGPU 自動選択) |
| UI フレームワーク | **Alpine.js** |
| 描画 | HTML5 Canvas API |
| スタイリング | CSS (バニラ、カスタム CSS 変数) |
| ホスティング | **Cloudflare Pages (Static Assets)** |
| デプロイ設定 | `wrangler.toml` + `pages_build_output_dir` |
| CI/CD | GitHub Actions → `wrangler deploy` |

---

## 5. ファイル構成

```
inspiration-cat/
├── public/
│   ├── bg.svg           # 閃きエフェクト背景画像（SVG・1200×800・3:2）
│   └── wasm/            # ONNX Runtime WASMファイル（本番用）
│       └── ort-wasm-simd-threaded.asyncify.mjs
├── src/
│   ├── types.ts         # 型定義・定数（CANVAS_W=1200, CANVAS_H=800）
│   ├── segmenter.ts     # 背景除去ロジック（image-segmentation pipeline）
│   ├── renderer.ts      # Canvas描画ロジック
│   ├── app.ts           # Alpine.js コンポーネント定義
│   ├── main.ts          # エントリポイント
│   └── style.css        # スタイル（CSS変数・レスポンシブ）
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── wrangler.toml        # Cloudflare Pages 設定
└── README.md
```

---

## 6. 背景除去の実装方針

`image-segmentation` pipeline を使用し、返却されたマスク（`RawImage`）を Canvas API で手動適用することで透過画像を生成します。

```typescript
import { pipeline, env, RawImage } from '@huggingface/transformers';

// 本番ビルドではローカルWASMを使用（CDN不要・CSP準拠）
if (import.meta.env.PROD) {
  env.backends.onnx.wasm.wasmPaths = '/wasm/';
}

// モデル初期化（初回のみ、WebGPU→WASMフォールバック）
const pipe = await pipeline('image-segmentation', 'Xenova/modnet', {
  device: 'webgpu',
  dtype: 'fp32',
});

// 背景除去: マスクをCanvasで手動適用して透過PNGを生成
const [{ mask }] = await pipe(imageUrl);
// mask は RawImage (グレースケール)。Canvas で alpha チャンネルに適用。
```

### WASM 配信

- `ort-wasm-simd-threaded.asyncify.wasm` — Vite ビルド時に `/wasm/` へ出力（ハッシュなし）
- `ort-wasm-simd-threaded.asyncify.mjs` — `node_modules/onnxruntime-web/dist/` からビルド後コピー
- dev モードは CDN (jsdelivr) を使用（Vite の `public/` 制限を回避）

### モデル

| モデル | サイズ | 商用ライセンス | 採用状況 |
|---|---|---|---|
| `Xenova/modnet` | ~25MB | Apache-2.0 ✅ | **採用** |
| `Xenova/modnet-photographic-portrait-matting` | ~25MB | Apache-2.0 ✅ | 401エラーのため不採用 |

---

## 7. Canvas 合成ロジック

```
1. 背景画像（bg.svg）をCanvasサイズに合わせて描画（SVGはピクセル密度に関係なく鮮明）
2. 透過処理済み被写体を以下のパラメータで重ねて描画:
   - 位置: (subjectX, subjectY) — 正規化座標 0.0〜1.0
   - スケール: subjectScale (0.05〜3.0)
   - 回転: subjectRotation (-180〜180 degrees)
   - 反転: subjectFlipped (boolean) — scaleX(-1) で実現
3. パラメータ変更の都度 requestAnimationFrame で再描画
```

---

## 8. 操作インタラクション

### マウス
- `mousedown` → ドラッグ開始、カーソルを `grabbing` に変更
- `mousemove` → 被写体位置を更新して Canvas 再描画
- `mouseup` / `mouseleave` → ドラッグ終了

### タッチ
- 1本指 `touchstart` → ドラッグ開始
- 2本指 `touchstart` → ピンチ開始（距離・角度を記録）
- `touchmove` (1本指) → 位置更新
- `touchmove` (2本指) → ピンチ: スケール更新、回転更新
- `{ passive: false }` + `e.preventDefault()` でスクロール禁止

---

## 9. セキュリティ

- 画像はすべてブラウザ内で処理（外部サーバー送信なし）
- アップロード画像は `FileReader` / `URL.createObjectURL` でのみ読み込み
- ダウンロードは Canvas の `toBlob()` を使用（外部 URL なし）
- CSP ヘッダー設定（Cloudflare Pages の `_headers` ファイルで設定）
- SVG 背景は外部スクリプトを含まない静的ファイルとして管理（`<script>` タグ不使用）

---

## 10. Cloudflare Pages デプロイ設定

### `wrangler.toml`
```toml
name = "inspiration-cat-alt"
pages_build_output_dir = "dist"
compatibility_date = "2025-01-01"
```

> `[assets]` セクションは Pages では非サポートのため不要。

### `package.json` scripts
```json
"dev":    "vite",
"build":  "tsc && vite build && cp node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.asyncify.mjs dist/wasm/",
"deploy": "npm run build && npx wrangler pages deploy dist --branch production"
```

### `public/_headers` (レスポンスヘッダー・CSP)
```
/*
  Content-Security-Policy: default-src 'self';
    script-src 'self' 'wasm-unsafe-eval' 'unsafe-eval' https://cdn.jsdelivr.net;
    worker-src blob:;
    connect-src 'self' blob: https://huggingface.co https://cdn-lfs.huggingface.co
      https://cdn-lfs-us-1.huggingface.co https://*.xethub.hf.co https://cdn.jsdelivr.net;
    img-src 'self' blob: data:;
    style-src 'self' 'unsafe-inline';
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=()

/*.wasm
  Cache-Control: public, max-age=31536000, immutable

/assets/*
  Cache-Control: public, max-age=31536000, immutable
```

> `'unsafe-eval'` は Alpine.js の式評価に必要。`blob:` は transformers.js の画像処理に必要。  
> `https://*.xethub.hf.co` は HuggingFace の XET ストレージ経由のモデル配信に対応。

### GitHub Actions ワークフロー
```yaml
name: Deploy to Cloudflare Pages
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      deployments: write
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run build
      - uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          command: deploy
```

### ローカルプレビュー
```bash
npm run build
npx wrangler pages dev dist
```

---

## 11. ライセンス

| 対象 | ライセンス |
|---|---|
| このアプリのソースコード | MIT（または独自ライセンス）|
| `@huggingface/transformers` | Apache-2.0 |
| `Xenova/modnet` モデル | Apache-2.0 |
| ONNX Runtime Web | MIT |
| Vite | MIT |

> AGPL-3.0 の依存がないため、**ソースコードの公開義務はありません**。
