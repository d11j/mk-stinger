import { LogoOverlayOptions, PresetPlugin } from '../types';
import { DEFAULT_LOGO_OVERLAY_OPTIONS, renderLogoOverlay } from './LogoOverlayRenderer';

export type BackgroundMode =
  'checkerboard' | 'black' | 'green' | 'scene_sim' | 'matte' | 'side_by_side';

export interface EngineEvents {
  onFrameUpdate?: (frame: number, progress: number, totalFrames: number, fps: number) => void;
  onPlayStateChange?: (isPlaying: boolean) => void;
}

export class AnimationEngine {
  private displayCanvas: HTMLCanvasElement;
  private displayCtx: CanvasRenderingContext2D;

  private bufferCanvas: OffscreenCanvas;
  private bufferCtx: OffscreenCanvasRenderingContext2D;

  // 内部状態
  private currentPreset: PresetPlugin<any>;
  private currentOptions: any;
  private logoOverlay: LogoOverlayOptions = { ...DEFAULT_LOGO_OVERLAY_OPTIONS };
  private fps: 30 | 60 = 60;
  private durationSec: number = 2.0;
  private totalFrames: number = 120;
  private currentFrame: number = 0;

  private isPlaying: boolean = false;
  private isLooping: boolean = true;
  private playTimerId: number | null = null;
  private backgroundMode: BackgroundMode = 'checkerboard';
  private baseWidth: number = 1920;
  private baseHeight: number = 1080;

  private events: EngineEvents = {};
  private isInitialized: boolean = false;

  private renderRafId: number | null = null;

  // 疑似配信画面用のパターンキャンバス
  private sceneACanvas: OffscreenCanvas | null = null;
  private sceneBCanvas: OffscreenCanvas | null = null;
  private simMaskCanvas: OffscreenCanvas | null = null;
  private simBlendCanvas: OffscreenCanvas | null = null;
  private customSceneAImage: HTMLImageElement | null = null;
  private customSceneBImage: HTMLImageElement | null = null;

  constructor(displayCanvas: HTMLCanvasElement, preset: PresetPlugin<any>, options: any) {
    this.displayCanvas = displayCanvas;
    this.displayCtx = displayCanvas.getContext('2d', { alpha: false })!;

    this.currentPreset = preset;
    this.currentOptions = { ...options };

    const width = 1920;
    const height = 1080;
    this.displayCanvas.width = width;
    this.displayCanvas.height = height;

    this.bufferCanvas = new OffscreenCanvas(width, height);
    this.bufferCtx = this.bufferCanvas.getContext('2d', { alpha: true })!;

    this.updateTotalFrames();
    this.createSimScenes(width, height);
    this.renderCurrentFrame();
  }

  public init(events: EngineEvents = {}) {
    this.events = events;
    this.isInitialized = true;
    if (this.events.onFrameUpdate) {
      this.events.onFrameUpdate(this.currentFrame, 0, this.totalFrames, this.fps);
    }
  }

  public setEvents(events: EngineEvents) {
    this.events = { ...this.events, ...events };
  }

  public resize(width: number, height: number) {
    if (this.baseWidth === width && this.baseHeight === height) return;
    this.baseWidth = width;
    this.baseHeight = height;
    this.syncCanvasDimensions();
    this.createSimScenes(width, height);
    this.renderCurrentFrame();
  }

  private syncCanvasDimensions() {
    const targetDisplayWidth =
      this.backgroundMode === 'side_by_side' ? this.baseWidth * 2 : this.baseWidth;
    if (
      this.displayCanvas.width !== targetDisplayWidth ||
      this.displayCanvas.height !== this.baseHeight
    ) {
      this.displayCanvas.width = targetDisplayWidth;
      this.displayCanvas.height = this.baseHeight;
    }
    if (
      this.bufferCanvas.width !== this.baseWidth ||
      this.bufferCanvas.height !== this.baseHeight
    ) {
      this.bufferCanvas.width = this.baseWidth;
      this.bufferCanvas.height = this.baseHeight;
    }
  }

