export type ResolutionPreset = '1080p' | '720p';

export interface Resolution {
  width: number;
  height: number;
  label: string;
}

export const RESOLUTIONS: Record<ResolutionPreset, Resolution> = {
  '1080p': { width: 1920, height: 1080, label: '1080p (Full HD - 1920×1080)' },
  '720p': { width: 1280, height: 720, label: '720p (HD - 1280×720)' },
};

export type ExportFormat = 'trackmatte-mp4' | 'trackmatte-webm' | 'direct-webm';

export interface ExportConfig {
  resolutionKey: ResolutionPreset;
  resolution: Resolution;
  fps: 30 | 60;
  format: ExportFormat;
  durationSec: number;
  bitrateMbps: number;
}

export interface TransitionAnalysis {
  startFrame: number;
  endFrame: number;
  transitionFrame: number;
  transitionMs: number;
  isFullyCovered: boolean;
  coverages: number[]; // 0.0 to 1.0 for each frame
}

export interface BasePresetOptions {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  borderColor: string;
  borderWidth: number;
  hasGlow: boolean;
  glowColor: string;
  glowBlur: number;
  patternScale: number;
}

export interface HexPresetOptions extends BasePresetOptions {
  staggerDelay: number;
  shrinkScale: number;
  rotationEffect: boolean;
}

export type SpriteType = 'star' | 'heart' | 'sparkle' | 'diamond' | 'circle' | 'custom';

export interface SpriteWipePresetOptions extends BasePresetOptions {
  angleDeg: number; // 傾き角度 (度)
  spriteType: SpriteType; // スプライトの形状
  spriteCount: number; // スプライトの個数
  spriteSize: number; // スプライトの基本サイズ (px)
  sizeScatter: number; // スプライトサイズの散布幅・ばらつき倍率 (0.0 〜 1.0)
  spriteScatter: number; // ラインからの散布幅 (px)
  spriteRotate: boolean; // 自転エフェクト
  customImage: HTMLImageElement | null; // アップロード画像（永続化なし）
}

export interface PresetPlugin<T = any> {
  id: string;
  name: string;
  category: string;
  description: string;
  defaultOptions: T;
  render: (
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    progress: number,
    frameIndex: number,
    totalFrames: number,
    width: number,
    height: number,
    options: T
  ) => void;
  /**
   * OBS トラックマット用マスク描画関数
   * 黒 (#000000) = Scene A, 白 (#ffffff) = Scene B
   * 省略時はカットポイント切替 (cutFrame 前は黒、以降は白) が自動適用される
   */
  renderMatte?: (
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    progress: number,
    frameIndex: number,
    totalFrames: number,
    width: number,
    height: number,
    options: T,
    cutFrame: number
  ) => void;
}

export interface RenderState {
  currentFrame: number;
  totalFrames: number;
  fps: number;
  durationSec: number;
  isPlaying: boolean;
  isExporting: boolean;
  exportProgress: number;
  exportStatusText: string;
  transitionPoint: TransitionAnalysis | null;
  manualCutFrame: number | null;
}
