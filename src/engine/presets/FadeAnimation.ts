import { BasePresetOptions, PresetPlugin } from '../../types';
import { clamp01, easeInOutCubic } from '../utils/easing';

export type FadeMode = 'cross' | 'dip';
export type FadeEasingType = 'smooth' | 'linear';

export interface FadePresetOptions extends BasePresetOptions {
  fadeMode: FadeMode;
  holdDuration: number;
  easingType: FadeEasingType;
}

export const defaultFadeOptions: FadePresetOptions = {
  primaryColor: '#09090b', // ディープブラック（カラーフェード時の暗転ベース）
  secondaryColor: '#18181b',
  accentColor: '#ffffff',
  borderColor: '#ffffff',
  borderWidth: 0,
  hasGlow: false,
  glowColor: '#ffffff',
  glowBlur: 0,
  fadeMode: 'cross',
  holdDuration: 0.2,
  easingType: 'smooth',
};

function applyFadeCurve(t: number, easingType: FadeEasingType): number {
  const clamped = clamp01(t);
  return easingType === 'linear' ? clamped : easeInOutCubic(clamped);
}

function getDipPhaseBounds(holdDuration: number): { fadeInEnd: number; holdEnd: number } {
  const hold = Math.max(0, Math.min(0.6, holdDuration));
  const fadeInEnd = (1 - hold) / 2;
  const holdEnd = 1 - fadeInEnd;
  return { fadeInEnd, holdEnd };
}

export const FadeAnimationPlugin: PresetPlugin<FadePresetOptions> = {
  id: 'fade',
  name: 'FADE (シンプルフェード)',
  category: 'ロゴ向け',
  description:
    '余計な装飾を省いた超シンプルなフェードトランジション。クロスフェード（ロゴのみ表示）とカラーフェード（暗転・テーマ色経由）を切り替えられます。',
  defaultOptions: defaultFadeOptions,
  params: [
    {
      key: 'fadeMode',
      type: 'select',
      label: 'フェード方式',
      options: [
        { value: 'cross', label: 'クロスフェード（ロゴのみ）' },
        { value: 'dip', label: 'カラーフェード（暗転 / 色経由）' },
      ],
    },
    {
      key: 'holdDuration',
      type: 'range',
      label: 'ホールド時間',
      min: 0,
      max: 0.6,
      step: 0.05,
      format: 'percent',
      visibleWhen: { key: 'fadeMode', equals: 'dip' },
    },
    {
      key: 'easingType',
      type: 'select',
      label: 'フェード曲線',
      options: [
        { value: 'smooth', label: 'スムーズ (EaseInOut)' },
        { value: 'linear', label: 'リニア (一定速度)' },
      ],
    },
  ],

  render(ctx, progress, _frameIndex, _totalFrames, width, height, options) {
    ctx.clearRect(0, 0, width, height);

    // クロスフェード時は背景を描画せず完全透過を保つ（ロゴオーバーレイのみ表示）
    if (options.fadeMode !== 'dip') {
      return;
    }

    if (progress <= 0 || progress >= 1) {
      return;
    }

    const { fadeInEnd, holdEnd } = getDipPhaseBounds(options.holdDuration);
    let coverAlpha: number;

    if (progress < fadeInEnd) {
      coverAlpha = applyFadeCurve(progress / Math.max(0.001, fadeInEnd), options.easingType);
    } else if (progress <= holdEnd) {
      coverAlpha = 1;
    } else {
      const outT = (progress - holdEnd) / Math.max(0.001, 1 - holdEnd);
      coverAlpha = 1 - applyFadeCurve(outT, options.easingType);
    }

    if (coverAlpha <= 0.001) {
      return;
    }

    ctx.save();
    ctx.globalAlpha = clamp01(coverAlpha);
    ctx.fillStyle = options.primaryColor;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  },

  renderMatte(ctx, progress, _frameIndex, _totalFrames, width, height, options) {
    if (progress <= 0) {
      return;
    }

    if (progress >= 1) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
      return;
    }

    if (options.fadeMode === 'dip') {
      // カラーフェード時は完全不透明で覆われた瞬間に Scene B (白) へ一括切替
      const { fadeInEnd } = getDipPhaseBounds(options.holdDuration);
      if (progress >= fadeInEnd) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
      }
      return;
    }

    // クロスフェード時は半透明の白で描画し、OBS 書き出し（グレースケール Luma）と
    // プレビューシミュレータ（destination-in アルファ合成）の双方で滑らかにブレンドする
    const alpha = applyFadeCurve(progress, options.easingType);
    if (alpha <= 0.001) {
      return;
    }

    ctx.save();
    ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  },
};
