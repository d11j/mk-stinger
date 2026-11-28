import { describe, expect, it } from 'vitest';
import { createCanvas } from '@napi-rs/canvas';
import { ALL_PRESETS, PRESET_MAP } from '../index';
import { GlitchAnimationPlugin, defaultGlitchOptions } from '../GlitchAnimation';
import { ShutterGateAnimationPlugin, defaultShutterGateOptions } from '../ShutterGateAnimation';
import { FadeAnimationPlugin, defaultFadeOptions } from '../FadeAnimation';
import { LineWipeAnimationPlugin, defaultLineWipeOptions } from '../LineWipeAnimation';
import { SpriteWipeAnimationPlugin, defaultSpriteWipeOptions } from '../SpriteWipeAnimation';

const TEST_WIDTH = 320;
const TEST_HEIGHT = 180;
const VERTICAL_WIDTH = 180;
const VERTICAL_HEIGHT = 320;
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
      expect(Array.isArray(preset.params)).toBe(true);
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

  it('params スキーマが defaultOptions と整合していること', () => {
    const keys = preset.params.map((p) => p.key);
    expect(new Set(keys).size).toBe(keys.length);

    for (const field of preset.params) {
      expect(field.label.length).toBeGreaterThan(0);
      expect(Object.prototype.hasOwnProperty.call(preset.defaultOptions, field.key)).toBe(true);

      const defaultValue = preset.defaultOptions[field.key];
      if (field.type === 'range') {
        expect(field.min).toBeLessThan(field.max);
        expect(field.step).toBeGreaterThan(0);
        expect(typeof defaultValue).toBe('number');
        expect(defaultValue).toBeGreaterThanOrEqual(field.min);
        expect(defaultValue).toBeLessThanOrEqual(field.max);
      } else if (field.type === 'boolean') {
        expect(typeof defaultValue).toBe('boolean');
      } else if (field.type === 'select') {
        expect(field.options.length).toBeGreaterThan(0);
        expect(field.options.some((opt) => opt.value === defaultValue)).toBe(true);
      }

      if (field.visibleWhen) {
        expect(
          Object.prototype.hasOwnProperty.call(preset.defaultOptions, field.visibleWhen.key)
        ).toBe(true);
      }
    }
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
    expect(startRatio).toBe(0);

    // 終了フレーム: 全面 Scene B (白)
    expect(endRatio).toBe(1);

    // トランジション進行に伴い白領域が逆行しないこと
    expect(midRatio).toBeGreaterThanOrEqual(startRatio);
    expect(endRatio).toBeGreaterThanOrEqual(midRatio);
  });

  it('縦型解像度 (9:16) でも境界フレームの render / renderMatte が破綻せず開始黒・終了白を満たすこと', () => {
    const renderMatteAt = (progress: number, frameIndex: number) => {
      const { ctx } = createTestContext(VERTICAL_WIDTH, VERTICAL_HEIGHT);
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, VERTICAL_WIDTH, VERTICAL_HEIGHT);
      preset.renderMatte(
        ctx,
        progress,
        frameIndex,
        TOTAL_FRAMES,
        VERTICAL_WIDTH,
        VERTICAL_HEIGHT,
        preset.defaultOptions
      );
      return measureWhiteRatio(ctx, VERTICAL_WIDTH, VERTICAL_HEIGHT);
    };

    const { ctx } = createTestContext(VERTICAL_WIDTH, VERTICAL_HEIGHT);
    for (const { progress, frameIndex } of [
      { progress: 0.0, frameIndex: 0 },
      { progress: 0.5, frameIndex: Math.floor((TOTAL_FRAMES - 1) / 2) },
      { progress: 1.0, frameIndex: TOTAL_FRAMES - 1 },
    ]) {
      expect(() => {
        preset.render(
          ctx,
          progress,
          frameIndex,
          TOTAL_FRAMES,
          VERTICAL_WIDTH,
          VERTICAL_HEIGHT,
          preset.defaultOptions
        );
      }).not.toThrow();
    }

    const startRatio = renderMatteAt(0.0, 0);
    const midRatio = renderMatteAt(0.5, Math.floor((TOTAL_FRAMES - 1) / 2));
    const endRatio = renderMatteAt(1.0, TOTAL_FRAMES - 1);

    expect(startRatio).toBe(0);
    expect(endRatio).toBe(1);
    expect(midRatio).toBeGreaterThanOrEqual(startRatio);
    expect(endRatio).toBeGreaterThanOrEqual(midRatio);
  });
});

