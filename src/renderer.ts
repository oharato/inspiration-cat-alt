import { CANVAS_W, CANVAS_H, type SubjectState } from './types';

export class CanvasRenderer {
  private readonly ctx: CanvasRenderingContext2D;
  private bgImage: HTMLImageElement | null = null;
  private subjectImage: HTMLImageElement | null = null;
  private rafId = 0;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
  }

  setBg(img: HTMLImageElement): void { this.bgImage = img; }
  setSubject(img: HTMLImageElement): void { this.subjectImage = img; }
  hasSubject(): boolean { return this.subjectImage !== null; }

  render(state: SubjectState): void {
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = requestAnimationFrame(() => {
      const { ctx } = this;
      ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

      if (this.bgImage) {
        ctx.drawImage(this.bgImage, 0, 0, CANVAS_W, CANVAS_H);
      }

      if (this.subjectImage) {
        const img = this.subjectImage;
        const px = state.x * CANVAS_W;
        const py = state.y * CANVAS_H;
        const baseSize = Math.min(Math.min(CANVAS_W, CANVAS_H) * 0.6, img.naturalWidth, img.naturalHeight);
        const aspect = img.naturalWidth / img.naturalHeight;
        const drawW = baseSize * state.scale * (aspect >= 1 ? 1 : aspect);
        const drawH = baseSize * state.scale * (aspect >= 1 ? 1 / aspect : 1);

        ctx.save();
        ctx.translate(px, py);
        ctx.rotate((state.rotation * Math.PI) / 180);
        if (state.flipped) ctx.scale(-1, 1);
        ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
        ctx.restore();
      }

      this.rafId = 0;
    });
  }

  toBlob(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      this.canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('Canvas toBlob failed'))),
        'image/png',
      );
    });
  }
}
