import { BasePresetOptions, PresetPlugin } from '../../types';
import { clamp01, easeInQuart, easeOutBurst } from '../utils/easing';

export type ShutterGateDirection = 'vertical' | 'horizontal';

export interface ShutterGatePresetOptions extends BasePresetOptions {
  direction: ShutterGateDirection;
  holdDuration: number;
  seamPosition: number;
  layerCount: number;
  impactFlash: boolean;
}

export const defaultShutterGateOptions: ShutterGatePresetOptions = {
  primaryColor: '#0f172a', // ダークスレート（メイン扉）
  secondaryColor: '#1e293b', // スレートグレー（中間層）
  accentColor: '#06b6d4', // シアン（先行アクセント層）
  borderColor: '#38bdf8', // スカイブルー（先端発光エッジ）
  borderWidth: 4,
  hasGlow: true,
  glowColor: '#06b6d4',
  glowBlur: 20,
  direction: 'vertical',
  holdDuration: 0.3,
  seamPosition: 0,
  layerCount: 3,
  impactFlash: true,
};

function getPhaseBounds(holdDuration: number): { closeEnd: number; holdEnd: number } {
  const hold = Math.max(0.1, Math.min(0.6, holdDuration));
  const closeEnd = (1 - hold) / 2;
  const holdEnd = 1 - closeEnd;
  return { closeEnd, holdEnd };
}

function getLayerColors(options: ShutterGatePresetOptions, layerCount: number): string[] {
  if (layerCount <= 1) {
    return [options.primaryColor];
  }
  if (layerCount === 2) {
    return [options.accentColor, options.primaryColor];
  }
  return [options.accentColor, options.secondaryColor, options.primaryColor];
}

function computeLayerProgress(
  progress: number,
  closeEnd: number,
  holdEnd: number,
  layerFromFront: number
): number {
  if (progress <= 0 || progress >= 1) {
    return 0;
  }

  if (progress < closeEnd) {
    // 先行層ほど少し早く合わせ目へ到達する
    const layerCloseEnd = Math.max(0.001, closeEnd * (1 - layerFromFront * 0.14));
    const rawT = clamp01(progress / layerCloseEnd);
    return easeInQuart(rawT);
  }

  if (progress <= holdEnd) {
    return 1;
  }

  // 開くときはメイン扉が先に開き、先行層がわずかに遅れて追従する
  const openSpan = Math.max(0.001, 1 - holdEnd);
  const layerDelay = openSpan * layerFromFront * 0.12;
  const layerOpenDuration = Math.max(0.001, openSpan - layerDelay);
  const rawOutT = clamp01((progress - holdEnd - layerDelay) / layerOpenDuration);
  return 1 - easeInQuart(rawOutT);
}

function drawDoorRect(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  isVertical: boolean,
  isSideA: boolean,
  length: number,
  width: number,
  height: number
): void {
  if (length <= 0) return;

  if (isVertical) {
    const y = isSideA ? 0 : height - length;
    ctx.fillRect(0, y, width, length);
  } else {
    const x = isSideA ? 0 : width - length;
    ctx.fillRect(x, 0, length, height);
  }
}

function drawDoorEdge(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  isVertical: boolean,
  edgePos: number,
  width: number,
  height: number,
  options: ShutterGatePresetOptions,
  scaleFactor: number
): void {
  if (options.borderWidth <= 0) return;

  ctx.save();
  ctx.strokeStyle = options.borderColor;
  ctx.lineWidth = options.borderWidth * scaleFactor;
  if (options.hasGlow && options.glowBlur > 0) {
    ctx.shadowColor = options.glowColor;
    ctx.shadowBlur = options.glowBlur * scaleFactor;
  }

  ctx.beginPath();
  if (isVertical) {
    ctx.moveTo(0, edgePos);
    ctx.lineTo(width, edgePos);
  } else {
    ctx.moveTo(edgePos, 0);
    ctx.lineTo(edgePos, height);
  }
  ctx.stroke();
  ctx.restore();
}

