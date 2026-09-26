import { HexPresetOptions, PresetPlugin } from '../../types';

interface HexCell {
  cx: number;
  cy: number;
  r: number;
  col: number;
  row: number;
  order: number; // 左から右への順序
  delayNorm: number; // 0.0 - 1.0
  colorIndex: number;
}

export const defaultHexOptions: HexPresetOptions = {
  primaryColor: '#6366f1', // インディゴ
  secondaryColor: '#06b6d4', // シアン
  accentColor: '#ec4899', // ピンク
  borderColor: '#38bdf8', // スカイブルー (発光ボーダー)
  borderWidth: 3,
  hasGlow: true,
  glowColor: '#38bdf8',
  glowBlur: 15,
  patternScale: 1.0,
  staggerDelay: 0.65, // 左から右への展開のディレイ幅
  shrinkScale: 0.0,
  rotationEffect: true,
};

// 正六角形の頂点パスを生成
function drawHexagonPath(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  rotationRad: number = 0
) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = rotationRad + (Math.PI / 3) * i + Math.PI / 6; // Pointy-topped
    const x = cx + radius * Math.cos(angle);
    const y = cy + radius * Math.sin(angle);
    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.closePath();
}

// 幾何学キャッシュ
let cachedCells: HexCell[] = [];
let lastKey = '';

function getHexCells(width: number, height: number): HexCell[] {
  // 六角形の高さは、画面の高さの 1/3 (SPEC.md 要件)
  // Pointy-topped Hex: 頂点対頂点の全高は 2 * r なので、2 * r = height / 3 => r = height / 6
  const targetH = height / 3;
  const r = targetH / 2; // 外接円半径
  const hexWidth = Math.sqrt(3) * r; // 水平幅
  const vertSpacing = (3 / 2) * r; // 垂直間隔 (75% of H)
  const horizSpacing = hexWidth; // 水平間隔

  const key = `${width}_${height}_${r.toFixed(2)}`;
  if (lastKey === key && cachedCells.length > 0) {
    return cachedCells;
  }

  const cells: HexCell[] = [];
  // 画面外を少しカバーするようにマージンをとる
  const startX = -hexWidth * 1.5;
  const endX = width + hexWidth * 1.5;
  const startY = -targetH;
  const endY = height + targetH;

  let row = 0;
  for (let y = startY; y <= endY; y += vertSpacing) {
    const isOdd = row % 2 !== 0;
    const xOffset = isOdd ? horizSpacing / 2 : 0;

    let col = 0;
    for (let x = startX + xOffset; x <= endX; x += horizSpacing) {
      // 左から右への順序値（Y軸の波を少し加えて有機的に）
      const orderValue = x + (y - height / 2) * 0.15;
      cells.push({
        cx: x,
        cy: y,
        r,
        col,
        row,
        order: orderValue,
        delayNorm: 0,
        colorIndex: (col + row * 2) % 3,
      });
      col++;
    }
    row++;
  }

  // 左から右へソート
  cells.sort((a, b) => a.order - b.order);

  // delayNorm を 0.0 - 1.0 に正規化
  const minOrder = cells[0]?.order ?? 0;
  const maxOrder = cells[cells.length - 1]?.order ?? 1;
  const range = maxOrder - minOrder || 1;

  for (const cell of cells) {
    cell.delayNorm = (cell.order - minOrder) / range;
  }

  cachedCells = cells;
  lastKey = key;
  return cells;
}