  public setConfig(fps: 30 | 60, durationSec: number) {
    const changed = this.fps !== fps || this.durationSec !== durationSec;
    this.fps = fps;
    this.durationSec = durationSec;
    if (changed) {
      this.updateTotalFrames();
      this.requestRender();
    }
  }

  public setPreset(preset: PresetPlugin<any>, options?: any) {
    this.currentPreset = preset;
    this.currentOptions = options ? { ...options } : { ...preset.defaultOptions };
    this.renderCurrentFrame();
  }

  /**
   * オプション更新（プレビュー表示を rAF 経由で即時更新）
   */
  public updateOptions(options: any) {
    const changedKeys = Object.keys(options).filter((k) => this.currentOptions[k] !== options[k]);
    if (changedKeys.length === 0) return;

    this.currentOptions = { ...this.currentOptions, ...options };
    this.requestRender();
  }

  /**
   * 全プリセット共通のロゴオーバーレイ設定を更新
   */
  public setLogoOverlay(overlay: LogoOverlayOptions) {
    this.logoOverlay = { ...overlay };
    this.requestRender();
  }

  public getLogoOverlay(): LogoOverlayOptions {
    return { ...this.logoOverlay };
  }

  public setBackgroundMode(mode: BackgroundMode) {
    this.backgroundMode = mode;
    this.syncCanvasDimensions();
    this.renderCurrentFrame();
  }

  public getBackgroundMode(): BackgroundMode {
    return this.backgroundMode;
  }

  public setLooping(looping: boolean) {
    this.isLooping = looping;
  }

  public getIsLooping(): boolean {
    return this.isLooping;
  }

  public setCustomSceneImage(scene: 'A' | 'B', image: HTMLImageElement | null) {
    if (scene === 'A') {
      this.customSceneAImage = image;
    } else {
      this.customSceneBImage = image;
    }
    this.createSimScenes(this.baseWidth, this.baseHeight);
    this.renderCurrentFrame();
  }

  public getPreset() {
    return this.currentPreset;
  }

  public getOptions() {
    return this.currentOptions;
  }

  public getFps() {
    return this.fps;
  }

  public getDurationSec() {
    return this.durationSec;
  }

  public getTotalFrames() {
    return this.totalFrames;
  }

  public getCurrentFrame() {
    return this.currentFrame;
  }

  public getIsPlaying() {
    return this.isPlaying;
  }

  private updateTotalFrames() {
    this.totalFrames = Math.max(2, Math.round(this.durationSec * this.fps));
    if (this.currentFrame >= this.totalFrames) {
      this.currentFrame = this.totalFrames - 1;
    }
  }

  /**
   * requestAnimationFrame によるプレビュー描画のスロットリング
   * 高頻度の input イベントでも同一フレームでの重複描画を防ぎ 60fps を維持
   */
  public requestRender() {
    if (this.isPlaying) return;
    if (this.renderRafId !== null) return;
    this.renderRafId = requestAnimationFrame(() => {
      this.renderRafId = null;
      this.renderCurrentFrame();
    });
  }

  // --- 決定論的再生制御 ---

  public play() {
    if (this.isPlaying) return;
    this.isPlaying = true;
    if (this.events.onPlayStateChange) {
      this.events.onPlayStateChange(true);
    }

    // もし末尾なら先頭に戻す
    if (this.currentFrame >= this.totalFrames - 1) {
      this.currentFrame = 0;
    }

    const intervalMs = 1000 / this.fps;
    let expectedTime = performance.now() + intervalMs;

    const tick = () => {
      if (!this.isPlaying) return;

      this.stepFrame(1);

      if (!this.isLooping && this.currentFrame >= this.totalFrames - 1) {
        this.pause();
        return;
      }

      const drift = performance.now() - expectedTime;
      expectedTime += intervalMs;
      const nextDelay = Math.max(0, intervalMs - drift);

      this.playTimerId = window.setTimeout(tick, nextDelay);
    };

    this.playTimerId = window.setTimeout(tick, intervalMs);
  }

  /**
   * 1回切替テスト用: ループ再生を OFF にし、先頭フレーム (Scene A) から末尾フレーム (Scene B) まで再生して停止する
   */
  public playOneShot() {
    if (this.isPlaying) {
      this.pause();
    }
    this.setLooping(false);
    this.currentFrame = 0;
    this.renderCurrentFrame();
    this.play();
  }

