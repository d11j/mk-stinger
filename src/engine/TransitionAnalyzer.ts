import { PresetPlugin, TransitionAnalysis } from '../types';

export class TransitionAnalyzer {
  private sampleWidth = 64;
  private sampleHeight = 36;
  private offscreenCanvas: OffscreenCanvas;
  private offscreenCtx: OffscreenCanvasRenderingContext2D;
  private sampleCanvas: OffscreenCanvas;
  private sampleCtx: OffscreenCanvasRenderingContext2D;

  constructor(renderWidth = 1920, renderHeight = 1080) {
    this.offscreenCanvas = new OffscreenCanvas(renderWidth, renderHeight);
    this.offscreenCtx = this.offscreenCanvas.getContext('2d', {
      willReadFrequently: false,
    })!;

    this.sampleCanvas = new OffscreenCanvas(this.sampleWidth, this.sampleHeight);
    this.sampleCtx = this.sampleCanvas.getContext('2d', {
      willReadFrequently: true,
    })!;
  }

  public resize(width: number, height: number) {
    this.offscreenCanvas.width = width;
    this.offscreenCanvas.height = height;
    // 16:9 比率を維持したサンプルサイズ
    this.sampleHeight = Math.round((this.sampleWidth * height) / width);
    this.sampleCanvas.width = this.sampleWidth;
    this.sampleCanvas.height = this.sampleHeight;
  }

  /**
   * 全フレームを高速スキャンしてカットポイント（完全不透明区間）を自動算出
   */
  public analyze(
    preset: PresetPlugin<any>,
    options: any,
    totalFrames: number,
    fps: number,
    renderWidth: number,
    renderHeight: number
  ): TransitionAnalysis {
    this.resize(renderWidth, renderHeight);

    let startFrame = -1;
    let endFrame = -1;
    const coverages: number[] = new Array(totalFrames);
    const totalSamplePixels = this.sampleWidth * this.sampleHeight;

    let maxCoverage = 0;
    let maxCoverageFrame = Math.floor(totalFrames / 2);

    for (let f = 0; f < totalFrames; f++) {
      const progress = totalFrames > 1 ? f / (totalFrames - 1) : 0;

      // 1. フレーム描画
      this.offscreenCtx.clearRect(0, 0, renderWidth, renderHeight);
      preset.render(
        this.offscreenCtx,
        progress,
        f,
        totalFrames,
        renderWidth,
        renderHeight,
        options
      );

      // 2. 縮小バッファへ転写
      this.sampleCtx.clearRect(0, 0, this.sampleWidth, this.sampleHeight);
      this.sampleCtx.drawImage(
        this.offscreenCanvas,
        0,
        0,
        this.sampleWidth,
        this.sampleHeight
      );

      // 3. ピクセル走査
      const imgData = this.sampleCtx.getImageData(
        0,
        0,
        this.sampleWidth,
        this.sampleHeight
      );
      const data = imgData.data;
      let opaquePixels = 0;

      // 4バイトおきにアルファ値を検査
      for (let i = 3; i < data.length; i += 4) {
        if (data[i] >= 253) {
          opaquePixels++;
        }
      }

      const coverage = opaquePixels / totalSamplePixels;
      coverages[f] = coverage;

      if (coverage > maxCoverage) {
        maxCoverage = coverage;
        maxCoverageFrame = f;
      }

      // 完全不透明（99.8%以上で許容、縮小補間による端の微小ロスを考慮）
      const isOpaque = coverage >= 0.998;

      if (isOpaque) {
        if (startFrame === -1) {
          startFrame = f;
        }
        endFrame = f;
      }
    }

    const isFullyCovered = startFrame !== -1 && endFrame !== -1;
    const transitionFrame = isFullyCovered
      ? Math.floor((startFrame + endFrame) / 2)
      : maxCoverageFrame;

    const transitionMs = Math.round((transitionFrame / fps) * 1000);

    return {
      startFrame: isFullyCovered ? startFrame : maxCoverageFrame,
      endFrame: isFullyCovered ? endFrame : maxCoverageFrame,
      transitionFrame,
      transitionMs,
      isFullyCovered,
      coverages,
    };
  }
}
