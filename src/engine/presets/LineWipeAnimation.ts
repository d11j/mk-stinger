import { BasePresetOptions, PresetPlugin } from '../../types';
import { easeInOutCubic } from '../utils/easing';

export interface LineWipePresetOptions extends BasePresetOptions {
  bandWidth: number; // メイン帯の幅 (px)
  angleDeg: number; // 傾き角度 (度)
  stripeCount: number; // 前後のサブライン本数
  speedLines: boolean; // スピードダッシュ・ライン描画
}

export const defaultLineWipeOptions: LineWipePresetOptions = {
  primaryColor: '#6366f1', // エレクトリックインディゴ
  secondaryColor: '#06b6d4', // シアン
  accentColor: '#f43f5e', // ネオンローズ
  borderColor: '#ffffff', // シャープホワイトエッジ
  borderWidth: 3,
  hasGlow: true,
  glowColor: '#06b6d4',
  glowBlur: 24,
  bandWidth: 180,
  angleDeg: 28,
  stripeCount: 3,
  speedLines: true,
};

function computeLineWipeGeometry(width: number, height: number, options: LineWipePresetOptions) {
  const resScale = Math.min(width, height) / 1080;
  const rad = (options.angleDeg * Math.PI) / 180;
  const tan = Math.tan(rad);
  const skewOffset = height * tan;

  const baseBandW = options.bandWidth * resScale;
  const glowMargin = options.hasGlow ? (options.glowBlur || 24) * resScale : 0;
  const totalExtra = Math.max(
    350 * resScale,
    baseBandW * 1.6 + options.borderWidth * resScale + glowMargin + 80 * resScale
  );

  // 移動範囲（画面外左から画面外右まで完全に抜け切るスパン）
  const startX = -totalExtra;
  const endX = width + Math.abs(skewOffset) + totalExtra;
  const currentSpan = endX - startX;

  return { resScale, skewOffset, baseBandW, totalExtra, startX, currentSpan };
}