  public pause() {
    if (!this.isPlaying) return;
    this.isPlaying = false;
    if (this.playTimerId !== null) {
      clearTimeout(this.playTimerId);
      this.playTimerId = null;
    }
    if (this.events.onPlayStateChange) {
      this.events.onPlayStateChange(false);
    }
  }

  public togglePlay() {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  public seekToFrame(frameIndex: number) {
    this.currentFrame = Math.max(0, Math.min(this.totalFrames - 1, frameIndex));
    this.renderCurrentFrame();
  }

  public seekToProgress(progress: number) {
    const frame = Math.round(progress * (this.totalFrames - 1));
    this.seekToFrame(frame);
  }

  public stepFrame(delta: number) {
    let next = this.currentFrame + delta;
    if (next >= this.totalFrames) {
      next = this.isLooping ? 0 : this.totalFrames - 1;
    } else if (next < 0) {
      next = this.isLooping ? this.totalFrames - 1 : 0;
    }
    this.currentFrame = next;
    this.renderCurrentFrame();
  }

  // --- レンダリング処理 ---

  public renderCurrentFrame() {
    const bw = this.baseWidth;
    const bh = this.baseHeight;
    const progress = this.totalFrames > 1 ? this.currentFrame / (this.totalFrames - 1) : 0;

    if (this.backgroundMode === 'matte') {
      this.displayCtx.fillStyle = '#000000';
      this.displayCtx.fillRect(0, 0, bw, bh);
      this.currentPreset.renderMatte(
        this.displayCtx,
        progress,
        this.currentFrame,
        this.totalFrames,
        bw,
        bh,
        this.currentOptions
      );
    } else if (this.backgroundMode === 'side_by_side') {
      // 左半分 (0〜bw-1): 透過アニメーション（市松模様背景）
      this.drawCheckerboard(this.displayCtx, bw, bh);
      this.bufferCtx.clearRect(0, 0, bw, bh);
      this.currentPreset.render(
        this.bufferCtx,
        progress,
        this.currentFrame,
        this.totalFrames,
        bw,
        bh,
        this.currentOptions
      );
      renderLogoOverlay(this.bufferCtx, progress, bw, bh, this.logoOverlay);
      this.displayCtx.drawImage(this.bufferCanvas, 0, 0);

      // 右半分 (bw〜2*bw-1): トラックマット白黒マスク
      if (this.simMaskCanvas) {
        const maskCtx = this.simMaskCanvas.getContext('2d')!;
        maskCtx.fillStyle = '#000000';
        maskCtx.fillRect(0, 0, bw, bh);
        this.currentPreset.renderMatte(
          maskCtx,
          progress,
          this.currentFrame,
          this.totalFrames,
          bw,
          bh,
          this.currentOptions
        );
        this.displayCtx.drawImage(this.simMaskCanvas, bw, 0);
      }

      // 中央境界線
      this.displayCtx.fillStyle = 'rgba(255, 255, 255, 0.25)';
      this.displayCtx.fillRect(bw - 1, 0, 2, bh);
    } else {
      // 1. 背景描画
      this.drawBackground(this.displayCtx, bw, bh);

      // 2. アニメーションをバッファキャンバスに決定論的描画
      this.bufferCtx.clearRect(0, 0, bw, bh);
      this.currentPreset.render(
        this.bufferCtx,
        progress,
        this.currentFrame,
        this.totalFrames,
        bw,
        bh,
        this.currentOptions
      );
      renderLogoOverlay(this.bufferCtx, progress, bw, bh, this.logoOverlay);

      // 3. バッファをディスプレイキャンバスに合成
      this.displayCtx.drawImage(this.bufferCanvas, 0, 0);
    }

    // イベント通知
    if (this.isInitialized && this.events.onFrameUpdate) {
      this.events.onFrameUpdate(this.currentFrame, progress, this.totalFrames, this.fps);
    }
  }

  private drawBackground(ctx: CanvasRenderingContext2D, w: number, h: number) {
    if (this.backgroundMode === 'black') {
      ctx.fillStyle = '#0a0a0c';
      ctx.fillRect(0, 0, w, h);
    } else if (this.backgroundMode === 'green') {
      ctx.fillStyle = '#00ff00';
      ctx.fillRect(0, 0, w, h);
    } else if (this.backgroundMode === 'scene_sim') {
      // 疑似配信画面シミュレータ (OBS トラックマットの完全リアルタイム再現)
      // 1. まず Scene A (移行前) を描画
      if (this.sceneACanvas) {
        ctx.drawImage(this.sceneACanvas, 0, 0, w, h);
      }

      // 2. トラックマットマスクを用いて Scene B (移行後) を重ねる
      if (this.sceneBCanvas && this.simMaskCanvas && this.simBlendCanvas) {
        const maskCtx = this.simMaskCanvas.getContext('2d')!;
        const blendCtx = this.simBlendCanvas.getContext('2d')!;
        const progress = this.totalFrames > 1 ? this.currentFrame / (this.totalFrames - 1) : 0;

        // マスクキャンバスを透明クリアし、Scene B になる領域を白で描画
        maskCtx.clearRect(0, 0, w, h);
        this.currentPreset.renderMatte(
          maskCtx,
          progress,
          this.currentFrame,
          this.totalFrames,
          w,
          h,
          this.currentOptions
        );

        // Scene B を一時キャンバスに描き、マスクで切り抜き
        blendCtx.clearRect(0, 0, w, h);
        blendCtx.globalCompositeOperation = 'source-over';
        blendCtx.drawImage(this.sceneBCanvas, 0, 0, w, h);
        blendCtx.globalCompositeOperation = 'destination-in';
        blendCtx.drawImage(this.simMaskCanvas, 0, 0, w, h);

        // Scene A の上に Scene B の通過領域を合成
        ctx.drawImage(this.simBlendCanvas, 0, 0, w, h);
      }
    } else {
      // 市松模様 (Checkerboard)
      this.drawCheckerboard(ctx, w, h);
    }
  }

  private drawCheckerboard(ctx: CanvasRenderingContext2D, w: number, h: number) {
    const size = Math.max(8, Math.round(32 * (Math.min(w, h) / 1080)));
    ctx.fillStyle = '#18181b';
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = '#27272a';
    for (let y = 0; y < h; y += size) {
      for (let x = 0; x < w; x += size) {
        if ((Math.floor(x / size) + Math.floor(y / size)) % 2 === 0) {
          ctx.fillRect(x, y, size, size);
        }
      }
    }
  }

  private drawCoverImage(
    ctx: OffscreenCanvasRenderingContext2D,
    img: HTMLImageElement,
    w: number,
    h: number
  ) {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, w, h);
    const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
    const drawW = img.naturalWidth * scale;
    const drawH = img.naturalHeight * scale;
    const drawX = (w - drawW) / 2;
    const drawY = (h - drawH) / 2;
    ctx.drawImage(img, drawX, drawY, drawW, drawH);
  }

