import { describe, expect, it } from 'vitest';
import { ALL_PRESETS, PRESET_MAP } from '../../engine/presets';
import { PresetStateStore } from '../PresetStateStore';

describe('PresetStateStore', () => {
  it('初期状態では指定プリセットの defaultOptions をコピーし、色引き継ぎはオフになっている', () => {
    const store = new PresetStateStore(PRESET_MAP, 'hex');
    const hexPreset = PRESET_MAP.get('hex')!;

    expect(store.getCurrentPresetId()).toBe('hex');
    expect(store.getCurrentPreset()).toBe(hexPreset);
    expect(store.getCurrentOptions()).toEqual(hexPreset.defaultOptions);
    expect(store.getCurrentOptions()).not.toBe(hexPreset.defaultOptions);
    expect(store.getActiveColorThemeId()).toBeNull();
    expect(store.hasSharedColorPalette()).toBe(false);
  });

  it('存在しない初期プリセット ID で初期化するとエラーを投げる', () => {
    expect(() => new PresetStateStore(PRESET_MAP, 'non-existent')).toThrow();
  });

  it('プリセットを切り替えても、各プリセット固有のパラメータ・ディテール・カスタム画像が保持される', () => {
    const store = new PresetStateStore(PRESET_MAP, 'hex');

    store.updateOption('borderWidth', 8);
    store.updateOption('hasGlow', false);
    store.updateOption('staggerDelay', 0.45);

    const spriteRes = store.selectPreset('sprite-wipe');
    expect(spriteRes).not.toBeNull();
    // hex でのディテール変更が別プリセットには漏れないこと
    expect(spriteRes!.options.borderWidth).toBe(
      PRESET_MAP.get('sprite-wipe')!.defaultOptions.borderWidth
    );

    const mockCustomImage = { src: 'data:image/png;base64,abc' } as HTMLImageElement;
    store.updateOption('spriteType', 'custom');
    store.updateOption('customImage', mockCustomImage);
    store.updateOption('spriteCount', 24);

    // hex へ戻ると、先ほどの変更が復元されていること
    const backToHex = store.selectPreset('hex');
    expect(backToHex!.options.borderWidth).toBe(8);
    expect(backToHex!.options.hasGlow).toBe(false);
    expect(backToHex!.options.staggerDelay).toBe(0.45);

    // sprite-wipe へ再切替すると、カスタム画像や固有設定が保持されていること
    const backToSprite = store.selectPreset('sprite-wipe');
    expect(backToSprite!.options.spriteType).toBe('custom');
    expect(backToSprite!.options.customImage).toBe(mockCustomImage);
    expect(backToSprite!.options.spriteCount).toBe(24);
  });

  it('一度も色を変更していない場合、別プリセットはそのプリセット自身の初期色で開く', () => {
    const store = new PresetStateStore(PRESET_MAP, 'hex');
    const spriteDefault = PRESET_MAP.get('sprite-wipe')!.defaultOptions;

    const switched = store.selectPreset('sprite-wipe');
    expect(switched).not.toBeNull();
    expect(switched!.options.primaryColor).toBe(spriteDefault.primaryColor);
    expect(switched!.options.secondaryColor).toBe(spriteDefault.secondaryColor);
    expect(switched!.options.accentColor).toBe(spriteDefault.accentColor);
    expect(switched!.options.borderColor).toBe(spriteDefault.borderColor);
    expect(switched!.options.glowColor).toBe(spriteDefault.glowColor);
    expect(store.hasSharedColorPalette()).toBe(false);
  });

  it('手動で色を変更すると他プリセットへ切替時もパレットが引き継がれ、テーマ選択状態はクリアされる', () => {
    const store = new PresetStateStore(PRESET_MAP, 'hex');

    const customPalette = {
      primaryColor: '#111111',
      secondaryColor: '#222222',
      accentColor: '#333333',
      borderColor: '#444444',
      glowColor: '#555555',
    };
    store.updateColors(customPalette);

    expect(store.hasSharedColorPalette()).toBe(true);
    expect(store.getActiveColorThemeId()).toBeNull();

    const next = store.selectPreset('slash');
    expect(next).not.toBeNull();
    expect(next!.options.primaryColor).toBe('#111111');
    expect(next!.options.secondaryColor).toBe('#222222');
    expect(next!.options.accentColor).toBe('#333333');
    expect(next!.options.borderColor).toBe('#444444');
    expect(next!.options.glowColor).toBe('#555555');
  });

  it('カラーテーマ適用時は activeColorThemeId が保持され、単色変更すると解除される', () => {
    const store = new PresetStateStore(PRESET_MAP, 'hex');
    const themePalette = {
      primaryColor: '#7aa2f7',
      secondaryColor: '#2ac3de',
      accentColor: '#bb9af7',
      borderColor: '#c0caf5',
      glowColor: '#7aa2f7',
    };

    store.applyColorPalette(themePalette, 'tokyo-night');
    expect(store.getActiveColorThemeId()).toBe('tokyo-night');
    expect(store.hasSharedColorPalette()).toBe(true);

    const switched = store.selectPreset('glitch');
    expect(switched!.options.primaryColor).toBe('#7aa2f7');
    expect(store.getActiveColorThemeId()).toBe('tokyo-night');

    // 個別カラーを1つだけ更新しても引き継ぎパレットが最新化され、テーマIDは解除される
    store.updateOption('accentColor', '#ff0000');
    expect(store.getActiveColorThemeId()).toBeNull();

    const switchedAgain = store.selectPreset('hyper-jump');
    expect(switchedAgain!.options.primaryColor).toBe('#7aa2f7');
    expect(switchedAgain!.options.accentColor).toBe('#ff0000');
  });

  it('初期色リセットを行うと現在プリセットの初期色に戻り、未訪問の他プリセットへの引き継ぎも解除される', () => {
    const store = new PresetStateStore(PRESET_MAP, 'hex');
    const hexDefault = PRESET_MAP.get('hex')!.defaultOptions;
    const lineWipeDefault = PRESET_MAP.get('line-wipe')!.defaultOptions;

    store.applyColorPalette(
      {
        primaryColor: '#aaaaaa',
        secondaryColor: '#bbbbbb',
        accentColor: '#cccccc',
        borderColor: '#dddddd',
        glowColor: '#eeeeee',
      },
      'custom-theme'
    );
    expect(store.hasSharedColorPalette()).toBe(true);

    store.resetColorsToPresetDefault();
    expect(store.hasSharedColorPalette()).toBe(false);
    expect(store.getActiveColorThemeId()).toBeNull();
    expect(store.getCurrentOptions().primaryColor).toBe(hexDefault.primaryColor);
    expect(store.getCurrentOptions().glowColor).toBe(hexDefault.glowColor);

    const switched = store.selectPreset('line-wipe');
    expect(switched!.options.primaryColor).toBe(lineWipeDefault.primaryColor);
    expect(switched!.options.borderColor).toBe(lineWipeDefault.borderColor);
  });

  it('存在しないプリセット ID を指定しても null を返し、現在の状態を破壊しない', () => {
    const store = new PresetStateStore(PRESET_MAP, ALL_PRESETS[0].id);
    store.updateOption('borderWidth', 7);

    const res = store.selectPreset('does-not-exist');
    expect(res).toBeNull();
    expect(store.getCurrentPresetId()).toBe(ALL_PRESETS[0].id);
    expect(store.getCurrentOptions().borderWidth).toBe(7);
  });
});