export const LineWipeAnimationPlugin: PresetPlugin<LineWipePresetOptions> = {
  id: 'line-wipe',
  name: 'LINE WIPE (斜めラインワイプ)',
  category: 'トラックマット特化',
  description:
    '画面全体を覆わずに、幅のある斜めラインが左から右へ駆け抜け、通過した左側を次シーンへ切り替えるトラックマット特化型スティンガー。',
  defaultOptions: defaultLineWipeOptions,
  params: [
    {
      key: 'bandWidth',
      type: 'range',
      label: '斜線の幅 (太さ)',
      min: 60,
      max: 360,
      step: 10,
      unit: 'px',
    },
    {
      key: 'angleDeg',
      type: 'range',
      label: '傾き角度',
      min: 10,
      max: 45,
      step: 1,
      unit: '°',
    },
    {
      key: 'stripeCount',
      type: 'range',
      label: 'サブライン本数',
      min: 0,
      max: 3,
      step: 1,
      unit: '本',
    },
    {
      key: 'speedLines',
      type: 'boolean',
      label: 'スピードダッシュ効果',
    },
  ],

  render(ctx, progress, frameIndex, totalFrames, width, height, options) {
    ctx.clearRect(0, 0, width, height);

    const { resScale, skewOffset, baseBandW, startX, currentSpan } = computeLineWipeGeometry(
      width,
      height,
      options
    );

    const easedP = easeInOutCubic(Math.max(0, Math.min(1, progress)));
    const centerX = startX + currentSpan * easedP;

    // 斜め平行四辺形の描画パスを生成
    const makeSkewBandPath = (cx: number, bw: number) => {
      const halfW = bw / 2;
      ctx.beginPath();
      ctx.moveTo(cx - halfW, 0);
      ctx.lineTo(cx + halfW, 0);
      ctx.lineTo(cx + halfW - skewOffset, height);
      ctx.lineTo(cx - halfW - skewOffset, height);
      ctx.closePath();
    };

    ctx.save();

    // 1. スピードダッシュライン（背後エフェクト）
    if (options.speedLines) {
      ctx.shadowBlur = 0;
      ctx.lineWidth = Math.max(1, 2 * resScale);
      const count = 7;
      for (let i = 0; i < count; i++) {
        const lineY = (height / (count + 1)) * (i + 1);
        const yRatio = lineY / height;
        const lineCenterX = centerX - yRatio * skewOffset;

        // 帯の前後に走る光条
        const speedOffset = Math.sin(frameIndex * 0.4 + i * 1.5) * 60 * resScale;
        const lineLen = (120 + ((i * 37) % 80)) * resScale;
        const lx1 = lineCenterX - baseBandW * 0.8 + speedOffset - lineLen;
        const lx2 = lx1 + lineLen;

        const dashGrad = ctx.createLinearGradient(lx1, lineY, lx2, lineY);
        dashGrad.addColorStop(0, 'rgba(255, 255, 255, 0)');
        dashGrad.addColorStop(0.7, options.accentColor);
        dashGrad.addColorStop(1, 'rgba(255, 255, 255, 0.8)');

        ctx.strokeStyle = dashGrad;
        ctx.beginPath();
        ctx.moveTo(lx1, lineY);
        ctx.lineTo(lx2, lineY);
        ctx.stroke();
      }
    }

    // 2. 先行サブストライプ（右側＝進行方向前方）
    const leadOffsets = [baseBandW * 0.65, baseBandW * 0.9, baseBandW * 1.15];
    const leadWidths = [10 * resScale, 5 * resScale, 2 * resScale];
    const leadAlphas = [0.85, 0.6, 0.35];

    for (let i = 0; i < Math.min(options.stripeCount, leadOffsets.length); i++) {
      const subCx = centerX + leadOffsets[i];
      makeSkewBandPath(subCx, leadWidths[i]);
      ctx.fillStyle = options.secondaryColor;
      ctx.globalAlpha = leadAlphas[i];
      ctx.fill();
    }

    // 3. 後続サブストライプ（左側＝通過後）
    const trailOffsets = [-baseBandW * 0.65, -baseBandW * 0.9, -baseBandW * 1.2];
    const trailWidths = [12 * resScale, 6 * resScale, 3 * resScale];
    const trailAlphas = [0.8, 0.5, 0.3];

    for (let i = 0; i < Math.min(options.stripeCount, trailOffsets.length); i++) {
      const subCx = centerX + trailOffsets[i];
      makeSkewBandPath(subCx, trailWidths[i]);
      ctx.fillStyle = options.accentColor;
      ctx.globalAlpha = trailAlphas[i];
      ctx.fill();
    }

    ctx.globalAlpha = 1.0;

    // 4. メイン帯のグロー発光
    if (options.hasGlow) {
      ctx.shadowColor = options.glowColor || options.primaryColor;
      ctx.shadowBlur = (options.glowBlur || 24) * resScale;
    }

    // 5. メイン帯（Main Band）描画
    // 水平方向グラデーション（左のセカンダリ/アクセントから右のプライマリへ）
    const halfW = baseBandW / 2;
    const bandGrad = ctx.createLinearGradient(centerX - halfW, 0, centerX + halfW, 0);
    bandGrad.addColorStop(0, options.secondaryColor);
    bandGrad.addColorStop(0.45, options.primaryColor);
    bandGrad.addColorStop(0.85, options.primaryColor);
    bandGrad.addColorStop(1, options.accentColor);

    makeSkewBandPath(centerX, baseBandW);
    ctx.fillStyle = bandGrad;
    ctx.fill();

    // 6. メイン帯のエッジライン・ボーダー
    if (options.borderWidth > 0) {
      ctx.strokeStyle = options.borderColor || '#ffffff';
      ctx.lineWidth = Math.max(0.5, options.borderWidth * resScale);

      // 進行方向前面（右側エッジ）
      ctx.beginPath();
      const rightX = centerX + halfW;
      ctx.moveTo(rightX, 0);
      ctx.lineTo(rightX - skewOffset, height);
      ctx.stroke();

      // 後面（左側エッジ）
      ctx.beginPath();
      const leftX = centerX - halfW;
      ctx.moveTo(leftX, 0);
      ctx.lineTo(leftX - skewOffset, height);
      ctx.stroke();

      // 中央のアクセントスリット（微細なセンターハイライト）
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = Math.max(0.5, 1.5 * resScale);
      ctx.beginPath();
      ctx.moveTo(centerX, 0);
      ctx.lineTo(centerX - skewOffset, height);
      ctx.stroke();
    }

    ctx.restore();
  },

  /**
   * OBS トラックマット用マスク描画
   * 斜線の右側は前の画面 (黒 = Scene A)
   * 斜線が通った左側は次の画面 (白 = Scene B)
   * メイン帯の中心 (centerX) を境界として、通過した左側領域を白で塗りつぶす
   */
  renderMatte(ctx, progress, frameIndex, totalFrames, width, height, options) {
    const { skewOffset, totalExtra, startX, currentSpan } = computeLineWipeGeometry(
      width,
      height,
      options
    );

    const easedP = easeInOutCubic(Math.max(0, Math.min(1, progress)));
    const centerX = startX + currentSpan * easedP;

    // 通過した左側（画面外左端 〜 斜線境界）を白 (#ffffff = Scene B) で塗る
    // 境界線上端: centerX, 下端: centerX - skewOffset
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(-totalExtra * 2, 0);
    ctx.lineTo(centerX, 0);
    ctx.lineTo(centerX - skewOffset, height);
    ctx.lineTo(-totalExtra * 2, height);
    ctx.closePath();
    ctx.fill();
  },
};
