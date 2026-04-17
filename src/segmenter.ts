import { MODEL_ID } from './types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SegPipeline = (input: string) => Promise<Array<{ label: string; score: number; mask: any }>>;

let _instance: SegPipeline | null = null;

function loadImage(src: string, crossOrigin?: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (crossOrigin) img.crossOrigin = crossOrigin;
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('画像の読み込みに失敗しました'));
    img.src = src;
  });
}

export async function getSegmenter(onProgress: (msg: string, pct: string) => void): Promise<void> {
  if (_instance) return;

  onProgress('AIモデルを読み込み中…', '');

  // dynamic import でコードスプリット
  const { pipeline, env } = await import('@huggingface/transformers');
  env.allowLocalModels = false;
  if (import.meta.env.PROD) {
    (env.backends.onnx.wasm as { wasmPaths?: string }).wasmPaths = '/wasm/';
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cb = (event: any) => {
    if (event.status === 'progress' && event.progress != null) {
      onProgress('AIモデルを読み込み中…', `${Math.round(event.progress)}%`);
    }
  };

  let pipe;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    pipe = await pipeline('image-segmentation', MODEL_ID, { device: 'webgpu', dtype: 'fp32', progress_callback: cb as any });
  } catch {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    pipe = await pipeline('image-segmentation', MODEL_ID, { progress_callback: cb as any });
  }
  _instance = pipe as unknown as SegPipeline;
}

export async function removeBackground(imageUrl: string): Promise<HTMLImageElement> {
  if (!_instance) throw new Error('モデルが初期化されていません');

  const origImg = await loadImage(imageUrl, 'anonymous');
  const { naturalWidth: w, naturalHeight: h } = origImg;

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(origImg, 0, 0);

  const [seg] = await _instance(imageUrl);
  if (!seg?.mask) throw new Error('セグメンテーション結果が取得できませんでした');

  // マスクをアルファチャンネルに変換
  const { mask } = seg;
  const maskCanvas = document.createElement('canvas');
  maskCanvas.width = mask.width;
  maskCanvas.height = mask.height;
  const maskCtx = maskCanvas.getContext('2d')!;
  const maskData = maskCtx.createImageData(mask.width, mask.height);
  const src = mask.data as Uint8Array | Float32Array;
  for (let i = 0; i < mask.width * mask.height; i++) {
    maskData.data[i * 4 + 3] = src[i] > 1 ? src[i] : Math.round(src[i] * 255);
  }
  maskCtx.putImageData(maskData, 0, 0);

  // destination-in でマスクをアルファとして合成（スケール込み）
  ctx.globalCompositeOperation = 'destination-in';
  ctx.drawImage(maskCanvas, 0, 0, w, h);
  ctx.globalCompositeOperation = 'source-over';

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) return reject(new Error('Canvas toBlob に失敗しました'));
      loadImage(URL.createObjectURL(blob)).then(resolve, reject);
    }, 'image/png');
  });
}

export function loadBg(): Promise<HTMLImageElement> {
  return loadImage('/bg.png');
}
