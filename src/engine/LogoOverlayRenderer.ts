import { LogoOverlayAnimation, LogoOverlayOptions } from '../types';
import { clamp01, easeInOutCubic, easeOutBack, easeOutBurst } from './utils/easing';

export const LOGO_OVERLAY_MIN_DURATION = 0.05;

export const LOGO_OVERLAY_ANIMATIONS: ReadonlyArray<{
  value: LogoOverlayAnimation;
  label: string;
}> = [
  { value: 'pop', label: 'ポップ拡大' },
  { value: 'fade', label: 'フェード' },
  { value: 'zoom', label: 'スムーズズーム' },
  { value: 'slide-up', label: '下からスライド' },
  { value: 'slide-down', label: '上からスライド' },
];

export const DEFAULT_LOGO_OVERLAY_OPTIONS: Readonly<LogoOverlayOptions> = {
  enabled: false,
  image: null,
  animation: 'pop',
  scale: 0.35,
  offsetX: 0,
  offsetY: 0,
  startProgress: 0.2,
  endProgress: 0.8,
  transitionRatio: 0.25,
  hasShadow: true,
  shadowColor: '#000000',
  shadowBlur: 20,
};

export interface LogoOverlayFrameState {
  visible: boolean;
  alpha: number;
  scaleMultiplier: number;
  offsetYPx: number;
}

/**
 * 指定された progress (0.0〜1.0) におけるロゴオーバーレイの描画状態を決定論的に算出する。
 * progress が表示区間外（0.0 や 1.0 を含む境界値）の場合は必ず visible: false を返す。
 */
export function computeLogoOverlayState(
  progress: number,
  height: number,
  options: LogoOverlayOptions
): LogoOverlayFrameState {
  const start = clamp01(options.startProgress);
  const end = clamp01(options.endProgress);

  if (end <= start || progress <= start || progress >= end) {
    return { visible: false, alpha: 0, scaleMultiplier: 1, offsetYPx: 0 };
  }

  const localT = (progress - start) / (end - start);
  const edge = Math.min(0.5, Math.max(0.05, options.transitionRatio));

  if (localT >= edge && localT <= 1 - edge) {
    return { visible: true, alpha: 1, scaleMultiplier: 1, offsetYPx: 0 };
  }

  const isIn = localT < edge;
  const t = isIn ? localT / edge : (1 - localT) / edge;

  let alpha = 1;
  let scaleMultiplier = 1;
  let offsetYPx = 0;

  switch (options.animation) {
    case 'fade':
      alpha = easeInOutCubic(t);
      break;
    case 'pop':
      if (isIn) {
        alpha = clamp01(t * 1.4);
        scaleMultiplier = 0.5 + 0.5 * easeOutBack(t);
      } else {
        alpha = easeInOutCubic(t);
        scaleMultiplier = 0.75 + 0.25 * easeInOutCubic(t);
      }
      break;
    case 'zoom':
      alpha = easeInOutCubic(t);
      scaleMultiplier = isIn ? 0.7 + 0.3 * easeInOutCubic(t) : 1.0 + 0.25 * (1 - easeInOutCubic(t));
      break;
    case 'slide-up':
      alpha = easeInOutCubic(t);
      offsetYPx = isIn
        ? height * 0.08 * (1 - easeOutBurst(t))
        : -height * 0.06 * (1 - easeInOutCubic(t));
      break;
    case 'slide-down':
      alpha = easeInOutCubic(t);
      offsetYPx = isIn
        ? -height * 0.08 * (1 - easeOutBurst(t))
        : height * 0.06 * (1 - easeInOutCubic(t));
      break;
  }

  if (alpha <= 0.001) {
    return { visible: false, alpha: 0, scaleMultiplier: 1, offsetYPx: 0 };
  }

  return {
    visible: true,
    alpha: clamp01(alpha),
    scaleMultiplier,
    offsetYPx,
  };
}

/**
 * ロゴ画像オーバーレイを指定キャンバスへ決定論的に描画する
 */
export function renderLogoOverlay(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  progress: number,
  width: number,
  height: number,
  options: LogoOverlayOptions
): void {
  if (!options.enabled || !options.image) {
    return;
  }

  const img = options.image as HTMLImageElement & { width?: number; height?: number };
  if (typeof (img as any).complete === 'boolean' && !(img as any).complete) {
    return;
  }

  const imgW = img.naturalWidth || img.width || 0;
  const imgH = img.naturalHeight || img.height || 0;
  if (imgW <= 0 || imgH <= 0) {
    return;
  }

  const state = computeLogoOverlayState(progress, height, options);
  if (!state.visible) {
    return;
  }

  const targetLongSide = height * options.scale;
  const fitScale = targetLongSide / Math.max(imgW, imgH);
  const drawW = imgW * fitScale;
  const drawH = imgH * fitScale;

  const cx = width * (0.5 + options.offsetX);
  const cy = height * (0.5 + options.offsetY) + state.offsetYPx;

  ctx.save();
  ctx.globalAlpha = state.alpha;
  ctx.translate(cx, cy);
  ctx.scale(state.scaleMultiplier, state.scaleMultiplier);

  if (options.hasShadow && options.shadowBlur > 0) {
    ctx.shadowColor = options.shadowColor;
    ctx.shadowBlur = options.shadowBlur * (height / 1080);
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
  }

  ctx.drawImage(options.image, -drawW / 2, -drawH / 2, drawW, drawH);
  ctx.restore();
}
