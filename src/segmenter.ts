import { pipeline, env, RawImage, type ProgressCallback } from '@huggingface/transformers';
import { MODEL_ID } from './types';

env.allowLocalModels = false;
// 本番ビルドではローカルWASMを使用（CDNへのCSP違反を回避）
if (import.meta.env.PROD) {
  (env.backends.onnx.wasm as { wasmPaths?: string }).wasmPaths = '/wasm/';
}

type OnProgress = (msg: string, pct: string) => void;

// image-segmentation pipeline type
type SegPipeline = (input: string) => Promise<Array<{ label: string; score: number; mask: RawImage }>>;

let _instance: SegPipeline | null = null;

export async function getSegmenter(onProgress: OnProgress): Promise<void> {
  if (_instance) return;

  onProgress('AIモデルを読み込み中…', '');

  const cb: ProgressCallback = (event) => {
    if (event.status === 'progress' && 'progress' in event) {
      onProgress('AIモデルを読み込み中…', `${Math.round((event as { progress: number }).progress)}%`);
    } else if (event.status === 'ready') {
      onProgress('AIモデルを読み込み中…', '');
    }
  };

  let pipe;
  try {
    pipe = await pipeline('image-segmentation', MODEL_ID, {
      device: 'webgpu',
      dtype: 'fp32',
      progress_callback: cb,
    });
  } catch {
    // WebGPU 非対応なら WASM にフォールバック
    pipe = await pipeline('image-segmentation', MODEL_ID, {
      progress_callback: cb,
    });
  }
  _instance = pipe as unknown as SegPipeline;
}

export async function removeBackground(imageUrl: string): Promise<HTMLImageElement> {
  if (!_instance) throw new Error('モデルが初期化されていません');

  // Load original image onto canvas
  const origImg = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('元画像の読み込みに失敗しました'));
    img.src = imageUrl;
  });

  const w = origImg.naturalWidth;
  const h = origImg.naturalHeight;

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(origImg, 0, 0);
  const imgData = ctx.getImageData(0, 0, w, h);

  // Run segmentation — Xenova/modnet returns foreground mask
  const segs = await _instance(imageUrl);
  const seg = segs[0];
  if (!seg?.mask) throw new Error('セグメンテーション結果が取得できませんでした');

  const mask = seg.mask; // RawImage (grayscale)
  const mw = mask.width;
  const mh = mask.height;

  // Draw mask to a temp canvas so we can scale it to original size
  const maskCanvas = document.createElement('canvas');
  maskCanvas.width = mw;
  maskCanvas.height = mh;
  const maskCtx = maskCanvas.getContext('2d')!;
  const maskData = maskCtx.createImageData(mw, mh);
  for (let i = 0; i < mw * mh; i++) {
    const v = (mask.data as Uint8Array | Float32Array)[i];
    const byte = v <= 1.0 && v >= 0 && !Number.isInteger(v) ? Math.round(v * 255) : Math.round(+v);
    maskData.data[i * 4]     = byte;
    maskData.data[i * 4 + 1] = byte;
    maskData.data[i * 4 + 2] = byte;
    maskData.data[i * 4 + 3] = 255;
  }
  maskCtx.putImageData(maskData, 0, 0);

  // Scale mask to original image size and extract alpha
  const scaledMaskCanvas = document.createElement('canvas');
  scaledMaskCanvas.width = w;
  scaledMaskCanvas.height = h;
  const scaledCtx = scaledMaskCanvas.getContext('2d')!;
  scaledCtx.drawImage(maskCanvas, 0, 0, w, h);
  const scaledMask = scaledCtx.getImageData(0, 0, w, h);

  // Apply mask as alpha channel
  for (let i = 0; i < w * h; i++) {
    imgData.data[i * 4 + 3] = scaledMask.data[i * 4];
  }
  ctx.putImageData(imgData, 0, 0);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) return reject(new Error('Canvas toBlob に失敗しました'));
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('背景除去結果の読み込みに失敗しました'));
      img.src = url;
    }, 'image/png');
  });
}

export async function loadBg(): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('背景画像の読み込みに失敗しました'));
    img.src = '/bg.png';
  });
}