  private createSimScenes(w: number, h: number) {
    const shortSide = Math.min(w, h);
    const s = shortSide / 1080;
    const gridStep = Math.max(16, Math.round(80 * s));
    const padX = Math.round(64 * s);
    const titleY = Math.round(100 * s);
    const subY = Math.round(145 * s);
    const bigLetterSize = Math.round(shortSide * 0.72);
    const titleSize = Math.max(16, Math.round(34 * s));
    const subSize = Math.max(12, Math.round(19 * s));

    // シーンA: カスタム画像またはゲーム画面風モック
    this.sceneACanvas = new OffscreenCanvas(w, h);
    const ctxA = this.sceneACanvas.getContext('2d')!;
    if (
      this.customSceneAImage &&
      this.customSceneAImage.complete &&
      this.customSceneAImage.naturalWidth > 0
    ) {
      this.drawCoverImage(ctxA, this.customSceneAImage, w, h);
    } else {
      const gradA = ctxA.createLinearGradient(0, 0, w, h);
      gradA.addColorStop(0, '#1e1b4b');
      gradA.addColorStop(1, '#0f172a');
      ctxA.fillStyle = gradA;
      ctxA.fillRect(0, 0, w, h);

      // サイバーグリッド
      ctxA.strokeStyle = 'rgba(99, 102, 241, 0.15)';
      ctxA.lineWidth = Math.max(1, s);
      for (let x = 0; x < w; x += gridStep) {
        ctxA.beginPath();
        ctxA.moveTo(x, 0);
        ctxA.lineTo(x, h);
        ctxA.stroke();
      }
      for (let y = 0; y < h; y += gridStep) {
        ctxA.beginPath();
        ctxA.moveTo(0, y);
        ctxA.lineTo(w, y);
        ctxA.stroke();
      }

      // ゲームUIモック
      ctxA.font = `${bigLetterSize}px sans-serif`;
      ctxA.textAlign = 'center';
      ctxA.textBaseline = 'middle';
      ctxA.fillStyle = '#aaaaaa';
      ctxA.fillText('A', w / 2, h / 2);

      ctxA.textAlign = 'left';
      ctxA.textBaseline = 'bottom';
      ctxA.fillStyle = '#6366f1';
      ctxA.font = `bold ${titleSize}px sans-serif`;
      ctxA.fillText('🎮 SCENE A: GAMEPLAY (移行前シーン)', padX, titleY, w - padX * 2);

      ctxA.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctxA.font = `${subSize}px sans-serif`;
      ctxA.fillText(
        'スティンガー通過中... トラックマットの白領域に Scene B が展開されます',
        padX,
        subY,
        w - padX * 2
      );
    }

    // シーンB: カスタム画像または雑談・カメラ枠風モック
    this.sceneBCanvas = new OffscreenCanvas(w, h);
    const ctxB = this.sceneBCanvas.getContext('2d')!;
    if (
      this.customSceneBImage &&
      this.customSceneBImage.complete &&
      this.customSceneBImage.naturalWidth > 0
    ) {
      this.drawCoverImage(ctxB, this.customSceneBImage, w, h);
    } else {
      const gradB = ctxB.createLinearGradient(0, 0, w, h);
      gradB.addColorStop(0, '#312e81');
      gradB.addColorStop(1, '#3b0764');
      ctxB.fillStyle = gradB;
      ctxB.fillRect(0, 0, w, h);

      ctxB.font = `${bigLetterSize}px sans-serif`;
      ctxB.textAlign = 'center';
      ctxB.textBaseline = 'middle';
      ctxB.fillStyle = '#aaaaaa';
      ctxB.fillText('B', w / 2, h / 2);

      ctxB.textAlign = 'left';
      ctxB.textBaseline = 'bottom';
      ctxB.fillStyle = '#f43f5e';
      ctxB.font = `bold ${titleSize}px sans-serif`;
      ctxB.fillText('🎙️ SCENE B: JUST CHATTING (移行後シーン)', padX, titleY, w - padX * 2);

      ctxB.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctxB.font = `${subSize}px sans-serif`;
      ctxB.fillText(
        'トラックマット通過完了！ 新しいシーンへ移行しました',
        padX,
        subY,
        w - padX * 2
      );

      // カメラ枠
      const camW = Math.min(Math.round(480 * s), w - padX * 2);
      const camH = Math.round((camW * 9) / 16);
      const camY = Math.round(190 * s);
      ctxB.strokeStyle = '#ec4899';
      ctxB.lineWidth = Math.max(2, Math.round(4 * s));
      ctxB.strokeRect(padX, camY, camW, camH);
      ctxB.fillStyle = 'rgba(0,0,0,0.5)';
      ctxB.fillRect(padX, camY, camW, camH);
      ctxB.fillStyle = '#ffffff';
      ctxB.textAlign = 'center';
      ctxB.textBaseline = 'middle';
      ctxB.font = `${Math.max(12, Math.round(18 * s))}px sans-serif`;
      ctxB.fillText('CAMERA FRAME', padX + camW / 2, camY + camH / 2);
    }

    // 合成用キャンバス
    this.simMaskCanvas = new OffscreenCanvas(w, h);
    this.simBlendCanvas = new OffscreenCanvas(w, h);
  }
}
