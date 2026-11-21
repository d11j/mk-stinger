import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createCanvas, type Canvas } from '@napi-rs/canvas';
import { TrackMatteRenderer } from '../TrackMatteRenderer';
import { HexAnimationPlugin, defaultHexOptions } from '../../engine/presets';

const originalOffscreenCanvas = globalThis.OffscreenCanvas;

beforeAll(() => {
  // Node.js 環境向けに OffscreenCanvas を @napi-rs/canvas でポリフィル
  globalThis.OffscreenCanvas = class MockOffscreenCanvas {
    private inner: Canvas;

    constructor(width: number, height: number) {
      this.inner = createCanvas(width, height);
    }

    get width() {
      return this.inner.width;
    }

    set width(value: number) {
      this.inner.width = value;
    }

    get height() {
      return this.inner.height;
    }

    set height(value: number) {
      this.inner.height = value;
    }

    getContext(contextId: string) {
      if (contextId !== '2d') return null;
      const ctx = this.inner.getContext('2d');
      const originalDrawImage = ctx.drawImage.bind(ctx);
      // MockOffscreenCanvas が渡された場合は内部の @napi-rs/canvas インスタンスを unwrap する
      ctx.drawImage = ((image: any, ...args: any[]) => {
        const source = image && image.inner ? image.inner : image;
        return (originalDrawImage as (...params: any[]) => void)(source, ...args);
      }) as typeof ctx.drawImage;
      return ctx;
    }
  } as unknown as typeof OffscreenCanvas;
});

afterAll(() => {
  globalThis.OffscreenCanvas = originalOffscreenCanvas;
});

describe('TrackMatteRenderer', () => {
  it('初期生成時に Side-by-Side (2w x h) の出力キャンバスを構成すること', () => {
    const renderer = new TrackMatteRenderer(320, 180);

    expect(renderer.outputCanvas.width).toBe(640);
    expect(renderer.outputCanvas.height).toBe(180);
    expect(renderer.getAnimCanvas().width).toBe(320);
    expect(renderer.getAnimCanvas().height).toBe(180);
    expect(renderer.getMaskCanvas().width).toBe(320);
    expect(renderer.getMaskCanvas().height).toBe(180);
  });

  it('resize() が全内部キャンバスを同期リサイズすること', () => {
    const renderer = new TrackMatteRenderer(320, 180);
    renderer.resize(640, 360);

    expect(renderer.outputCanvas.width).toBe(1280);
    expect(renderer.outputCanvas.height).toBe(360);
    expect(renderer.getAnimCanvas().width).toBe(640);
    expect(renderer.getAnimCanvas().height).toBe(360);
    expect(renderer.getMaskCanvas().width).toBe(640);
    expect(renderer.getMaskCanvas().height).toBe(360);
  });

  it('compositeSideBySide() が終了フレームで右半分を完全不透明の白マスクで出力すること', () => {
    const width = 320;
    const height = 180;
    const renderer = new TrackMatteRenderer(width, height);

    HexAnimationPlugin.render(renderer.animCtx, 1.0, 59, 60, width, height, defaultHexOptions);
    const output = renderer.compositeSideBySide(
      HexAnimationPlugin,
      1.0,
      59,
      60,
      defaultHexOptions
    );

    expect(output.width).toBe(width * 2);
    expect(output.height).toBe(height);

    // 右半分（マスク領域）のサンプルピクセルが完全不透明の白 (#ffffff) であること
    const rightHalf = renderer.outputCtx.getImageData(width, 0, width, height).data;
    for (let i = 0; i < rightHalf.length; i += 4) {
      expect(rightHalf[i]).toBe(255);
      expect(rightHalf[i + 1]).toBe(255);
      expect(rightHalf[i + 2]).toBe(255);
      expect(rightHalf[i + 3]).toBe(255);
    }
  });
});
