import { describe, expect, it } from 'vitest';
import { PRESET_MAP } from '../../engine/presets';
import {
  buildShareUrl,
  DEFAULT_OUTPUT_SETTINGS,
  hasSelectedCustomImage,
  parseShareUrl,
} from '../urlShare';

const BASE_URL = 'https://example.com/mk-stinger/';

describe('urlShare', () => {
  it('デフォルト設定のまま URL を生成すると preset のみが含まれ短く保たれる', () => {
    const hexPreset = PRESET_MAP.get('hex')!;
    const url = buildShareUrl(BASE_URL, hexPreset, {
      presetId: 'hex',
      options: { ...hexPreset.defaultOptions },
      output: { ...DEFAULT_OUTPUT_SETTINGS },
    });

    expect(url).toBe('https://example.com/mk-stinger/?preset=hex');
  });

  it('カラー・ディテール・固有パラメータ・出力設定の差分が URL にエンコードされ完全に往復復元できる', () => {
    const spritePreset = PRESET_MAP.get('sprite-wipe')!;
    const customOptions = {
      ...spritePreset.defaultOptions,
      primaryColor: '#123456',
      accentColor: '#abcdef',
      borderWidth: 6,
      hasGlow: false,
      glowBlur: 24,
      angleDeg: 35,
      spriteType: 'heart',
      spriteCount: 28,
      sizeScatter: 0.75,
      spriteRotate: false,
    };
    const customOutput = {
      resolutionKey: '720p' as const,
      fps: 30 as const,
      durationSec: 3.2,
      bitrateMbps: 22,
    };

    const url = buildShareUrl(BASE_URL, spritePreset, {
      presetId: 'sprite-wipe',
      options: customOptions,
      output: customOutput,
    });

    const parsedUrl = new URL(url);
    expect(parsedUrl.searchParams.get('preset')).toBe('sprite-wipe');
    expect(parsedUrl.searchParams.get('primary')).toBe('123456');
    expect(parsedUrl.searchParams.get('accent')).toBe('abcdef');
    // デフォルトと一致する色は含まれないこと
    expect(parsedUrl.searchParams.has('secondary')).toBe(false);
    expect(parsedUrl.searchParams.get('p.spriteType')).toBe('heart');
    expect(parsedUrl.searchParams.get('res')).toBe('720p');
    expect(parsedUrl.searchParams.get('fps')).toBe('30');
    expect(parsedUrl.searchParams.get('dur')).toBe('3.2');
    expect(parsedUrl.searchParams.get('br')).toBe('22');

    const restored = parseShareUrl(parsedUrl.search, PRESET_MAP, 'hex');
    expect(restored.hasShareParams).toBe(true);
    expect(restored.presetId).toBe('sprite-wipe');
    expect(restored.isColorCustomized).toBe(true);
    expect(restored.needsCustomImageNotice).toBe(false);
    expect(restored.options.primaryColor).toBe('#123456');
    expect(restored.options.accentColor).toBe('#abcdef');
    expect(restored.options.secondaryColor).toBe(spritePreset.defaultOptions.secondaryColor);
    expect(restored.options.borderWidth).toBe(6);
    expect(restored.options.hasGlow).toBe(false);
    expect(restored.options.glowBlur).toBe(24);
    expect(restored.options.angleDeg).toBe(35);
    expect(restored.options.spriteType).toBe('heart');
    expect(restored.options.spriteCount).toBe(28);
    expect(restored.options.sizeScatter).toBe(0.75);
    expect(restored.options.spriteRotate).toBe(false);
    expect(restored.output).toEqual(customOutput);
  });

  it('クエリが空、または無関係なパラメータのみのときは hasShareParams が false になる', () => {
    const empty = parseShareUrl('', PRESET_MAP, 'hex');
    expect(empty.hasShareParams).toBe(false);
    expect(empty.presetId).toBe('hex');

    const unrelated = parseShareUrl('?utm_source=x&foo=bar', PRESET_MAP, 'hex');
    expect(unrelated.hasShareParams).toBe(false);
    expect(unrelated.presetId).toBe('hex');
  });

  it('未知のプリセット ID・範囲外数値・不正な色や select 値を安全にフォールバック・クランプする', () => {
    const hexDefault = PRESET_MAP.get('hex')!.defaultOptions;
    const restored = parseShareUrl(
      '?preset=unknown-preset&primary=not-a-color&bw=999&glowBlur=-50&glowOn=invalid&res=4k&fps=120&dur=99&br=1&p.unknown=123',
      PRESET_MAP,
      'hex'
    );

    expect(restored.hasShareParams).toBe(true);
    expect(restored.presetId).toBe('hex');
    expect(restored.isColorCustomized).toBe(false);
    expect(restored.options.primaryColor).toBe(hexDefault.primaryColor);
    expect(restored.options.borderWidth).toBe(10);
    expect(restored.options.glowBlur).toBe(0);
    expect(restored.options.hasGlow).toBe(hexDefault.hasGlow);
    expect(restored.output.resolutionKey).toBe('1080p');
    expect(restored.output.fps).toBe(60);
    expect(restored.output.durationSec).toBe(4.0);
    expect(restored.output.bitrateMbps).toBe(8);
  });

  it('sprite-wipe の不正な select 値や範囲外 range 値を安全に処理する', () => {
    const spriteDefault = PRESET_MAP.get('sprite-wipe')!.defaultOptions;
    const restored = parseShareUrl(
      '?preset=sprite-wipe&p.spriteType=invalid-shape&p.spriteCount=500&p.angleDeg=-999',
      PRESET_MAP,
      'hex'
    );

    expect(restored.presetId).toBe('sprite-wipe');
    expect(restored.options.spriteType).toBe(spriteDefault.spriteType);
    expect(restored.options.spriteCount).toBe(36);
    expect(restored.options.angleDeg).toBe(10);
  });

  it('カスタム画像設定は URL に含めず、コピー時判定と復元時の再選択通知フラグが正しく機能する', () => {
    const spritePreset = PRESET_MAP.get('sprite-wipe')!;
    const mockImg = { src: 'data:image/png;base64,abc' } as HTMLImageElement;

    const optionsWithImage = {
      ...spritePreset.defaultOptions,
      spriteType: 'custom',
      customImage: mockImg,
    };

    expect(hasSelectedCustomImage(spritePreset, optionsWithImage)).toBe(true);
    expect(
      hasSelectedCustomImage(spritePreset, {
        ...spritePreset.defaultOptions,
        spriteType: 'star',
        customImage: mockImg,
      })
    ).toBe(false);

    const url = buildShareUrl(BASE_URL, spritePreset, {
      presetId: 'sprite-wipe',
      options: optionsWithImage,
      output: { ...DEFAULT_OUTPUT_SETTINGS },
    });

    const parsedUrl = new URL(url);
    expect(parsedUrl.searchParams.has('p.customImage')).toBe(false);
    expect(parsedUrl.searchParams.get('p.spriteType')).toBe('custom');

    const restored = parseShareUrl(parsedUrl.search, PRESET_MAP, 'hex');
    expect(restored.options.spriteType).toBe('custom');
    expect(restored.options.customImage).toBeNull();
    expect(restored.needsCustomImageNotice).toBe(true);
  });
});
