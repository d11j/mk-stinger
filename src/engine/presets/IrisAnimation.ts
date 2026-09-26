import { BasePresetOptions, PresetPlugin } from '../../types';

export interface IrisPresetOptions extends BasePresetOptions {
  ringCount: number;
  bladeCount: number;
  spinSpeed: number;
}

export const defaultIrisOptions: IrisPresetOptions = {
  primaryColor: '#10b981', // エメラルド
  secondaryColor: '#059669', // グリーン
  accentColor: '#34d399', // ミント
  borderColor: '#a7f3d0',
  borderWidth: 5,
  hasGlow: true,
  glowColor: '#10b981',
  glowBlur: 25,
  patternScale: 1.0,
  ringCount: 4,
  bladeCount: 8,
  spinSpeed: 2.0,
};

export const IrisAnimationPlugin: PresetPlugin<IrisPresetOptions> = {
  id: 'iris',
  name: 'IRIS SHUTTER (メカニカルアイリス)',
  category: 'サークル',
  description: '中央から回転しながら広がるメカニカルな絞りリング。全画面をカバーして一気に閉じるハイテク円形スティンガー。',
  defaultOptions: defaultIrisOptions,

  render(ctx, progress, frameIndex, totalFrames, width, height, options) {
    ctx.clearRect(0, 0, width, height);

    const cx = width / 2;
    const cy = height / 2;
    // 画面の四隅まで覆う最大半径
    const maxR = Math.hypot(cx, cy) * 1.05;

    const fillEnd = 0.46;
    const holdEnd = 0.54;

    const easeInOutCubic = (x: number): number => {
      return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
    };

    let p = 0;
    if (progress < fillEnd) {
      p = easeInOutCubic(progress / fillEnd);
    } else if (progress <= holdEnd) {
      p = 1.0;
    } else {
      const outP = (progress - holdEnd) / (1.0 - holdEnd);
      p = 1.0 - easeInOutCubic(outP);
    }

    if (p <= 0) return;

    ctx.save();
    ctx.translate(cx, cy);

    // 回転
    const rot = progress * Math.PI * options.spinSpeed;
    ctx.rotate(rot);

    // 複数の同心円リング & ブレード
    const currentR = maxR * p;

    // メイン塗りつぶし円
    ctx.beginPath();
    ctx.arc(0, 0, currentR, 0, Math.PI * 2);
    ctx.fillStyle = options.primaryColor;
    ctx.fill();

    // 内部ブレード幾何学
    if (options.bladeCount > 0 && p > 0.1 && p < 0.98) {
      ctx.fillStyle = options.secondaryColor;
      const angleStep = (Math.PI * 2) / options.bladeCount;
      for (let i = 0; i < options.bladeCount; i++) {
        const a1 = i * angleStep;
        const a2 = a1 + angleStep * 0.5;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, currentR, a1, a2);
        ctx.closePath();
        ctx.fill();
      }
    }

    // 外周ボーダー & グロー
    if (options.borderWidth > 0) {
      ctx.strokeStyle = options.borderColor;
      ctx.lineWidth = options.borderWidth;
      if (options.hasGlow) {
        ctx.shadowColor = options.glowColor;
        ctx.shadowBlur = options.glowBlur;
      }
      ctx.beginPath();
      ctx.arc(0, 0, currentR, 0, Math.PI * 2);
      ctx.stroke();

      // 内周リング
      if (p > 0.3) {
        ctx.shadowBlur = 0;
        ctx.strokeStyle = options.accentColor;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, currentR * 0.65, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    ctx.restore();
  },

  renderMatte(ctx, progress, frameIndex, totalFrames, width, height, options, cutFrame) {
    const cx = width / 2;
    const cy = height / 2;
    const maxR = Math.hypot(cx, cy) * 1.05;
    const fillEnd = 0.46;

    if (progress >= fillEnd) {
      // 完全に覆った後は全面白 (Scene B)
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
      return;
    }

    const easeInOutCubic = (x: number): number => {
      return 4 * x * x * x;
    };

    const p = easeInOutCubic(Math.max(0, Math.min(1, progress / fillEnd)));
    const currentR = maxR * p;

    // 中央から広がる円を白 (Scene B) で塗る
    ctx.save();
    ctx.translate(cx, cy);
    ctx.beginPath();
    ctx.arc(0, 0, currentR, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.restore();
  },
};