export const HexAnimationPlugin: PresetPlugin<HexPresetOptions> = {
  id: 'hex',
  name: 'HEX (ハニカム充填)',
  category: '幾何学',
  description: '画面左から1つずつ六角形を画面全体に充填し、充填完了時に全六角形が縮小消滅するスティンガー。六角形の高さは画面の1/3。',
  defaultOptions: defaultHexOptions,

  render(ctx, progress, frameIndex, totalFrames, width, height, options) {
    ctx.clearRect(0, 0, width, height);

    const cells = getHexCells(width, height);
    if (cells.length === 0) return;

    // トランジションポイントの完全不透明フェーズ:
    // progress 0.0 -> 0.46 : 充填 (scale 0 -> 1)
    // progress 0.46 -> 0.54 : 完全不透明キープ (全セル scale 1.035、隙間なし)
    // progress 0.54 -> 1.0 : 全縮小消滅 (scale 1 -> 0)
    const fillEndProgress = 0.46;
    const holdEndProgress = 0.54;

    const isHoldPhase = progress >= fillEndProgress && progress <= holdEndProgress;
    const isShrinkPhase = progress > holdEndProgress;

    // 縮小フェーズの進捗 (0.0 -> 1.0)
    const shrinkT = isShrinkPhase
      ? (progress - holdEndProgress) / (1.0 - holdEndProgress)
      : 0;

    // イージング関数
    const easeOutBack = (x: number): number => {
      const c1 = 1.70158;
      const c3 = c1 + 1;
      return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
    };

    const easeInBack = (x: number): number => {
      const c1 = 1.70158;
      const c3 = c1 + 1;
      return c3 * x * x * x - c1 * x * x;
    };

    // 六角形の描画
    for (const cell of cells) {
      let scale = 0;
      let rot = 0;

      if (isHoldPhase) {
        // 完全不透明維持: アンチエイリアスによる微小な隙間を完全に防ぐため scale 1.035
        scale = 1.035;
        rot = 0;
      } else if (!isShrinkPhase) {
        // 充填フェーズ (左から順に展開)
        const cellStart = cell.delayNorm * (fillEndProgress * options.staggerDelay);
        const cellDuration = fillEndProgress - fillEndProgress * options.staggerDelay;
        const rawT = (progress - cellStart) / Math.max(0.001, cellDuration);
        const t = Math.max(0, Math.min(1, rawT));

        if (t <= 0) {
          scale = 0;
        } else if (t >= 1) {
          scale = 1.035;
        } else {
          // 登場時はスケールアップ + わずかな回転
          scale = easeOutBack(t) * 1.035;
          if (options.rotationEffect) {
            rot = (1 - t) * (Math.PI / 3);
          }
        }
      } else {
        // 縮小消滅フェーズ: 「充填が完了したら全ての六角形を縮小して消滅させる」
        const shrinkEase = easeInBack(Math.min(1, shrinkT));
        scale = Math.max(0, (1.035 - shrinkEase * 1.035));
        if (options.rotationEffect) {
          rot = -shrinkT * (Math.PI / 3);
        }
      }

      if (scale <= 0.001) continue;

      const currentRadius = cell.r * scale;

      ctx.save();
      ctx.translate(cell.cx, cell.cy);

      // 六角形パスの描画
      drawHexagonPath(ctx, 0, 0, currentRadius, rot);

      // セルごとの個別カラー（グラデーション配色）
      let cellColor = options.primaryColor;
      if (cell.colorIndex === 1) cellColor = options.secondaryColor;
      if (cell.colorIndex === 2) cellColor = options.accentColor;

      // 放射グラデーションで立体感とハイテク感を演出
      const cellGrad = ctx.createRadialGradient(
        0,
        0,
        0,
        0,
        0,
        Math.max(1, currentRadius)
      );
      cellGrad.addColorStop(0, cellColor);
      cellGrad.addColorStop(0.85, cellColor);
      cellGrad.addColorStop(1, '#0f172a');

      ctx.fillStyle = cellGrad;
      ctx.fill();

      // ボーダー & グロー効果
      if (options.borderWidth > 0) {
        ctx.strokeStyle = options.borderColor;
        ctx.lineWidth = options.borderWidth;
        ctx.lineJoin = 'miter';

        if (options.hasGlow && scale > 0.5) {
          ctx.shadowColor = options.glowColor;
          ctx.shadowBlur = options.glowBlur;
        }

        ctx.stroke();
      }

      // 六角形の内側にサイバー幾何学アクセント
      // if (scale > 0.7 && !isHoldPhase) {
      //   ctx.shadowBlur = 0;
      //   ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
      //   ctx.lineWidth = 1;
      //   drawHexagonPath(ctx, 0, 0, currentRadius * 0.45, -rot);
      //   ctx.stroke();
      // }

      ctx.restore();
    }
  },

  renderMatte(ctx, progress, frameIndex, totalFrames, width, height, options, cutFrame) {
    // トラックマットマスク: 白 (#ffffff) で Scene B 領域を塗る
    const fillEndProgress = 0.46;

    // 完全不透明ホールド以降は画面全体が完全な白 (Scene B)
    if (progress >= fillEndProgress) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
      return;
    }

    // 充填フェーズ: 六角形の進行に合わせて左から順に白を塗り広げる
    const cells = getHexCells(width, height);
    if (cells.length === 0) return;

    ctx.fillStyle = '#ffffff';

    for (const cell of cells) {
      const cellStart = cell.delayNorm * (fillEndProgress * options.staggerDelay);
      const cellDuration = fillEndProgress - fillEndProgress * options.staggerDelay;
      const rawT = (progress - cellStart) / Math.max(0.001, cellDuration);
      const t = Math.max(0, Math.min(1, rawT));

      if (t <= 0) continue;

      // 展開に合わせてセルの内部を白で塗る (アンチエイリアスの隙間防止に1.05倍)
      const scale = Math.min(1.05, t * 1.05);
      const currentRadius = cell.r * scale;

      ctx.save();
      ctx.translate(cell.cx, cell.cy);
      drawHexagonPath(ctx, 0, 0, currentRadius, 0);
      ctx.fill();
      ctx.restore();
    }
  },
};

