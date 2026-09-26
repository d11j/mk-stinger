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
