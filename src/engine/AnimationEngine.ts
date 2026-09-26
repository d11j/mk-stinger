import { PresetPlugin, TransitionAnalysis } from '../types';
import { TransitionAnalyzer } from './TransitionAnalyzer';

export type BackgroundMode = 'checkerboard' | 'black' | 'green' | 'scene_sim';

export interface EngineEvents {
  onFrameUpdate?: (frame: number, progress: number, totalFrames: number, fps: number) => void;
  onAnalysisUpdate?: (analysis: TransitionAnalysis) => void;
  onPlayStateChange?: (isPlaying: boolean) => void;
}

export class AnimationEngine {
  private displayCanvas: HTMLCanvasElement;
  private displayCtx: CanvasRenderingContext2D;

  private bufferCanvas: OffscreenCanvas;
  private bufferCtx: OffscreenCanvasRenderingContext2D;

  private analyzer: TransitionAnalyzer;

  // 内部状態
  private currentPreset: PresetPlugin<any>;
  private currentOptions: any;
  private fps: 30 | 60 = 60;
  private durationSec: number = 2.0;
  private totalFrames: number = 120;
  private currentFrame: number = 0;

  private isPlaying: boolean = false;
  private isLooping: boolean = true;
  private playTimerId: number | null = null;
  private backgroundMode: BackgroundMode = 'checkerboard';

  private transitionAnalysis: TransitionAnalysis | null = null;
  private manualCutFrame: number | null = null;

  private events: EngineEvents = {};
  private isInitialized: boolean = false;

  // 疑似配信画面用のパターンキャンバス
  private sceneACanvas: OffscreenCanvas | null = null;
  private sceneBCanvas: OffscreenCanvas | null = null;
  private simMaskCanvas: OffscreenCanvas | null = null;
  private simBlendCanvas: OffscreenCanvas | null = null;

  constructor(
    displayCanvas: HTMLCanvasElement,
    preset: PresetPlugin<any>,
    options: any
  ) {
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

    this.analyzer = new TransitionAnalyzer(width, height);
    this.updateTotalFrames();
    this.createSimScenes(width, height);

    this.transitionAnalysis = this.analyzer.analyze(
      this.currentPreset,
      this.currentOptions,
      this.totalFrames,
      this.fps,
      width,
      height
    );
    this.renderCurrentFrame();
  }

  public init(events: EngineEvents = {}) {
    this.events = events;
    this.isInitialized = true;
    if (this.events.onAnalysisUpdate && this.transitionAnalysis) {
      this.events.onAnalysisUpdate(this.transitionAnalysis);
    }
    if (this.events.onFrameUpdate) {
      this.events.onFrameUpdate(this.currentFrame, 0, this.totalFrames, this.fps);
    }
  }

  public setEvents(events: EngineEvents) {
    this.events = { ...this.events, ...events };
  }

  public resize(width: number, height: number) {
    if (this.displayCanvas.width === width && this.displayCanvas.height === height) return;
    this.displayCanvas.width = width;
    this.displayCanvas.height = height;
    this.bufferCanvas.width = width;
    this.bufferCanvas.height = height;
    this.createSimScenes(width, height);
    this.recalculateTransition();
    this.renderCurrentFrame();
  }

  public setConfig(fps: 30 | 60, durationSec: number) {
    const changed = this.fps !== fps || this.durationSec !== durationSec;
    this.fps = fps;
    this.durationSec = durationSec;
    if (changed) {
      this.updateTotalFrames();
      this.recalculateTransition();
      this.renderCurrentFrame();
    }
  }

  public setPreset(preset: PresetPlugin<any>, options?: any) {
    this.currentPreset = preset;
    this.currentOptions = options ? { ...options } : { ...preset.defaultOptions };
    this.recalculateTransition();
    this.renderCurrentFrame();
  }

  public updateOptions(options: any) {
    this.currentOptions = { ...this.currentOptions, ...options };
    this.recalculateTransition();
    this.renderCurrentFrame();
  }

  public setBackgroundMode(mode: BackgroundMode) {
    this.backgroundMode = mode;
    this.renderCurrentFrame();
  }

  public getBackgroundMode(): BackgroundMode {
    return this.backgroundMode;
  }

  public setManualCutFrame(frame: number | null) {
    this.manualCutFrame = frame;
    this.renderCurrentFrame();
  }

  public getEffectiveCutFrame(): number {
    if (this.manualCutFrame !== null) {
      return this.manualCutFrame;
    }
    return this.transitionAnalysis?.transitionFrame ?? Math.floor(this.totalFrames / 2);
  }

  public getEffectiveCutMs(): number {
    const frame = this.getEffectiveCutFrame();
    return Math.round((frame / this.fps) * 1000);
  }