describe('Wipe presets boundary clearance across orientations', () => {
  function countNonTransparentPixels(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number
  ): number {
    const { data } = ctx.getImageData(0, 0, width, height);
    let count = 0;
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] > 0) count++;
    }
    return count;
  }

  it.each([
    { label: '横型 16:9', w: TEST_WIDTH, h: TEST_HEIGHT },
    { label: '縦型 9:16', w: VERTICAL_WIDTH, h: VERTICAL_HEIGHT },
  ])(
    '$label で LineWipe / SpriteWipe の最大サイズ設定でも開始・終了フレームが完全透明であること',
    ({ w, h }) => {
      const lineOpts = {
        ...defaultLineWipeOptions,
        bandWidth: 360,
        angleDeg: 45,
        glowBlur: 40,
        borderWidth: 10,
      };
      const spriteOpts = {
        ...defaultSpriteWipeOptions,
        spriteSize: 200,
        spriteScatter: 100,
        angleDeg: 45,
        glowBlur: 40,
        borderWidth: 10,
      };

      for (const [plugin, opts] of [
        [LineWipeAnimationPlugin, lineOpts],
        [SpriteWipeAnimationPlugin, spriteOpts],
      ] as const) {
        for (const { progress, frameIndex } of [
          { progress: 0.0, frameIndex: 0 },
          { progress: 1.0, frameIndex: TOTAL_FRAMES - 1 },
        ]) {
          const { ctx } = createTestContext(w, h);
          plugin.render(ctx, progress, frameIndex, TOTAL_FRAMES, w, h, opts as never);
          expect(countNonTransparentPixels(ctx, w, h)).toBe(0);
        }
      }
    }
  );
});

describe('GlitchAnimation noiseAmount option', () => {
  it.each([0, 0.25, 0.5])(
    'noiseAmount=%s のときも開始フレーム黒・終了フレーム白で決定論的に描画されること',
    (noiseAmount) => {
      const options = { ...defaultGlitchOptions, noiseAmount };
      const start = createTestContext();
      start.ctx.fillStyle = '#000000';
      start.ctx.fillRect(0, 0, TEST_WIDTH, TEST_HEIGHT);
      GlitchAnimationPlugin.renderMatte(
        start.ctx,
        0.0,
        0,
        TOTAL_FRAMES,
        TEST_WIDTH,
        TEST_HEIGHT,
        options
      );
      expect(measureWhiteRatio(start.ctx, TEST_WIDTH, TEST_HEIGHT)).toBe(0);

      const end = createTestContext();
      end.ctx.fillStyle = '#000000';
      end.ctx.fillRect(0, 0, TEST_WIDTH, TEST_HEIGHT);
      GlitchAnimationPlugin.renderMatte(
        end.ctx,
        1.0,
        TOTAL_FRAMES - 1,
        TOTAL_FRAMES,
        TEST_WIDTH,
        TEST_HEIGHT,
        options
      );
      expect(measureWhiteRatio(end.ctx, TEST_WIDTH, TEST_HEIGHT)).toBe(1);

      const midA = createTestContext();
      const midB = createTestContext();
      GlitchAnimationPlugin.render(
        midA.ctx,
        0.3,
        18,
        TOTAL_FRAMES,
        TEST_WIDTH,
        TEST_HEIGHT,
        options
      );
      GlitchAnimationPlugin.render(
        midB.ctx,
        0.3,
        18,
        TOTAL_FRAMES,
        TEST_WIDTH,
        TEST_HEIGHT,
        options
      );
      const dataA = midA.ctx.getImageData(0, 0, TEST_WIDTH, TEST_HEIGHT).data;
      const dataB = midB.ctx.getImageData(0, 0, TEST_WIDTH, TEST_HEIGHT).data;
      expect(Buffer.from(dataA).equals(Buffer.from(dataB))).toBe(true);
    }
  );
});

describe('ShutterGateAnimation options', () => {
  function measureOpaqueRatio(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number
  ): number {
    const { data } = ctx.getImageData(0, 0, width, height);
    const totalPixels = width * height;
    let opaquePixels = 0;

    for (let i = 3; i < data.length; i += 4) {
      if (data[i] === 255) {
        opaquePixels++;
      }
    }

    return opaquePixels / totalPixels;
  }

  function measureTransparentRatio(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number
  ): number {
    const { data } = ctx.getImageData(0, 0, width, height);
    const totalPixels = width * height;
    let transparentPixels = 0;

    for (let i = 3; i < data.length; i += 4) {
      if (data[i] === 0) {
        transparentPixels++;
      }
    }

    return transparentPixels / totalPixels;
  }

  it.each([
    { direction: 'vertical' as const, seamPosition: 0, holdDuration: 0.3, layerCount: 3 },
    { direction: 'vertical' as const, seamPosition: -1, holdDuration: 0.2, layerCount: 2 },
    { direction: 'vertical' as const, seamPosition: 1, holdDuration: 0.5, layerCount: 1 },
    { direction: 'horizontal' as const, seamPosition: -0.4, holdDuration: 0.3, layerCount: 3 },
    { direction: 'horizontal' as const, seamPosition: 1, holdDuration: 0.1, layerCount: 2 },
  ])(
    'direction=$direction, seamPosition=$seamPosition, holdDuration=$holdDuration で境界透明・ホールド完全不透明を満たすこと',
    ({ direction, seamPosition, holdDuration, layerCount }) => {
      const options = {
        ...defaultShutterGateOptions,
        direction,
        seamPosition,
        holdDuration,
        layerCount,
      };

      const start = createTestContext();
      ShutterGateAnimationPlugin.render(
        start.ctx,
        0.0,
        0,
        TOTAL_FRAMES,
        TEST_WIDTH,
        TEST_HEIGHT,
        options
      );
      expect(measureTransparentRatio(start.ctx, TEST_WIDTH, TEST_HEIGHT)).toBe(1);

      const hold = createTestContext();
      ShutterGateAnimationPlugin.render(
        hold.ctx,
        0.5,
        30,
        TOTAL_FRAMES,
        TEST_WIDTH,
        TEST_HEIGHT,
        options
      );
      expect(measureOpaqueRatio(hold.ctx, TEST_WIDTH, TEST_HEIGHT)).toBe(1);

      const end = createTestContext();
      ShutterGateAnimationPlugin.render(
        end.ctx,
        1.0,
        TOTAL_FRAMES - 1,
        TOTAL_FRAMES,
        TEST_WIDTH,
        TEST_HEIGHT,
        options
      );
      expect(measureTransparentRatio(end.ctx, TEST_WIDTH, TEST_HEIGHT)).toBe(1);
    }
  );
});

