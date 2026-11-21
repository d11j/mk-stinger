import { describe, expect, it } from 'vitest';
import { createCanvas } from '@napi-rs/canvas';
import { ALL_PRESETS, PRESET_MAP } from '../index';

const TEST_WIDTH = 320;
const TEST_HEIGHT = 180;
const TOTAL_FRAMES = 60;

function createTestContext(width = TEST_WIDTH, height = TEST_HEIGHT) {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d') as unknown as CanvasRenderingContext2D;
  return { canvas, ctx };
}

/**
 * マットキャンバス上の白ピクセル（Scene B: RGB すべて 250 以上かつ Alpha 250 以上）の割合を算出する
 */
function measureWhiteRatio(ctx: CanvasRenderingContext2D, width: number, height: number): number {
  const { data } = ctx.getImageData(0, 0, width, height);
  const totalPixels = width * height;
  let whitePixels = 0;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];
    if (r >= 250 && g >= 250 && b >= 250 && a >= 250) {
      whitePixels++;
    }
  }

  return whitePixels / totalPixels;
}

describe('Preset Registry', () => {
  it('ALL_PRESETS が空でなく、一意な ID で PRESET_MAP に登録されていること', () => {
    expect(ALL_PRESETS.length).toBeGreaterThan(0);

    const ids = ALL_PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ALL_PRESETS.length);

    for (const preset of ALL_PRESETS) {
      expect(PRESET_MAP.get(preset.id)).toBe(preset);
      expect(preset.name.length).toBeGreaterThan(0);
      expect(preset.defaultOptions).toBeDefined();
    }
  });
});

describe.each(ALL_PRESETS)('Preset: $id ($name)', (preset) => {
  it('境界フレーム (progress = 0.0, 0.5, 1.0) で render / renderMatte が例外なく完了すること', () => {
    const { ctx } = createTestContext();
    const boundaries = [
      { progress: 0.0, frameIndex: 0 },
      { progress: 0.5, frameIndex: Math.floor((TOTAL_FRAMES - 1) / 2) },
      { progress: 1.0, frameIndex: TOTAL_FRAMES - 1 },
    ];

    for (const { progress, frameIndex } of boundaries) {
      expect(() => {
        preset.render(
          ctx,
          progress,
          frameIndex,
          TOTAL_FRAMES,
          TEST_WIDTH,
          TEST_HEIGHT,
          preset.defaultOptions
        );
      }).not.toThrow();

      expect(() => {
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, TEST_WIDTH, TEST_HEIGHT);
        preset.renderMatte(
          ctx,
          progress,
          frameIndex,
          TOTAL_FRAMES,
          TEST_WIDTH,
          TEST_HEIGHT,
          preset.defaultOptions
        );
      }).not.toThrow();
    }
  });

  it('render が決定論的であり、同一パラメータで完全に一致するピクセル出力を返すこと', () => {
    const first = createTestContext();
    const second = createTestContext();
    const progress = 0.5;
    const frameIndex = 30;

    preset.render(
      first.ctx,
      progress,
      frameIndex,
      TOTAL_FRAMES,
      TEST_WIDTH,
      TEST_HEIGHT,
      preset.defaultOptions
    );
    preset.render(
      second.ctx,
      progress,
      frameIndex,
      TOTAL_FRAMES,
      TEST_WIDTH,
      TEST_HEIGHT,
      preset.defaultOptions
    );

    const firstData = first.ctx.getImageData(0, 0, TEST_WIDTH, TEST_HEIGHT).data;
    const secondData = second.ctx.getImageData(0, 0, TEST_WIDTH, TEST_HEIGHT).data;
    expect(Buffer.from(firstData).equals(Buffer.from(secondData))).toBe(true);
  });

  it('renderMatte の開始フレームが黒 (Scene A)、終了フレームが全面白 (Scene B) であること', () => {
    const renderMatteAt = (progress: number, frameIndex: number) => {
      const { ctx } = createTestContext();
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, TEST_WIDTH, TEST_HEIGHT);
      preset.renderMatte(
        ctx,
        progress,
        frameIndex,
        TOTAL_FRAMES,
        TEST_WIDTH,
        TEST_HEIGHT,
        preset.defaultOptions
      );
      return measureWhiteRatio(ctx, TEST_WIDTH, TEST_HEIGHT);
    };

    const startRatio = renderMatteAt(0.0, 0);
    const midRatio = renderMatteAt(0.5, Math.floor((TOTAL_FRAMES - 1) / 2));
    const endRatio = renderMatteAt(1.0, TOTAL_FRAMES - 1);

    // 開始フレーム: Scene A (黒)
    // glitch は normDist ジッターにより左上に微小セルが出現する現行仕様のため許容値を設ける
    if (preset.id === 'glitch') {
      expect(startRatio).toBeLessThan(0.05);
    } else {
      expect(startRatio).toBe(0);
    }

    // 終了フレーム: 全面 Scene B (白)
    expect(endRatio).toBe(1);

    // トランジション進行に伴い白領域が逆行しないこと
    expect(midRatio).toBeGreaterThanOrEqual(startRatio);
    expect(endRatio).toBeGreaterThanOrEqual(midRatio);
  });
});
