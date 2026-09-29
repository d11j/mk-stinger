import { BasePresetOptions, PresetPlugin, SpriteType } from '../../types';

export interface SpriteWipePresetOptions extends BasePresetOptions {
  angleDeg: number; // 傾き角度 (度)
  spriteType: SpriteType; // スプライトの種類
  spriteCount: number; // スプライトの配置数
  spriteSize: number; // スプライトの大きさ (px)
  sizeScatter: number; // スプライトサイズの散布幅 (0.0 〜 1.0)
  spriteScatter: number; // ラインからの散布幅 (px)
  spriteRotate: boolean; // 自転アニメーション
  customImage: HTMLImageElement | null; // アップロードされたカスタム画像（永続化なし）
}

// 内部定数: スプライトを引き立たせるためのスリムなセンターライン幅
const FIXED_LINE_WIDTH = 4;

export const defaultSpriteWipeOptions: SpriteWipePresetOptions = {
  primaryColor: '#ec4899', // ビビッドピンク
  secondaryColor: '#8b5cf6', // バイオレット
  accentColor: '#fde047', // ゴールドスター
  borderColor: '#ffffff', // シャープホワイトエッジ
  borderWidth: 2,
  hasGlow: true,
  glowColor: '#ec4899',
  glowBlur: 16,
  patternScale: 1.0,
  angleDeg: 26,
  spriteType: 'star',
  spriteCount: 16,
  spriteSize: 96,
  sizeScatter: 0.4,
  spriteScatter: 36,
  spriteRotate: true,
  customImage: null,
};

/**
 * 決定論的イージング関数（画面中央を加速して気持ちよく駆け抜ける）
 */