describe('FadeAnimation modes', () => {
  function measureAverageLuma(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number
  ): number {
    const { data } = ctx.getImageData(0, 0, width, height);
    let sum = 0;
    const totalPixels = width * height;
    for (let i = 0; i < data.length; i += 4) {
      sum += data[i];
    }
    return sum / totalPixels;
  }

  function measureAlphaState(ctx: CanvasRenderingContext2D, width: number, height: number) {
    const { data } = ctx.getImageData(0, 0, width, height);
    const totalPixels = width * height;
    let opaque = 0;
    let transparent = 0;
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] === 255) opaque++;
      if (data[i] === 0) transparent++;
    }
    return {
      opaqueRatio: opaque / totalPixels,
      transparentRatio: transparent / totalPixels,
    };
  }

  it('cross モードでは render が常に完全透明で、renderMatte が黒→グレー→白へ単調増加すること', () => {
    const options = { ...defaultFadeOptions, fadeMode: 'cross' as const };

    const midRender = createTestContext();
    FadeAnimationPlugin.render(
      midRender.ctx,
      0.5,
      30,
      TOTAL_FRAMES,
      TEST_WIDTH,
      TEST_HEIGHT,
      options
    );
    expect(measureAlphaState(midRender.ctx, TEST_WIDTH, TEST_HEIGHT).transparentRatio).toBe(1);

    const renderMatteLuma = (progress: number, frameIndex: number) => {
      const { ctx } = createTestContext();
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, TEST_WIDTH, TEST_HEIGHT);
      FadeAnimationPlugin.renderMatte(
        ctx,
        progress,
        frameIndex,
        TOTAL_FRAMES,
        TEST_WIDTH,
        TEST_HEIGHT,
        options
      );
      return measureAverageLuma(ctx, TEST_WIDTH, TEST_HEIGHT);
    };

    const lumaStart = renderMatteLuma(0.0, 0);
    const lumaMid = renderMatteLuma(0.5, 30);
    const lumaEnd = renderMatteLuma(1.0, TOTAL_FRAMES - 1);

    expect(lumaStart).toBe(0);
    expect(lumaMid).toBeGreaterThan(100);
    expect(lumaMid).toBeLessThan(155);
    expect(lumaEnd).toBe(255);
  });

  it('dip モードでは境界が完全透明・ホールド中が完全不透明で、renderMatte がホールド時点で白になること', () => {
    const options = { ...defaultFadeOptions, fadeMode: 'dip' as const, holdDuration: 0.2 };

    const start = createTestContext();
    FadeAnimationPlugin.render(start.ctx, 0.0, 0, TOTAL_FRAMES, TEST_WIDTH, TEST_HEIGHT, options);
    expect(measureAlphaState(start.ctx, TEST_WIDTH, TEST_HEIGHT).transparentRatio).toBe(1);

    const hold = createTestContext();
    FadeAnimationPlugin.render(hold.ctx, 0.5, 30, TOTAL_FRAMES, TEST_WIDTH, TEST_HEIGHT, options);
    expect(measureAlphaState(hold.ctx, TEST_WIDTH, TEST_HEIGHT).opaqueRatio).toBe(1);

    const end = createTestContext();
    FadeAnimationPlugin.render(
      end.ctx,
      1.0,
      TOTAL_FRAMES - 1,
      TOTAL_FRAMES,
      TEST_WIDTH,
      TEST_HEIGHT,
      options
    );
    expect(measureAlphaState(end.ctx, TEST_WIDTH, TEST_HEIGHT).transparentRatio).toBe(1);

    const matteMid = createTestContext();
    matteMid.ctx.fillStyle = '#000000';
    matteMid.ctx.fillRect(0, 0, TEST_WIDTH, TEST_HEIGHT);
    FadeAnimationPlugin.renderMatte(
      matteMid.ctx,
      0.5,
      30,
      TOTAL_FRAMES,
      TEST_WIDTH,
      TEST_HEIGHT,
      options
    );
    expect(measureWhiteRatio(matteMid.ctx, TEST_WIDTH, TEST_HEIGHT)).toBe(1);
  });
});
