import { CANVAS_W, CANVAS_H, DEFAULT_STATE, type SubjectState } from './types';
import { getSegmenter, removeBackground, loadBg } from './segmenter';
import { CanvasRenderer } from './renderer';

interface DragState {
  active: boolean;
  startX: number;
  startY: number;
  origX: number;
  origY: number;
}

interface PinchState {
  startDist: number;
  startScale: number;
  startAngle: number;
  startRot: number;
}

export function createApp() {
  return {
    // ── Alpine リアクティブ ──
    phase: 'upload' as 'upload' | 'progress' | 'canvas' | 'error',
    progressMsg: '',
    progressPct: '',
    errorMsg: '',
    scalePct: 100,
    rotation: 0,
    showGuide: false,
    guideText: '',
    copied: false,
    canShare: false,

    // ── 内部状態（リアクティブだが template 非バインド） ──
    _pos: { x: DEFAULT_STATE.x, y: DEFAULT_STATE.y } as Pick<SubjectState, 'x' | 'y'>,
    _flipped: false,
    _renderer: null as CanvasRenderer | null,
    _drag: { active: false, startX: 0, startY: 0, origX: 0, origY: 0 } as DragState,
    _pinch: { startDist: 0, startScale: 1, startAngle: 0, startRot: 0 } as PinchState,
    _copyTimer: 0,

    init() {
      this.canShare = !!navigator.share;
      this.guideText = window.matchMedia('(pointer: coarse)').matches
        ? 'スライドで位置調整・ピンチでサイズ変更'
        : 'ドラッグで位置を調整';
    },

    async onFile(file: File | undefined) {
      if (!file?.type.startsWith('image/')) {
        this.errorMsg = '画像ファイルを選択してください。';
        this.phase = 'error';
        return;
      }

      this.phase = 'progress';
      let url: string | null = null;

      try {
        url = URL.createObjectURL(file);

        const [bgImg] = await Promise.all([
          loadBg(),
          getSegmenter((msg, pct) => {
            this.progressMsg = msg;
            this.progressPct = pct;
          }),
        ]);

        // Canvas を初期化（初回のみ）
        if (!this._renderer) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const canvas = (this as any).$refs.canvas as HTMLCanvasElement;
          canvas.width = CANVAS_W;
          canvas.height = CANVAS_H;
          this._renderer = new CanvasRenderer(canvas);
        }
        this._renderer.setBg(bgImg);

        this.progressMsg = '背景を除去中…';
        this.progressPct = '';
        const subject = await removeBackground(url);
        this._renderer.setSubject(subject);

        this._pos = { x: DEFAULT_STATE.x, y: DEFAULT_STATE.y };
        this._flipped = false;
        this.scalePct = 100;
        this.rotation = 0;
        this.render();

        this.phase = 'canvas';
        this.showGuide = true;
        setTimeout(() => { this.showGuide = false; }, 5500);
      } catch (err) {
        console.error(err);
        this.errorMsg = (err instanceof Error ? err.message : '処理に失敗しました') +
          '\nメモリ不足の場合はページをリロードして再試行してください。';
        this.phase = 'error';
      } finally {
        if (url) URL.revokeObjectURL(url);
      }
    },

    render() {
      this._renderer?.render({
        x: this._pos.x,
        y: this._pos.y,
        scale: this.scalePct / 100,
        rotation: this.rotation,
        flipped: this._flipped,
      });
    },

    resetState() {
      this._pos = { x: DEFAULT_STATE.x, y: DEFAULT_STATE.y };
      this._flipped = false;
      this.scalePct = 100;
      this.rotation = 0;
      this.render();
    },

    // ── マウスドラッグ ──
    dragStart(e: MouseEvent) {
      if (!this._renderer?.hasSubject()) return;
      this._drag = { active: true, startX: e.clientX, startY: e.clientY, origX: this._pos.x, origY: this._pos.y };
    },

    dragMove(e: MouseEvent) {
      if (!this._drag.active) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rect = ((this as any).$refs.canvas as HTMLCanvasElement).getBoundingClientRect();
      const scaleX = CANVAS_W / rect.width;
      const scaleY = CANVAS_H / rect.height;
      this._pos.x = Math.max(0, Math.min(1, this._drag.origX + (e.clientX - this._drag.startX) * scaleX / CANVAS_W));
      this._pos.y = Math.max(0, Math.min(1, this._drag.origY + (e.clientY - this._drag.startY) * scaleY / CANVAS_H));
      this.render();
    },

    dragEnd() { this._drag.active = false; },

    // ── タッチ ──
    touchStart(e: TouchEvent) {
      if (!this._renderer?.hasSubject()) return;
      if (e.touches.length === 1) {
        this._drag = { active: true, startX: e.touches[0].clientX, startY: e.touches[0].clientY, origX: this._pos.x, origY: this._pos.y };
      } else if (e.touches.length === 2) {
        this._drag.active = false;
        const [t1, t2] = [e.touches[0], e.touches[1]];
        this._pinch = {
          startDist: Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY),
          startScale: this.scalePct / 100,
          startAngle: Math.atan2(t2.clientY - t1.clientY, t2.clientX - t1.clientX),
          startRot: this.rotation,
        };
      }
    },

    touchMove(e: TouchEvent) {
      if (!this._renderer?.hasSubject()) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rect = ((this as any).$refs.canvas as HTMLCanvasElement).getBoundingClientRect();
      const scaleX = CANVAS_W / rect.width;
      const scaleY = CANVAS_H / rect.height;

      if (e.touches.length === 1 && this._drag.active) {
        this._pos.x = Math.max(0, Math.min(1, this._drag.origX + (e.touches[0].clientX - this._drag.startX) * scaleX / CANVAS_W));
        this._pos.y = Math.max(0, Math.min(1, this._drag.origY + (e.touches[0].clientY - this._drag.startY) * scaleY / CANVAS_H));
        this.render();
      } else if (e.touches.length === 2) {
        const [t1, t2] = [e.touches[0], e.touches[1]];
        const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
        const angle = Math.atan2(t2.clientY - t1.clientY, t2.clientX - t1.clientX);
        this.scalePct = Math.round(Math.max(5, Math.min(300, this._pinch.startScale * (dist / this._pinch.startDist) * 100)));
        let rot = this._pinch.startRot + (angle - this._pinch.startAngle) * (180 / Math.PI);
        rot = ((rot % 360) + 360) % 360;
        this.rotation = rot > 180 ? rot - 360 : rot;
        this.render();
      }
    },

    touchEnd() { this._drag.active = false; },

    // ── アクション ──
    async download() {
      const blob = await this._renderer?.toBlob();
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = Object.assign(document.createElement('a'), { href: url, download: 'inspiration-cat.png' });
      a.click();
      URL.revokeObjectURL(url);
    },

    xPost() {
      const text = encodeURIComponent('閃いた！ #InspirationCat');
      window.open(`https://twitter.com/intent/tweet?text=${text}`, '_blank', 'noopener,noreferrer');
    },

    async share() {
      const blob = await this._renderer?.toBlob();
      if (!blob) return;
      try {
        await navigator.share({ title: 'InspirationCat', text: '閃いた！ #InspirationCat', files: [new File([blob], 'inspiration-cat.png', { type: 'image/png' })] });
      } catch (err) {
        if (err instanceof Error && err.name !== 'AbortError') console.error(err);
      }
    },

    async copyHashtag() {
      try {
        await navigator.clipboard.writeText('#InspirationCat');
        this.copied = true;
        clearTimeout(this._copyTimer);
        this._copyTimer = window.setTimeout(() => { this.copied = false; }, 2000);
      } catch { /* ignore */ }
    },
  };
}
