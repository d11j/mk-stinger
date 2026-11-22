import { PresetPlugin } from '../types';
import { ColorPalette } from '../ui/colorThemes';

const COLOR_KEYS = [
  'primaryColor',
  'secondaryColor',
  'accentColor',
  'borderColor',
  'glowColor',
] as const;

type ColorKey = (typeof COLOR_KEYS)[number];

const COLOR_KEY_SET: ReadonlySet<string> = new Set<ColorKey>(COLOR_KEYS);

function applyPaletteToOptions(target: Record<string, any>, palette: ColorPalette): void {
  for (const key of COLOR_KEYS) {
    target[key] = palette[key];
  }
}

function extractPaletteFromOptions(source: Record<string, any>): ColorPalette {
  return {
    primaryColor: source.primaryColor,
    secondaryColor: source.secondaryColor,
    accentColor: source.accentColor,
    borderColor: source.borderColor,
    glowColor: source.glowColor,
  };
}

/**
 * 同一セッション内でのプリセット別ドラフトとカラー引き継ぎを管理するメモリ内ストア
 */
export class PresetStateStore {
  private readonly presets: Map<string, PresetPlugin<any>>;
  private readonly drafts = new Map<string, Record<string, any>>();
  private currentPresetId: string;
  private sharedPalette: ColorPalette | null = null;
  private activeColorThemeId: string | null = null;

  constructor(presets: Map<string, PresetPlugin<any>>, initialPresetId: string) {
    const initialPreset = presets.get(initialPresetId);
    if (!initialPreset) {
      throw new Error(`Unknown initial preset id: ${initialPresetId}`);
    }

    this.presets = presets;
    this.currentPresetId = initialPresetId;
    this.drafts.set(initialPresetId, { ...initialPreset.defaultOptions });
  }

  public getCurrentPresetId(): string {
    return this.currentPresetId;
  }

  public getCurrentPreset(): PresetPlugin<any> {
    return this.presets.get(this.currentPresetId)!;
  }

  public getCurrentOptions(): Record<string, any> {
    return this.drafts.get(this.currentPresetId)!;
  }

  public getActiveColorThemeId(): string | null {
    return this.activeColorThemeId;
  }

  public hasSharedColorPalette(): boolean {
    return this.sharedPalette !== null;
  }

  /**
   * プリセットを切り替える。既訪プリセットは記憶済みドラフトを復元し、
   * ユーザーによる色変更がある場合は切替先へも現在のカラーパレットを引き継ぐ。
   */
  public selectPreset(
    presetId: string
  ): { preset: PresetPlugin<any>; options: Record<string, any> } | null {
    const preset = this.presets.get(presetId);
    if (!preset) {
      return null;
    }

    const existingDraft = this.drafts.get(presetId);
    let draft: Record<string, any>;
    if (existingDraft) {
      draft = existingDraft;
    } else {
      draft = { ...(preset.defaultOptions as Record<string, any>) };
      this.drafts.set(presetId, draft);
    }

    if (this.sharedPalette) {
      applyPaletteToOptions(draft, this.sharedPalette);
    }

    this.currentPresetId = presetId;
    return { preset, options: draft };
  }

  public updateOption(key: string, value: any): void {
    const draft = this.getCurrentOptions();
    draft[key] = value;

    if (COLOR_KEY_SET.has(key)) {
      this.sharedPalette = extractPaletteFromOptions(draft);
      this.activeColorThemeId = null;
    }
  }

  public updateColors(palette: ColorPalette): void {
    this.applyColorPalette(palette, null);
  }

  public applyColorPalette(palette: ColorPalette, themeId: string | null): void {
    const draft = this.getCurrentOptions();
    applyPaletteToOptions(draft, palette);
    this.sharedPalette = { ...palette };
    this.activeColorThemeId = themeId;
  }

  /**
   * 現在のプリセットの初期色へ戻し、プリセット横断のカラー引き継ぎを解除する。
   */
  public resetColorsToPresetDefault(): void {
    const preset = this.getCurrentPreset();
    const draft = this.getCurrentOptions();
    applyPaletteToOptions(draft, extractPaletteFromOptions(preset.defaultOptions));
    this.sharedPalette = null;
    this.activeColorThemeId = null;
  }

  /**
   * 共有 URL 等から復元された設定を適用する。
   */
  public applyRestoredState(
    presetId: string,
    restoredOptions: Record<string, any>,
    isColorCustomized: boolean
  ): { preset: PresetPlugin<any>; options: Record<string, any> } | null {
    const preset = this.presets.get(presetId);
    if (!preset) {
      return null;
    }

    const draft: Record<string, any> = {
      ...(preset.defaultOptions as Record<string, any>),
      ...restoredOptions,
    };
    this.drafts.set(presetId, draft);
    this.currentPresetId = presetId;
    this.sharedPalette = isColorCustomized ? extractPaletteFromOptions(draft) : null;
    this.activeColorThemeId = null;

    return { preset, options: draft };
  }
}
