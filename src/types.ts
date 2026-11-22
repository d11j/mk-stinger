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

export interface ExportConfig {
  resolutionKey: ResolutionPreset;
  resolution: Resolution;
  fps: 30 | 60;
  durationSec: number;
  bitrateMbps: number;
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
}

export interface HexPresetOptions extends BasePresetOptions {
  staggerDelay: number;
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

export type LogoOverlayAnimation = 'pop' | 'fade' | 'zoom' | 'slide-up' | 'slide-down';

export interface LogoOverlayOptions {
  enabled: boolean;
  image: HTMLImageElement | null;
  animation: LogoOverlayAnimation;
  /** 画面高さに対するロゴ長辺の比率 (0.10 〜 0.80) */
  scale: number;
  /** X 位置オフセット (-0.50 〜 +0.50, 画面幅比) */
  offsetX: number;
  /** Y 位置オフセット (-0.50 〜 +0.50, 画面高さ比) */
  offsetY: number;
  /** 表示開始タイミング (0.00 〜 0.90) */
  startProgress: number;
  /** 表示終了タイミング (0.10 〜 1.00) */
  endProgress: number;
  /** 表示区間に対するイン/アウト遷移の片側比率 (0.05 〜 0.50) */
  transitionRatio: number;
  /** シャドウ・グロー効果の有効化 */
  hasShadow: boolean;
  /** シャドウ・グロー色 */
  shadowColor: string;
  /** シャドウ・グローぼかし量 (1080p 基準 px: 0 〜 50) */
  shadowBlur: number;
}

export interface ParamVisibilityCondition<T> {
  key: keyof T & string;
  equals: unknown;
}

interface BaseParamField<T> {
  key: keyof T & string;
  label: string;
  visibleWhen?: ParamVisibilityCondition<T>;
}

export interface RangeParamField<T> extends BaseParamField<T> {
  type: 'range';
  min: number;
  max: number;
  step: number;
  unit?: string;
  format?: 'number' | 'percent';
}

export interface BooleanParamField<T> extends BaseParamField<T> {
  type: 'boolean';
  checkboxLabel?: string;
}

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectParamField<T> extends BaseParamField<T> {
  type: 'select';
  options: SelectOption[];
}

export interface ImageParamField<T> extends BaseParamField<T> {
  type: 'image';
  accept?: string;
  hint?: string;
}

export type PresetParamField<T = any> =
  RangeParamField<T> | BooleanParamField<T> | SelectParamField<T> | ImageParamField<T>;

export interface PresetPlugin<T = any> {
  id: string;
  name: string;
  category: string;
  description: string;
  defaultOptions: T;
  params: PresetParamField<T>[];
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
   */
  renderMatte: (
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    progress: number,
    frameIndex: number,
    totalFrames: number,
    width: number,
    height: number,
    options: T
  ) => void;
}
