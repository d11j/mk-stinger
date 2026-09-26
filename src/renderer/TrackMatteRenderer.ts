import { PresetPlugin } from '../types';

export class TrackMatteRenderer {
  public outputCanvas: OffscreenCanvas;
  public outputCtx: OffscreenCanvasRenderingContext2D;

  private animCanvas: OffscreenCanvas;
  public animCtx: OffscreenCanvasRenderingContext2D;

  private maskCanvas: OffscreenCanvas;
  public maskCtx: OffscreenCanvasRenderingContext2D;

  private width: number;
  private height: number;

  constructor(baseWidth = 1920, baseHeight = 1080) {
    this.width = baseWidth;
    this.height = baseHeight;

    // トラックマット (Side-by-Side: 2 * width x height)
    // 左側のスティンガー映像でアルファチャンネル（背景透過）を保持するため alpha: true に設定
    this.outputCanvas = new OffscreenCanvas(baseWidth * 2, baseHeight);
    this.outputCtx = this.outputCanvas.getContext('2d', {
      alpha: true,
      desynchronized: true,
    })!;

    // アニメーション本体を描くキャンバス (アルファ付き)
    this.animCanvas = new OffscreenCanvas(baseWidth, baseHeight);
    this.animCtx = this.animCanvas.getContext('2d', {
      alpha: true,
      willReadFrequently: false,
    })!;

    // トラックマットマスク描画用キャンバス (黒: Scene A, 白: Scene B)
    this.maskCanvas = new OffscreenCanvas(baseWidth, baseHeight);
    this.maskCtx = this.maskCanvas.getContext('2d', {
      alpha: false,
      willReadFrequently: false,
    })!;
  }

  public resize(baseWidth: number, baseHeight: number) {
    if (this.width === baseWidth && this.height === baseHeight) return;
    this.width = baseWidth;
    this.height = baseHeight;

    this.outputCanvas.width = baseWidth * 2;
    this.outputCanvas.height = baseHeight;

    this.animCanvas.width = baseWidth;
    this.animCanvas.height = baseHeight;

    this.maskCanvas.width = baseWidth;
    this.maskCanvas.height = baseHeight;
  }

  /**
   * 単一フレームのアニメーションとトランジションマスクから Side-by-Side (3840x1080) トラックマットフレームを合成
   * - 左半分 (0〜w-1): スティンガー実映像 (背景透過・アルファチャンネル保持)
   * - 右半分 (w〜2w-1): トランジション進行マスク (不透明: 黒 Scene A, 白 Scene B)
   * @param preset プリセットプラグイン
   * @param progress アニメーション進行度 (0.0 - 1.0)
   * @param frameIndex フレーム番号
   * @param totalFrames 総フレーム数
   * @param options プリセットオプション
   * @param cutFrame トランジションポイント（カットフレーム）
   */
  public compositeSideBySide(
    preset: PresetPlugin<any>,
    progress: number,
    frameIndex: number,
    totalFrames: number,
    options: any,
    cutFrame: number
  ): OffscreenCanvas {
    const w = this.width;
    const h = this.height;

    // 出力キャンバス全体を完全透明にクリア
    this.outputCtx.clearRect(0, 0, w * 2, h);

    // --- 1. 左半分 (0〜w-1): アニメーション実映像 (アルファ透過) ---
    // 六角形などのオブジェクト部分のみが描画され、非充填部分は透明のまま保持される
    this.outputCtx.drawImage(this.animCanvas, 0, 0);

    // --- 2. 右半分 (w〜2w-1): トランジション進行マスク (黒: Scene A, 白: Scene B) ---
    // マスク領域は完全不透明 (Alpha=255) な黒・白が必要
    this.maskCtx.fillStyle = '#000000';
    this.maskCtx.fillRect(0, 0, w, h);

    if (typeof preset.renderMatte === 'function') {
      // プリセット固有のシェイプ追従型ワイプマスクを描画
      preset.renderMatte(
        this.maskCtx,
        progress,
        frameIndex,
        totalFrames,
        w,
        h,
        options,
        cutFrame
      );
    } else {
      // デフォルト: カットポイント切替型マスク (cutFrame 前は黒、以降は白)
      const isSceneB = frameIndex >= cutFrame;
      this.maskCtx.fillStyle = isSceneB ? '#ffffff' : '#000000';
      this.maskCtx.fillRect(0, 0, w, h);
    }

    // 右半分へマスクを転写
    this.outputCtx.drawImage(this.maskCanvas, w, 0);

    return this.outputCanvas;
  }

  public getAnimCanvas(): OffscreenCanvas {
    return this.animCanvas;
  }

  public getMaskCanvas(): OffscreenCanvas {
    return this.maskCanvas;
  }
}