function easeInOutCubic(x: number): number {
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

/**
 * インデックスに基づく決定論的擬似乱数 (0.0 - 1.0)
 */
function deterministicRandom(seed: number): number {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * 5角星のパスを生成
 */
function drawStarPath(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, r: number) {
  const innerR = r * 0.42;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const radius = i % 2 === 0 ? r : innerR;
    const angle = (i * Math.PI) / 5 - Math.PI / 2;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

/**
 * ハートのパスを生成
 */
function drawHeartPath(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, s: number) {
  const r = s * 0.85;
  ctx.beginPath();
  ctx.moveTo(0, r * 0.35);
  ctx.bezierCurveTo(-r * 0.55, -r * 0.3, -r, r * 0.1, -r * 0.5, r * 0.65);
  ctx.bezierCurveTo(-r * 0.25, r * 0.95, 0, r * 1.1, 0, r * 1.25);
  ctx.bezierCurveTo(0, r * 1.1, r * 0.25, r * 0.95, r * 0.5, r * 0.65);
  ctx.bezierCurveTo(r, r * 0.1, r * 0.55, -r * 0.3, 0, r * 0.35);
  ctx.closePath();
}

/**
 * 4点キラキラスター（スパークル）のパスを生成
 */
function drawSparklePath(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, r: number) {
  const inner = r * 0.18;
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const radius = i % 2 === 0 ? r : inner;
    const angle = (i * Math.PI) / 4;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

/**
 * ダイヤ（ひし形）のパスを生成
 */
function drawDiamondPath(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, r: number) {
  ctx.beginPath();
  ctx.moveTo(0, -r);
  ctx.lineTo(r * 0.7, 0);
  ctx.lineTo(0, r);
  ctx.lineTo(-r * 0.7, 0);
  ctx.closePath();
}

export const SpriteWipeAnimationPlugin: PresetPlugin<SpriteWipePresetOptions> = {
  id: 'sprite-wipe',
  name: 'DECORATED LINE (デコレーションライン)',
  category: 'トラックマット特化',
  description:
    'シンプルな1本ラインに星やハート、任意の画像スプライト（PNG/SVG）を散りばめて駆け抜ける、トラックマット特化型スティンガー。',
  defaultOptions: defaultSpriteWipeOptions,

  render(ctx, progress, frameIndex, totalFrames, width, height, options) {
    ctx.clearRect(0, 0, width, height);

    const rad = (options.angleDeg * Math.PI) / 180;
    const tan = Math.tan(rad);
    const skewOffset = height * tan;

    const baseLineW = FIXED_LINE_WIDTH * (options.patternScale || 1.0);
    const extraMargin = 400; // 画面外から画面外への移動余白

    // 移動範囲（画面外左から画面外右まで完全に抜け切るスパン）
    const startX = -extraMargin;
    const endX = width + Math.abs(skewOffset) + extraMargin;
    const currentSpan = endX - startX;

    const easedP = easeInOutCubic(Math.max(0, Math.min(1, progress)));
    const centerX = startX + currentSpan * easedP;

    ctx.save();

    // 1. メインライン（1本の斜め帯）の描画パス
    const halfW = baseLineW / 2;
    const linePath = () => {
      ctx.beginPath();
      ctx.moveTo(centerX - halfW, 0);
      ctx.lineTo(centerX + halfW, 0);
      ctx.lineTo(centerX + halfW - skewOffset, height);
      ctx.lineTo(centerX - halfW - skewOffset, height);
      ctx.closePath();
    };

    // 発光グロー効果
    if (options.hasGlow) {
      ctx.shadowColor = options.glowColor || options.primaryColor;
      ctx.shadowBlur = options.glowBlur || 16;
    }

    // メインラインのグラデーション塗り（セカンダリ → プライマリ → アクセント）
    const grad = ctx.createLinearGradient(
      centerX - halfW,
      0,
      centerX + halfW,
      0
    );
    grad.addColorStop(0, options.secondaryColor);
    grad.addColorStop(0.5, options.primaryColor);
    grad.addColorStop(1, options.accentColor);

    linePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // メインラインの境界線（ボーダー）
    if (options.borderWidth > 0) {
      ctx.strokeStyle = options.borderColor || '#ffffff';
      ctx.lineWidth = options.borderWidth;
      linePath();
      ctx.stroke();

      // センターの光るハイライトライン
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.lineWidth = Math.max(1, options.borderWidth * 0.5);
      ctx.beginPath();
      ctx.moveTo(centerX, 0);
      ctx.lineTo(centerX - skewOffset, height);
      ctx.stroke();
    }

    // 2. デコレーションスプライトの描画
    const count = Math.max(1, options.spriteCount || 16);
    const baseSize = options.spriteSize || 96;
    const scatter = options.spriteScatter ?? 36;
    const sizeScatterRate = Math.max(0, Math.min(1, options.sizeScatter ?? 0.4));
    const hasCustomImg =
      options.spriteType === 'custom' &&
      options.customImage &&
      options.customImage.complete &&
      options.customImage.naturalWidth > 0;

    for (let i = 0; i < count; i++) {
      // 決定論的乱数シード
      const rnd1 = deterministicRandom(i * 13 + 7);
      const rnd2 = deterministicRandom(i * 29 + 17);
      const rnd3 = deterministicRandom(i * 47 + 31);
      const rnd4 = deterministicRandom(i * 71 + 59);

      // Y座標：画面高さを均等に分割しつつ、少しジッターを加える
      const yStep = height / (count + 1);
      const baseY = yStep * (i + 1);
      const spriteY = baseY + (rnd1 - 0.5) * (yStep * 0.7);

      // X座標：ラインの中心軸 + スキャッター（散布オフセット）
      const yRatio = spriteY / height;
      const lineXAtY = centerX - yRatio * skewOffset;
      const scatterOffset = (rnd2 - 0.5) * 2 * scatter;
      const spriteX = lineXAtY + scatterOffset;

      // 個別スプライトのサイズ（基本サイズから散布幅倍率に応じて縮小変化）
      const sizeScale = 1.0 - sizeScatterRate * rnd3;
      const currentSize = Math.max(8, baseSize * sizeScale);

      // 自転・回転角
      let angle = 0;
      if (options.spriteRotate) {
        // ラインの疾走に合わせてクルクル回転
        const rotateDirection = i % 2 === 0 ? 1 : -1;
        angle = (progress * Math.PI * 6 + rnd4 * Math.PI * 2) * rotateDirection;
      } else {
        // 固定の傾き
        angle = (rnd4 - 0.5) * 0.8;
      }

      ctx.save();
      ctx.translate(spriteX, spriteY);
      ctx.rotate(angle);

      // 発光設定
      if (options.hasGlow) {
        ctx.shadowColor = options.glowColor || options.accentColor;
        ctx.shadowBlur = Math.min(options.glowBlur, 16);
      } else {
        ctx.shadowBlur = 0;
      }

      if (hasCustomImg && options.customImage) {
        // --- カスタム画像（PNG / SVG）の描画 ---
        const img = options.customImage;
        const aspect = img.naturalWidth / img.naturalHeight;
        let dw = currentSize;
        let dh = currentSize;
        if (aspect >= 1) {
          dh = currentSize / aspect;
        } else {
          dw = currentSize * aspect;
        }

        // 微細な白フチ・シャドウ用（画像の視認性向上）
        ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
      } else {
        // --- プリセットシェイプ（星, ハート, キラキラ, ダイヤ, サークル） ---
        const radius = currentSize / 2;

        // カラー：アクセント色またはプライマリ色（インデックスで交互に変化）
        const shapeColor = i % 3 === 0 ? options.accentColor : (i % 3 === 1 ? options.primaryColor : options.secondaryColor);
        ctx.fillStyle = shapeColor;

        if (options.spriteType === 'heart') {
          drawHeartPath(ctx, radius);
        } else if (options.spriteType === 'sparkle') {
          drawSparklePath(ctx, radius);
        } else if (options.spriteType === 'diamond') {
          drawDiamondPath(ctx, radius);
        } else if (options.spriteType === 'circle') {
          ctx.beginPath();
          ctx.arc(0, 0, radius, 0, Math.PI * 2);
          ctx.closePath();
        } else {
          // デフォルト: 'star' (およびカスタム画像未設定時のフォールバック)
          drawStarPath(ctx, radius);
        }

        ctx.fill();

        // シャープなホワイトボーダー
        if (options.borderWidth > 0) {
          ctx.strokeStyle = options.borderColor || '#ffffff';
          ctx.lineWidth = Math.max(1, options.borderWidth * 0.6);
          ctx.stroke();
        }

        // 中心部にハイライトの白い輝き
        ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
        ctx.beginPath();
        ctx.arc(0, 0, radius * 0.25, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }

    ctx.restore();
  },

  /**
   * OBS トラックマット用マスク描画
   * 斜線の右側は前の画面 (黒 = Scene A)
   * 斜線が通った左側は次の画面 (白 = Scene B)
   * 1本のメインラインの中心 (centerX) を境界として、通過した左側領域を白で塗りつぶす
   */
  renderMatte(ctx, progress, frameIndex, totalFrames, width, height, options, cutFrame) {
    const rad = (options.angleDeg * Math.PI) / 180;
    const tan = Math.tan(rad);
    const skewOffset = height * tan;

    const extraMargin = 400;
    const startX = -extraMargin;
    const endX = width + Math.abs(skewOffset) + extraMargin;
    const currentSpan = endX - startX;

    const easedP = easeInOutCubic(Math.max(0, Math.min(1, progress)));
    const centerX = startX + currentSpan * easedP;

    // 通過した左側（画面外左端 〜 斜線境界）を白 (#ffffff = Scene B) で塗る
    // 境界線上端: centerX, 下端: centerX - skewOffset
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(-extraMargin * 2, 0);
    ctx.lineTo(centerX, 0);
    ctx.lineTo(centerX - skewOffset, height);
    ctx.lineTo(-extraMargin * 2, height);
    ctx.closePath();
    ctx.fill();
  },
};
