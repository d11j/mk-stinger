import { BasePresetOptions, PresetPlugin } from '../../types';

export interface SlashPresetOptions extends BasePresetOptions {
  stripeCount: number;
  angleDeg: number;
  speedLines: boolean;
}

export const defaultSlashOptions: SlashPresetOptions = {
  primaryColor: '#ef4444', // レッド
  secondaryColor: '#f97316', // オレンジ
  accentColor: '#fbbf24', // イエロー
  borderColor: '#ffffff',
  borderWidth: 4,
  hasGlow: true,
  glowColor: '#ef4444',
  glowBlur: 20,
  patternScale: 1.0,
  stripeCount: 6,
  angleDeg: 25,
  speedLines: true,
};

export const SlashAnimationPlugin: PresetPlugin<SlashPresetOptions> = {
  id: 'slash',
  name: 'SLASH WIPE (斜めスライス)',
  category: 'ダイナミック',
  description: '鋭角なスラッシュストライプが画面を高速で走り抜け、全画面をロックして素早く飛び去るesports風スティンガー。',
  defaultOptions: defaultSlashOptions,

  render(ctx, progress, frameIndex, totalFrames, width, height, options) {
    ctx.clearRect(0, 0, width, height);

    const rad = (options.angleDeg * Math.PI) / 180;
    const tan = Math.tan(rad);
    const skewOffset = height * tan;
    const totalSpan = width + Math.abs(skewOffset) + 400;

    const fillEnd = 0.45;
    const holdEnd = 0.55;

    const easeInOutExpo = (x: number): number => {
      return x === 0
        ? 0
        : x === 1
        ? 1
        : x < 0.5
        ? Math.pow(2, 20 * x - 10) / 2
        : (2 - Math.pow(2, -20 * x + 10)) / 2;
    };

    const count = options.stripeCount;
    const colors = [options.primaryColor, options.secondaryColor, options.accentColor];

    // 背景の黒またはメインカバー
    let coverProgress = 0;
    if (progress < fillEnd) {
      coverProgress = easeInOutExpo(progress / fillEnd);
    } else if (progress <= holdEnd) {
      coverProgress = 1.0;
    } else {
      const outP = (progress - holdEnd) / (1.0 - holdEnd);
      coverProgress = 1.0 - easeInOutExpo(outP);
    }

    // スラッシュ帯の描画
    ctx.save();
    // 傾きをシミュレートする多角形
    const drawSkewRect = (startX: number, rectW: number) => {
      ctx.beginPath();
      ctx.moveTo(startX, 0);
      ctx.lineTo(startX + rectW, 0);
      ctx.lineTo(startX + rectW - skewOffset, height);
      ctx.lineTo(startX - skewOffset, height);
      ctx.closePath();
    };

    // 複数層のストライプを重ねて描画
    for (let i = 0; i < count; i++) {
      const layerDelay = (i / count) * 0.15;
      let pLayer = 0;

      if (progress < fillEnd) {
        const rawT = (progress - layerDelay) / (fillEnd - layerDelay);
        pLayer = easeInOutExpo(Math.max(0, Math.min(1, rawT)));
      } else if (progress <= holdEnd) {
        pLayer = 1.0;
      } else {
        const rawOutT = (progress - holdEnd - layerDelay * 0.5) / (1.0 - holdEnd);
        pLayer = 1.0 - easeInOutExpo(Math.max(0, Math.min(1, rawOutT)));
      }

      if (pLayer <= 0) continue;

      const layerColor = colors[i % colors.length];
      const startX = -Math.abs(skewOffset) - 100;
      const currentWidth = (totalSpan + 200) * pLayer;

      ctx.fillStyle = layerColor;
      drawSkewRect(startX, currentWidth);
      ctx.fill();

      // 先頭ストローク
      if (options.borderWidth > 0 && pLayer > 0 && pLayer < 1) {
        ctx.strokeStyle = options.borderColor;
        ctx.lineWidth = options.borderWidth;
        if (options.hasGlow) {
          ctx.shadowColor = options.glowColor;
          ctx.shadowBlur = options.glowBlur;
        }
        ctx.beginPath();
        const headX = startX + currentWidth;
        ctx.moveTo(headX, 0);
        ctx.lineTo(headX - skewOffset, height);
        ctx.stroke();
      }
    }

    // スピードライン
    if (options.speedLines && (progress < fillEnd || progress > holdEnd)) {
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = 2;
      for (let j = 0; j < 5; j++) {
        const lineY = (height / 6) * (j + 1);
        const lineLen = 150 + Math.sin(frameIndex + j) * 80;
        const lineX = (width * progress * 2 + j * 120) % (width + 300) - 100;
        ctx.beginPath();
        ctx.moveTo(lineX, lineY);
        ctx.lineTo(lineX + lineLen, lineY);
        ctx.stroke();
      }
    }

    ctx.restore();
  },

  renderMatte(ctx, progress, frameIndex, totalFrames, width, height, options, cutFrame) {
    const rad = (options.angleDeg * Math.PI) / 180;
    const tan = Math.tan(rad);
    const skewOffset = height * tan;
    const totalSpan = width + Math.abs(skewOffset) + 400;

    const fillEnd = 0.45;

    if (progress >= fillEnd) {
      // 完全に覆った後は白 (Scene B)
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
      return;
    }

    const easeInOutExpo = (x: number): number => {
      return x === 0 ? 0 : Math.pow(2, 20 * x - 10) / 2;
    };

    const p = easeInOutExpo(Math.max(0, Math.min(1, progress / fillEnd)));
    const startX = -Math.abs(skewOffset) - 100;
    const currentWidth = (totalSpan + 200) * p;

    // スラッシュの通過領域を白 (Scene B) で塗る
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(startX, 0);
    ctx.lineTo(startX + currentWidth, 0);
    ctx.lineTo(startX + currentWidth - skewOffset, height);
    ctx.lineTo(startX - skewOffset, height);
    ctx.closePath();
    ctx.fill();
  },
};