function drawImpactFlash(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  isVertical: boolean,
  seam: number,
  width: number,
  height: number,
  flashT: number,
  options: ShutterGatePresetOptions,
  scaleFactor: number
): void {
  const intensity = 1 - easeOutBurst(flashT);
  if (intensity <= 0.005) return;

  const span = isVertical ? height : width;
  const clampedSeam = Math.max(3 * scaleFactor, Math.min(span - 3 * scaleFactor, seam));
  const bandHalf = (22 + 34 * intensity) * scaleFactor;

  ctx.save();

  // 外側のソフトなグロー帯
  const grad = isVertical
    ? ctx.createLinearGradient(0, clampedSeam - bandHalf, 0, clampedSeam + bandHalf)
    : ctx.createLinearGradient(clampedSeam - bandHalf, 0, clampedSeam + bandHalf, 0);
  grad.addColorStop(0, 'rgba(255, 255, 255, 0)');
  grad.addColorStop(0.5, options.hasGlow ? options.glowColor : options.borderColor);
  grad.addColorStop(1, 'rgba(255, 255, 255, 0)');

  ctx.globalAlpha = intensity * 0.65;
  ctx.fillStyle = grad;
  if (isVertical) {
    ctx.fillRect(0, clampedSeam - bandHalf, width, bandHalf * 2);
  } else {
    ctx.fillRect(clampedSeam - bandHalf, 0, bandHalf * 2, height);
  }

  // 中心の鋭いホワイトコアライン
  ctx.globalAlpha = intensity * 0.95;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = Math.max(2, (options.borderWidth + 2) * intensity) * scaleFactor;
  if (options.hasGlow && options.glowBlur > 0) {
    ctx.shadowColor = options.glowColor;
    ctx.shadowBlur = options.glowBlur * 1.4 * scaleFactor;
  }

  ctx.beginPath();
  if (isVertical) {
    ctx.moveTo(0, clampedSeam);
    ctx.lineTo(width, clampedSeam);
  } else {
    ctx.moveTo(clampedSeam, 0);
    ctx.lineTo(clampedSeam, height);
  }
  ctx.stroke();

  ctx.restore();
}

