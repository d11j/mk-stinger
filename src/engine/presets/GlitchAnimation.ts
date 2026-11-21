import { BasePresetOptions, PresetPlugin } from '../../types';

export interface GlitchPresetOptions extends BasePresetOptions {
  blockSize: number;
  noiseAmount: number;
}

export const defaultGlitchOptions: GlitchPresetOptions = {
  primaryColor: '#26a641', // GitHub 草 Level 3
  secondaryColor: '#006d32', // GitHub 草 Level 2
  accentColor: '#39d353', // GitHub 草 Level 4
  borderColor: '#0e4429', // GitHub 草 Level 1 (タイル境界)
  borderWidth: 3,
  hasGlow: true,
  glowColor: '#39d353',
  glowBlur: 12,
  patternScale: 1.0,
  blockSize: 48,
  noiseAmount: 0.3,
};

// 疑似乱数 (決定論的描画のためにシード固定PRNG)
function seededRandom(seed: number) {
  const x = Math.sin(seed++) * 10000;
  return x - Math.floor(x);
}

export const GlitchAnimationPlugin: PresetPlugin<GlitchPresetOptions> = {
  id: 'glitch',
  name: 'CYBER GRID (デジタルブロック)',
  category: 'サイバー',
  description: '左からデジタルグリッドボクセルが波状に展開し、全画面をデータロックして崩壊消滅するサイバーパンクスティンガー。ギッハブの草。',
  defaultOptions: defaultGlitchOptions,

  render(ctx, progress, frameIndex, totalFrames, width, height, options) {
    ctx.clearRect(0, 0, width, height);

    const bSize = options.blockSize;
    const cols = Math.ceil(width / bSize);
    const rows = Math.ceil(height / bSize);

    const fillEnd = 0.46;
    const holdEnd = 0.54;

    const colors = [options.primaryColor, options.secondaryColor, options.accentColor];

    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        const x = c * bSize;
        const y = r * bSize;

        // 決定論的シード
        const cellIndex = c + r * cols;
        const jitter = (seededRandom(cellIndex * 7.31) - 0.5) * 0.2;
        const normDist = (c / cols) * 0.8 + (r / rows) * 0.2 + jitter;

        let active = false;
        let scale = 1.0;

        if (progress < fillEnd) {
          const t = progress / fillEnd;
          if (t >= normDist) {
            active = true;
            const localT = Math.min(1, (t - normDist) / 0.15);
            scale = Math.sin((localT * Math.PI) / 2);
          }
        } else if (progress <= holdEnd) {
          active = true;
          scale = 1.0;
        } else {
          // 縮小消滅
          const tOut = (progress - holdEnd) / (1.0 - holdEnd);
          const outDist = ((cols - c) / cols) * 0.7 + (r / rows) * 0.3 + jitter;
          if (tOut < outDist) {
            active = true;
            const localOutT = Math.max(0, 1 - (tOut - (outDist - 0.2)) / 0.2);
            scale = Math.min(1, localOutT);
          }
        }

        if (!active || scale <= 0.01) continue;

        const colorIdx = Math.floor(seededRandom(cellIndex * 13.17) * colors.length);
        const colVal = colors[colorIdx];

        ctx.save();
        const cx = x + bSize / 2;
        const cy = y + bSize / 2;
        ctx.translate(cx, cy);

        // 全面不透明期間中は隙間なし
        const s = (progress >= fillEnd && progress <= holdEnd) ? 1.02 : scale;
        const w = bSize * s;
        const h = bSize * s;

        ctx.fillStyle = colVal;
        ctx.fillRect(-w / 2, -h / 2, w, h);

        if (options.borderWidth > 0 && scale > 0.8) {
          ctx.strokeStyle = options.borderColor;
          ctx.lineWidth = options.borderWidth;
          if (options.hasGlow) {
            ctx.shadowColor = options.glowColor;
            ctx.shadowBlur = options.glowBlur;
          }
          ctx.strokeRect(-w / 2, -h / 2, w, h);
        }

        ctx.restore();
      }
    }
  },

  renderMatte(ctx, progress, frameIndex, totalFrames, width, height, options) {
    const bSize = options.blockSize;
    const cols = Math.ceil(width / bSize);
    const rows = Math.ceil(height / bSize);
    const fillEnd = 0.46;

    if (progress >= fillEnd) {
      // 完全に覆った後は全面白 (Scene B)
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
      return;
    }

    ctx.fillStyle = '#ffffff';

    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        const x = c * bSize;
        const y = r * bSize;

        const cellIndex = c + r * cols;
        const jitter = (seededRandom(cellIndex * 7.31) - 0.5) * 0.2;
        const normDist = (c / cols) * 0.8 + (r / rows) * 0.2 + jitter;

        const t = progress / fillEnd;
        if (t >= normDist) {
          const localT = Math.min(1, (t - normDist) / 0.15);
          const s = Math.sin((localT * Math.PI) / 2) * 1.05;
          const w = bSize * s;
          const h = bSize * s;
          const cx = x + bSize / 2;
          const cy = y + bSize / 2;
          ctx.fillRect(cx - w / 2, cy - h / 2, w, h);
        }
      }
    }
  },
};

