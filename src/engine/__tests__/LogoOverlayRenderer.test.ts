import { describe, expect, it } from 'vitest';
import { createCanvas, type Canvas } from '@napi-rs/canvas';
import {
  computeLogoOverlayState,
  DEFAULT_LOGO_OVERLAY_OPTIONS,
  LOGO_OVERLAY_ANIMATIONS,
  renderLogoOverlay,
} from '../LogoOverlayRenderer';
import { LogoOverlayOptions } from '../../types';

function createMockLogoImage(
  width: number,
  height: number,
  fillStyle = '#ff0077'
): HTMLImageElement {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = fillStyle;
  ctx.fillRect(0, 0, width, height);
  return canvas as unknown as HTMLImageElement;
}

function getOpaquePixelBounds(canvas: Canvas): {
  count: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
} {
  const ctx = canvas.getContext('2d');
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  let count = 0;
  let minX = canvas.width;
  let maxX = -1;
  let minY = canvas.height;
  let maxY = -1;

  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const alpha = data[(y * canvas.width + x) * 4 + 3];
      if (alpha > 0) {
        count++;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  return { count, minX, maxX, minY, maxY };
}

describe('LogoOverlayRenderer', () => {
  const width = 320;
  const height = 180;

  it('enabled が false または image が null のときは何も描画しないこと', () => {
    const img = createMockLogoImage(64, 64);

    const canvasDisabled = createCanvas(width, height);
    const ctxDisabled = canvasDisabled.getContext('2d') as unknown as CanvasRenderingContext2D;
    renderLogoOverlay(ctxDisabled, 0.5, width, height, {
      ...DEFAULT_LOGO_OVERLAY_OPTIONS,
      enabled: false,
      image: img,
    });
    expect(getOpaquePixelBounds(canvasDisabled).count).toBe(0);

    const canvasNoImage = createCanvas(width, height);
    const ctxNoImage = canvasNoImage.getContext('2d') as unknown as CanvasRenderingContext2D;
    renderLogoOverlay(ctxNoImage, 0.5, width, height, {
      ...DEFAULT_LOGO_OVERLAY_OPTIONS,
      enabled: true,
      image: null,
    });
    expect(getOpaquePixelBounds(canvasNoImage).count).toBe(0);
  });

  it('全アニメーション種別で開始フレーム (0.0) および終了フレーム (1.0) で完全に非表示になること', () => {
    const img = createMockLogoImage(80, 80);

    for (const { value: animation } of LOGO_OVERLAY_ANIMATIONS) {
      const options: LogoOverlayOptions = {
        ...DEFAULT_LOGO_OVERLAY_OPTIONS,
        enabled: true,
        image: img,
        animation,
        startProgress: 0.0,
        endProgress: 1.0,
        hasShadow: false,
      };

      expect(computeLogoOverlayState(0.0, height, options).visible).toBe(false);
      expect(computeLogoOverlayState(1.0, height, options).visible).toBe(false);

      for (const boundary of [0.0, 1.0]) {
        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d') as unknown as CanvasRenderingContext2D;
        renderLogoOverlay(ctx, boundary, width, height, options);
        expect(getOpaquePixelBounds(canvas).count).toBe(0);
      }
    }
  });

  it('表示区間外では描画されず、区間中央では可視ピクセルが描画されること', () => {
    const img = createMockLogoImage(100, 100);
    const options: LogoOverlayOptions = {
      ...DEFAULT_LOGO_OVERLAY_OPTIONS,
      enabled: true,
      image: img,
      startProgress: 0.2,
      endProgress: 0.8,
      hasShadow: false,
    };

    for (const outside of [0.0, 0.1, 0.2, 0.8, 0.95, 1.0]) {
      const canvas = createCanvas(width, height);
      const ctx = canvas.getContext('2d') as unknown as CanvasRenderingContext2D;
      renderLogoOverlay(ctx, outside, width, height, options);
      expect(getOpaquePixelBounds(canvas).count).toBe(0);
    }

    const centerCanvas = createCanvas(width, height);
    const centerCtx = centerCanvas.getContext('2d') as unknown as CanvasRenderingContext2D;
    renderLogoOverlay(centerCtx, 0.5, width, height, options);
    const bounds = getOpaquePixelBounds(centerCanvas);
    expect(bounds.count).toBeGreaterThan(0);
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2;
    expect(Math.abs(centerX - width / 2)).toBeLessThanOrEqual(2);
    expect(Math.abs(centerY - height / 2)).toBeLessThanOrEqual(2);
  });

  it('offsetX / offsetY と scale が描画位置とサイズ（アスペクト比維持）に反映されること', () => {
    // 2:1 の横長画像を使用
    const img = createMockLogoImage(200, 100);
    const options: LogoOverlayOptions = {
      ...DEFAULT_LOGO_OVERLAY_OPTIONS,
      enabled: true,
      image: img,
      scale: 0.5, // 長辺 = 180 * 0.5 = 90px, 短辺 = 45px
      offsetX: 0.2, // 中心X = 320 * 0.7 = 224px
      offsetY: -0.15, // 中心Y = 180 * 0.35 = 63px
      hasShadow: false,
    };

    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d') as unknown as CanvasRenderingContext2D;
    renderLogoOverlay(ctx, 0.5, width, height, options);

    const bounds = getOpaquePixelBounds(canvas);
    const drawnW = bounds.maxX - bounds.minX + 1;
    const drawnH = bounds.maxY - bounds.minY + 1;
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2;

    expect(Math.abs(drawnW - 90)).toBeLessThanOrEqual(2);
    expect(Math.abs(drawnH - 45)).toBeLessThanOrEqual(2);
    expect(Math.abs(centerX - width * 0.7)).toBeLessThanOrEqual(2);
    expect(Math.abs(centerY - height * 0.35)).toBeLessThanOrEqual(2);
  });
});
