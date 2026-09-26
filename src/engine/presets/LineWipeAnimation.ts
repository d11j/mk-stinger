import { BasePresetOptions, PresetPlugin } from '../../types';

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
  patternScale: 1.0,
  bandWidth: 180,
  angleDeg: 28,
  stripeCount: 3,
  speedLines: true,
};

/**
 * 画面中央を高速通過するスムーズなイージング関数
 */
function easeInOutCubic(x: number): number {
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

export const LineWipeAnimationPlugin: PresetPlugin<LineWipePresetOptions> = {
  id: 'line-wipe',
  name: 'LINE WIPE (斜めラインワイプ)',
  category: 'トラックマット特化',
  description:
    '画面全体を覆わずに、幅のある斜めラインが左から右へ駆け抜け、通過した左側を次シーンへ切り替えるトラックマット特化型スティンガー。',
  defaultOptions: defaultLineWipeOptions,

  render(ctx, progress, frameIndex, totalFrames, width, height, options) {
    ctx.clearRect(0, 0, width, height);

    const rad = (options.angleDeg * Math.PI) / 180;
    const tan = Math.tan(rad);
    const skewOffset = height * tan;

    const baseBandW = options.bandWidth * (options.patternScale || 1.0);
    const totalExtra = 350; // 前後サブラインや発光の余白

    // 移動範囲（画面外左から画面外右まで完全に抜け切るスパン）
    const startX = -totalExtra;
    const endX = width + Math.abs(skewOffset) + totalExtra;
    const currentSpan = endX - startX;

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
      ctx.lineWidth = 2;
      const count = 7;
      for (let i = 0; i < count; i++) {
        const lineY = (height / (count + 1)) * (i + 1);
        const yRatio = lineY / height;
        const lineCenterX = centerX - yRatio * skewOffset;

        // 帯の前後に走る光条
        const speedOffset = Math.sin(frameIndex * 0.4 + i * 1.5) * 60;
        const lineLen = 120 + ((i * 37) % 80);
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
    const leadWidths = [10, 5, 2];
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
    const trailWidths = [12, 6, 3];
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
      ctx.shadowBlur = options.glowBlur || 24;
    }

    // 5. メイン帯（Main Band）描画
    // 水平方向グラデーション（左のセカンダリ/アクセントから右のプライマリへ）
    const halfW = baseBandW / 2;
    const bandGrad = ctx.createLinearGradient(
      centerX - halfW,
      0,
      centerX + halfW,
      0
    );
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
      ctx.lineWidth = options.borderWidth;

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
      ctx.lineWidth = 1.5;
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
  renderMatte(ctx, progress, frameIndex, totalFrames, width, height, options, cutFrame) {
    const rad = (options.angleDeg * Math.PI) / 180;
    const tan = Math.tan(rad);
    const skewOffset = height * tan;

    const baseBandW = options.bandWidth * (options.patternScale || 1.0);
    const totalExtra = 350;

    const startX = -totalExtra;
    const endX = width + Math.abs(skewOffset) + totalExtra;
    const currentSpan = endX - startX;

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
