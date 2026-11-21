import { BasePresetOptions, PresetPlugin } from '../../types';
import { easeInCharge, easeOutBurst } from '../utils/easing';

export interface HyperJumpPresetOptions extends BasePresetOptions {
  effectScale: number;
}

export const defaultHyperJumpOptions: HyperJumpPresetOptions = {
  primaryColor: '#00f0ff', // ハイパースペース・シアン
  secondaryColor: '#0284c7', // ディープブルー
  accentColor: '#e0f2fe', // アイスホワイトブルー
  borderColor: '#ffffff', // ホワイトコア
  borderWidth: 8,
  hasGlow: true,
  glowColor: '#00f0ff',
  glowBlur: 30,
  effectScale: 1.0,
};

const SPLIT_PROGRESS = 0.55;

/**
 * 決定論的な擬似乱数 (0.0 〜 1.0)
 */
function seededValue(index: number, salt: number): number {
  const x = Math.sin(index * 127.1 + salt * 311.7) * 43758.5453123;
  return x - Math.floor(x);
}

export const HyperJumpAnimationPlugin: PresetPlugin<HyperJumpPresetOptions> = {
  id: 'hyper-jump',
  name: 'HYPER JUMP (ハイパージャンプ)',
  category: 'トラックマット特化',
  description:
    '画面外側から中心へ光のリングが収縮してエネルギーを溜め、中心到達のフラッシュと同時に次シーンが中心から外側へ一気に広がるFSDジャンプ風トランジション。',
  defaultOptions: defaultHyperJumpOptions,
  params: [
    {
      key: 'effectScale',
      type: 'range',
      label: 'エフェクト倍率',
      min: 0.5,
      max: 2.0,
      step: 0.1,
      unit: '×',
    },
  ],

  render(ctx, progress, _frameIndex, _totalFrames, width, height, options) {
    ctx.clearRect(0, 0, width, height);

    const cx = width / 2;
    const cy = height / 2;
    const maxR = Math.hypot(cx, cy) * 1.15;
    const resScale = Math.min(width, height) / 1080;
    const scale = (options.effectScale || 1.0) * resScale;

    const isInward = progress < SPLIT_PROGRESS;
    const phaseT = isInward
      ? progress / SPLIT_PROGRESS
      : (progress - SPLIT_PROGRESS) / (1.0 - SPLIT_PROGRESS);

    const currentR = isInward ? maxR * (1 - easeInCharge(phaseT)) : maxR * easeOutBurst(phaseT);

    // 画面端でのフェードイン / フェードアウト
    const edgeAlpha = isInward ? Math.min(1, phaseT / 0.12) : Math.min(1, (1 - phaseT) / 0.12);

    ctx.save();
    ctx.translate(cx, cy);

    // 1. 放射状ワープ流線（FSDハイパースペースの流線）
    const lineCount = 32;
    const warpIntensity = isInward
      ? 0.25 + 0.75 * easeInCharge(phaseT)
      : Math.max(0, 1 - Math.pow(phaseT, 0.7));

    if (warpIntensity > 0.01) {
      ctx.save();
      ctx.lineCap = 'round';

      for (let i = 0; i < lineCount; i++) {
        const angle = (i / lineCount) * Math.PI * 2 + (seededValue(i, 1) - 0.5) * 0.12;
        const speedFactor = 0.6 + seededValue(i, 2) * 0.8;
        const lenBase = (70 + seededValue(i, 3) * 160) * scale;
        const lineAlpha = (0.25 + seededValue(i, 4) * 0.55) * warpIntensity * edgeAlpha;

        let rStart: number;
        let rEnd: number;

        if (isInward) {
          // 収縮リングの外側〜周囲から中心に向かって流れ込む
          const travel = phaseT * 0.35 * maxR * speedFactor;
          rStart = Math.max(
            12 * scale,
            currentR + (40 + seededValue(i, 5) * 260) * scale - travel * 0.25
          );
          rEnd = rStart + lenBase * (0.5 + phaseT * 0.8);
        } else {
          // 中心から外側へ弾け飛ぶ流線
          const burstDist = currentR * (0.45 + 0.55 * speedFactor);
          rStart = Math.max(8 * scale, burstDist - lenBase * (1.1 - phaseT * 0.5));
          rEnd = burstDist + lenBase * 0.35;
        }

        if (rEnd > rStart && rEnd > 4 * scale) {
          const cos = Math.cos(angle);
          const sin = Math.sin(angle);

          ctx.strokeStyle = i % 3 === 0 ? options.accentColor : options.secondaryColor;
          ctx.lineWidth = (1.5 + seededValue(i, 6) * 2.2) * scale;
          ctx.globalAlpha = lineAlpha;

          ctx.beginPath();
          ctx.moveTo(cos * rStart, sin * rStart);
          ctx.lineTo(cos * rEnd, sin * rEnd);
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    // 2. 追従する残像サブリング
    const baseLineWidth = Math.max(1, options.borderWidth) * scale;
    const subRings = [
      { offset: 42 * scale, widthMul: 0.55, alpha: 0.45, color: options.secondaryColor },
      { offset: 90 * scale, widthMul: 0.3, alpha: 0.22, color: options.accentColor },
    ];

    for (const sub of subRings) {
      const subR = isInward ? currentR + sub.offset : currentR - sub.offset;
      if (subR > 2 * scale && subR < maxR * 1.2) {
        ctx.save();
        ctx.globalAlpha = sub.alpha * edgeAlpha;
        ctx.strokeStyle = sub.color;
        ctx.lineWidth = Math.max(1, baseLineWidth * sub.widthMul);
        ctx.beginPath();
        ctx.arc(0, 0, subR, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }

    // 3. メインリング（グロー＋ホワイトコア）
    if (currentR > 0.5) {
      ctx.save();
      ctx.globalAlpha = edgeAlpha;

      if (options.hasGlow) {
        ctx.shadowColor = options.glowColor || options.primaryColor;
        ctx.shadowBlur = (options.glowBlur || 30) * scale;
      }

      ctx.strokeStyle = options.primaryColor;
      ctx.lineWidth = baseLineWidth;
      ctx.beginPath();
      ctx.arc(0, 0, currentR, 0, Math.PI * 2);
      ctx.stroke();

      // 中心の鋭いホワイトコアライン
      if (baseLineWidth >= 2) {
        ctx.shadowBlur = 0;
        ctx.strokeStyle = options.borderColor || '#ffffff';
        ctx.lineWidth = Math.max(1.2 * scale, baseLineWidth * 0.35);
        ctx.beginPath();
        ctx.arc(0, 0, currentR, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.restore();
    }

    // 4. 中心到達時のフラッシュ（閃光）
    const distFromSplit = Math.abs(progress - SPLIT_PROGRESS);
    const flashWindow = 0.09;
    if (distFromSplit < flashWindow) {
      const flashStrength = Math.pow(1 - distFromSplit / flashWindow, 2);
      const flashRadius = (180 + 220 * (1 - distFromSplit / flashWindow)) * scale;

      ctx.save();
      const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, flashRadius);
      grad.addColorStop(0, `rgba(255, 255, 255, ${0.95 * flashStrength})`);
      grad.addColorStop(0.25, options.accentColor);
      grad.addColorStop(0.55, options.primaryColor);
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.globalAlpha = flashStrength;
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(0, 0, flashRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    ctx.restore();
  },

  renderMatte(ctx, progress, _frameIndex, _totalFrames, width, height) {
    // 収縮フェーズ中は Scene A (#000000) を維持
    if (progress < SPLIT_PROGRESS) {
      return;
    }

    const cx = width / 2;
    const cy = height / 2;
    const maxR = Math.hypot(cx, cy) * 1.15;
    const phaseT = (progress - SPLIT_PROGRESS) / (1.0 - SPLIT_PROGRESS);
    const currentR = maxR * easeOutBurst(phaseT);

    if (currentR <= 0) return;

    // 中心から広がるリングの内側を白 (#ffffff = Scene B) で塗る
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, currentR, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.restore();
  },
};