  public getTransitionAnalysis(): TransitionAnalysis | null {
    return this.transitionAnalysis;
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

  public recalculateTransition() {
    const w = this.displayCanvas.width;
    const h = this.displayCanvas.height;
    this.transitionAnalysis = this.analyzer.analyze(
      this.currentPreset,
      this.currentOptions,
      this.totalFrames,
      this.fps,
      w,
      h
    );
    if (this.events.onAnalysisUpdate) {
      this.events.onAnalysisUpdate(this.transitionAnalysis);
    }
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
    const w = this.displayCanvas.width;
    const h = this.displayCanvas.height;
    const progress = this.totalFrames > 1 ? this.currentFrame / (this.totalFrames - 1) : 0;

    // 1. 背景描画
    this.drawBackground(this.displayCtx, w, h);

    // 2. アニメーションをバッファキャンバスに決定論的描画
    this.bufferCtx.clearRect(0, 0, w, h);
    this.currentPreset.render(
      this.bufferCtx,
      progress,
      this.currentFrame,
      this.totalFrames,
      w,
      h,
      this.currentOptions
    );

    // 3. バッファをディスプレイキャンバスに合成
    this.displayCtx.drawImage(this.bufferCanvas, 0, 0);

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
        const cutFrame = this.getEffectiveCutFrame();
        const progress = this.totalFrames > 1 ? this.currentFrame / (this.totalFrames - 1) : 0;

        // マスクキャンバスを透明クリアし、Scene B になる領域を白で描画
        maskCtx.clearRect(0, 0, w, h);
        if (typeof this.currentPreset.renderMatte === 'function') {
          this.currentPreset.renderMatte(
            maskCtx,
            progress,
            this.currentFrame,
            this.totalFrames,
            w,
            h,
            this.currentOptions,
            cutFrame
          );
        } else {
          // デフォルト: cutFrame 以降は白
          if (this.currentFrame >= cutFrame) {
            maskCtx.fillStyle = '#ffffff';
            maskCtx.fillRect(0, 0, w, h);
          }
        }

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
    const size = 32;
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

  private createSimScenes(w: number, h: number) {
    // シーンA: ゲーム画面風
    this.sceneACanvas = new OffscreenCanvas(w, h);
    const ctxA = this.sceneACanvas.getContext('2d')!;
    const gradA = ctxA.createLinearGradient(0, 0, w, h);
    gradA.addColorStop(0, '#1e1b4b');
    gradA.addColorStop(1, '#0f172a');
    ctxA.fillStyle = gradA;
    ctxA.fillRect(0, 0, w, h);

    // サイバーグリッド
    ctxA.strokeStyle = 'rgba(99, 102, 241, 0.15)';
    ctxA.lineWidth = 1;
    for (let x = 0; x < w; x += 80) {
      ctxA.beginPath();
      ctxA.moveTo(x, 0);
      ctxA.lineTo(x, h);
      ctxA.stroke();
    }
    for (let y = 0; y < h; y += 80) {
      ctxA.beginPath();
      ctxA.moveTo(0, y);
      ctxA.lineTo(w, y);
      ctxA.stroke();
    }

    // ゲームUIモック
    ctxA.fillStyle = '#6366f1';
    ctxA.font = 'bold 36px sans-serif';
    ctxA.fillText('🎮 SCENE A: GAMEPLAY (移行前シーン)', 80, 100);

    ctxA.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctxA.font = '20px sans-serif';
    ctxA.fillText('スティンガー通過中... トラックマットの白領域に Scene B が展開されます', 80, 150);

    // シーンB: 雑談・カメラ枠風
    this.sceneBCanvas = new OffscreenCanvas(w, h);
    const ctxB = this.sceneBCanvas.getContext('2d')!;
    const gradB = ctxB.createLinearGradient(0, 0, w, h);
    gradB.addColorStop(0, '#312e81');
    gradB.addColorStop(1, '#3b0764');
    ctxB.fillStyle = gradB;
    ctxB.fillRect(0, 0, w, h);

    ctxB.fillStyle = '#f43f5e';
    ctxB.font = 'bold 36px sans-serif';
    ctxB.fillText('🎙️ SCENE B: JUST CHATTING (移行後シーン)', 80, 100);

    ctxB.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctxB.font = '20px sans-serif';
    ctxB.fillText('トラックマット通過完了！ 新しいシーンへ不可逆的に移行しました', 80, 150);

    // カメラ枠
    ctxB.strokeStyle = '#ec4899';
    ctxB.lineWidth = 4;
    ctxB.strokeRect(80, 200, 480, 270);
    ctxB.fillStyle = 'rgba(0,0,0,0.5)';
    ctxB.fillRect(80, 200, 480, 270);
    ctxB.fillStyle = '#ffffff';
    ctxB.font = '18px sans-serif';
    ctxB.fillText('CAMERA FRAME', 220, 340);

    // 合成用キャンバス
    this.simMaskCanvas = new OffscreenCanvas(w, h);
    this.simBlendCanvas = new OffscreenCanvas(w, h);
  }
}
