import { Output, WebMOutputFormat, BufferTarget, CanvasSource } from 'mediabunny';
import { ExportConfig, PresetPlugin } from '../types';
import { TrackMatteRenderer } from '../renderer/TrackMatteRenderer';

export interface ExportProgressEvent {
  currentFrame: number;
  totalFrames: number;
  progressPercent: number; // 0 - 100
  stage: 'rendering' | 'encoding' | 'muxing' | 'completed' | 'error';
  statusMessage: string;
}

export interface ExportResult {
  blob: Blob;
  downloadUrl: string;
  filename: string;
  filesizeBytes: number;
  width: number;
  height: number;
  durationSec: number;
  fps: number;
  format: string;
}

export class VideoExportPipeline {
  private isAborted = false;

  public cancel() {
    this.isAborted = true;
  }

  /**
   * スティンガー動画をフレームごとにレンダリング・エンコード
   * WebM (VP9) では mediabunny の並列エンコーダ技術により、
   * Chromium の VideoEncoder 単体制限を回避して透過アルファチャンネルを保持して書き出します。
   */
  public async exportVideo(
    preset: PresetPlugin<any>,
    options: any,
    config: ExportConfig,
    onProgress: (ev: ExportProgressEvent) => void,
    cutFrame?: number
  ): Promise<ExportResult> {
    this.isAborted = false;

    // WebCodecs サポートチェック
    if (typeof window.VideoEncoder === 'undefined') {
      throw new Error(
        'お使いのブラウザは WebCodecs API (VideoEncoder) に対応していません。Chrome、Edge、または最新のモダンブラウザをご利用ください。'
      );
    }

    const { fps, durationSec, format, bitrateMbps } = config;
    const baseWidth = config.resolution.width;
    const baseHeight = config.resolution.height;
    const totalFrames = Math.max(2, Math.round(durationSec * fps));
    const bitrate = bitrateMbps * 1_000_000;

    const isTrackMatte = format === 'trackmatte-webm';
    const outputWidth = isTrackMatte ? baseWidth * 2 : baseWidth;
    const outputHeight = baseHeight;

    const trackMatteRenderer = new TrackMatteRenderer(baseWidth, baseHeight);

    // ソースキャンバス (TrackMatte またはアニメーション単体)
    const sourceCanvas = isTrackMatte
      ? trackMatteRenderer.outputCanvas
      : trackMatteRenderer.getAnimCanvas();

    const target = new BufferTarget();
    const outputFormat = new WebMOutputFormat();

    const output = new Output({
      format: outputFormat,
      target,
    });

    const videoSource = new CanvasSource(sourceCanvas, {
      codec: 'vp9',
      bitrate,
      alpha: 'keep',
      keyFrameInterval: 2,
    });

    output.addVideoTrack(videoSource);

    onProgress({
      currentFrame: 0,
      totalFrames,
      progressPercent: 0,
      stage: 'rendering',
      statusMessage: 'エンコーダを初期化しています...',
    });

    await output.start();

    try {
      const frameDurationSec = 1 / fps;
      const effectiveCutFrame = cutFrame ?? Math.floor(totalFrames / 2);

      // フレームごとの決定論的レンダリング & エンコードループ
      for (let f = 0; f < totalFrames; f++) {
        if (this.isAborted) {
          throw new Error('エクスポートがユーザーにより中止されました。');
        }

        const progress = totalFrames > 1 ? f / (totalFrames - 1) : 0;
        const timestampSec = f * frameDurationSec;

        // 1. アニメーションをオフスクリーンキャンバスに描画
        const animCtx = trackMatteRenderer.animCtx;
        animCtx.clearRect(0, 0, baseWidth, baseHeight);
        preset.render(
          animCtx,
          progress,
          f,
          totalFrames,
          baseWidth,
          baseHeight,
          options
        );

        if (isTrackMatte) {
          // 2. トラックマット合成 (左:透過アニメーション実映像 + 右:白黒移行マスク)
          trackMatteRenderer.compositeSideBySide(
            preset,
            progress,
            f,
            totalFrames,
            options,
            effectiveCutFrame
          );
        }

        // 3. mediabunny の CanvasSource にフレームを投入
        const isKeyFrame = f === 0 || f % 30 === 0;
        await videoSource.add(timestampSec, frameDurationSec, { keyFrame: isKeyFrame });

        // 進捗通知 (10フレーム毎または初回・最終フレーム)
        if (f % 5 === 0 || f === totalFrames - 1) {
          const percent = Math.round(((f + 1) / totalFrames) * 95);
          onProgress({
            currentFrame: f + 1,
            totalFrames,
            progressPercent: percent,
            stage: 'encoding',
            statusMessage: `フレームをエンコード中 (${f + 1}/${totalFrames})...`,
          });
        }
      }

      onProgress({
        currentFrame: totalFrames,
        totalFrames,
        progressPercent: 98,
        stage: 'muxing',
        statusMessage: '動画ファイルを多重化 (Muxing) しています...',
      });

      await output.finalize();

      const buffer = target.buffer;
      if (!buffer) {
        throw new Error('エンコード結果のバッファが空です。');
      }

      const mimeType = 'video/webm';
      const ext = 'webm';
      const blob = new Blob([buffer], { type: mimeType });
      const downloadUrl = URL.createObjectURL(blob);

      const resKey = config.resolutionKey;
      const cutSuffix = cutFrame !== undefined ? `_${cutFrame}f` : '';
      const filename = `stinger_${preset.id}_${resKey}_${fps}fps${cutSuffix}.${ext}`;

      onProgress({
        currentFrame: totalFrames,
        totalFrames,
        progressPercent: 100,
        stage: 'completed',
        statusMessage: 'エクスポートが完了しました！',
      });

      return {
        blob,
        downloadUrl,
        filename,
        filesizeBytes: blob.size,
        width: outputWidth,
        height: outputHeight,
        durationSec,
        fps,
        format,
      };
    } catch (err: any) {
      // エラー時はリソース解放
      try {
        await output.cancel();
      } catch (_) {}
      throw err;
    }
  }
}