export const ShutterGateAnimationPlugin: PresetPlugin<ShutterGatePresetOptions> = {
  id: 'shutter-gate',
  name: 'SHUTTER GATE (シャッターゲート)',
  category: 'ロゴ向け',
  description:
    '加速度をつけて上下（または左右）から重厚に閉じるレイヤーシャッター。全画面閉鎖後に一瞬ホールドし、ロゴオーバーレイを力強く際立たせます。',
  defaultOptions: defaultShutterGateOptions,
  params: [
    {
      key: 'direction',
      type: 'select',
      label: 'ゲート方向',
      options: [
        { value: 'vertical', label: '上下シャッター' },
        { value: 'horizontal', label: '左右シャッター' },
      ],
    },
    {
      key: 'seamPosition',
      type: 'range',
      label: '合わせ目の位置',
      min: -1,
      max: 1,
      step: 0.05,
      format: 'percent',
    },
    {
      key: 'holdDuration',
      type: 'range',
      label: 'ホールド時間',
      min: 0.1,
      max: 0.6,
      step: 0.05,
      format: 'percent',
    },
    {
      key: 'layerCount',
      type: 'range',
      label: 'レイヤー数',
      min: 1,
      max: 3,
      step: 1,
      unit: '層',
    },
    {
      key: 'impactFlash',
      type: 'boolean',
      label: '衝突フラッシュ',
    },
  ],

  render(ctx, progress, _frameIndex, _totalFrames, width, height, options) {
    ctx.clearRect(0, 0, width, height);

    if (progress <= 0 || progress >= 1) {
      return;
    }

    const { closeEnd, holdEnd } = getPhaseBounds(options.holdDuration);
    const isVertical = options.direction !== 'horizontal';
    const span = isVertical ? height : width;
    const seamRatio = clamp01((options.seamPosition + 1) / 2);
    const seam = span * seamRatio;
    const targetA = seam;
    const targetB = span - seam;

    const layerCount = Math.max(1, Math.min(3, Math.round(options.layerCount)));
    const colors = getLayerColors(options, layerCount);
    const scaleFactor = Math.min(width, height) / 1080;

    const isHoldPhase = progress >= closeEnd && progress <= holdEnd;

    // 背面（先行アクセント層）から前面（メイン扉）の順に描画
    for (let i = 0; i < layerCount; i++) {
      const layerFromFront = layerCount - 1 - i;
      const isMainDoor = layerFromFront === 0;

      // ホールド中はメイン扉が全画面を完全不透明で覆うため、背面層は描画をスキップ
      if (isHoldPhase && !isMainDoor) {
        continue;
      }

      const pLayer = computeLayerProgress(progress, closeEnd, holdEnd, layerFromFront);
      if (pLayer <= 0.0005) {
        continue;
      }

      const isClosed = pLayer >= 0.999;
      const overlap = isClosed ? 1.5 : 0;

      ctx.save();
      ctx.fillStyle = colors[i];

      if (targetA > 0.5) {
        const lenA = Math.min(span, targetA * pLayer + overlap);
        drawDoorRect(ctx, isVertical, true, lenA, width, height);
      }

      if (targetB > 0.5) {
        const lenB = Math.min(span, targetB * pLayer + overlap);
        drawDoorRect(ctx, isVertical, false, lenB, width, height);
      }

      // メイン扉に微細な奥行きグラデーションを重ねて立体感を演出（ロゴ視認性を損なわない範囲）
      if (isMainDoor) {
        const shadeGrad = isVertical
          ? ctx.createLinearGradient(0, 0, 0, height)
          : ctx.createLinearGradient(0, 0, width, 0);
        shadeGrad.addColorStop(0, 'rgba(0, 0, 0, 0.24)');
        shadeGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.03)');
        shadeGrad.addColorStop(1, 'rgba(0, 0, 0, 0.24)');
        ctx.fillStyle = shadeGrad;

        if (targetA > 0.5) {
          const lenA = Math.min(span, targetA * pLayer + overlap);
          drawDoorRect(ctx, isVertical, true, lenA, width, height);
        }
        if (targetB > 0.5) {
          const lenB = Math.min(span, targetB * pLayer + overlap);
          drawDoorRect(ctx, isVertical, false, lenB, width, height);
        }
      }

      // 移動中のみ先端エッジに発光ボーダーを描画（ホールド中はロゴを際立たせるため非表示）
      if (isMainDoor && !isClosed) {
        if (targetA > 0.5) {
          drawDoorEdge(ctx, isVertical, targetA * pLayer, width, height, options, scaleFactor);
        }
        if (targetB > 0.5) {
          drawDoorEdge(
            ctx,
            isVertical,
            span - targetB * pLayer,
            width,
            height,
            options,
            scaleFactor
          );
        }
      }

      ctx.restore();
    }

    // 閉じた瞬間の衝突フラッシュ演出
    if (options.impactFlash && progress >= closeEnd) {
      const flashDuration = Math.min(0.14, Math.max(0.06, (holdEnd - closeEnd) * 0.65));
      const flashT = (progress - closeEnd) / flashDuration;
      if (flashT >= 0 && flashT < 1) {
        drawImpactFlash(ctx, isVertical, seam, width, height, flashT, options, scaleFactor);
      }
    }
  },

  renderMatte(ctx, progress, _frameIndex, _totalFrames, width, height, options) {
    const { closeEnd } = getPhaseBounds(options.holdDuration);

    // ゲートが全画面を完全に覆った瞬間から Scene B (白) へ切り替える
    if (progress >= closeEnd) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
    }
  },
};
