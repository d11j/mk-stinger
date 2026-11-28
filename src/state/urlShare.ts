import {
  LogoOverlayAnimation,
  LogoOverlayOptions,
  PresetParamField,
  PresetPlugin,
  RESOLUTIONS,
  ResolutionPreset,
} from '../types';
import {
  DEFAULT_LOGO_OVERLAY_OPTIONS,
  LOGO_OVERLAY_ANIMATIONS,
  LOGO_OVERLAY_MIN_DURATION,
} from '../engine/LogoOverlayRenderer';

export interface ShareableOutputSettings {
  resolutionKey: ResolutionPreset;
  fps: 30 | 60;
  durationSec: number;
  bitrateMbps: number;
}

export const DEFAULT_OUTPUT_SETTINGS: Readonly<ShareableOutputSettings> = {
  resolutionKey: '1080p',
  fps: 60,
  durationSec: 2.0,
  bitrateMbps: 16,
};

export interface ShareableAppState {
  presetId: string;
  options: Record<string, any>;
  output: ShareableOutputSettings;
  logoOverlay?: LogoOverlayOptions;
}

export interface ParsedShareState {
  hasShareParams: boolean;
  presetId: string;
  options: Record<string, any>;
  isColorCustomized: boolean;
  output: ShareableOutputSettings;
  logoOverlay: LogoOverlayOptions;
  needsCustomImageNotice: boolean;
}

const HEX_COLOR_RE = /^#?([0-9a-f]{6})$/i;

const COLOR_PARAM_MAP = [
  { optionKey: 'primaryColor', paramKey: 'primary' },
  { optionKey: 'secondaryColor', paramKey: 'secondary' },
  { optionKey: 'accentColor', paramKey: 'accent' },
  { optionKey: 'borderColor', paramKey: 'border' },
  { optionKey: 'glowColor', paramKey: 'glow' },
] as const;

const KNOWN_FIXED_PARAM_KEYS = new Set<string>([
  'preset',
  'res',
  'fps',
  'dur',
  'br',
  'bw',
  'glowOn',
  'glowBlur',
  'logo',
  ...COLOR_PARAM_MAP.map((entry) => entry.paramKey),
]);

function normalizeHexColor(value: string): string | null {
  const match = HEX_COLOR_RE.exec(value.trim());
  if (!match) {
    return null;
  }
  return `#${match[1].toLowerCase()}`;
}

function stripHash(hex: string): string {
  return hex.startsWith('#') ? hex.slice(1).toLowerCase() : hex.toLowerCase();
}

function getDecimalPlaces(step: number): number {
  const str = String(step);
  const dotIdx = str.indexOf('.');
  return dotIdx === -1 ? 0 : str.length - dotIdx - 1;
}

function clampAndStep(raw: number, min: number, max: number, step: number): number {
  const clamped = Math.min(max, Math.max(min, raw));
  const stepped = Math.round((clamped - min) / step) * step + min;
  const bounded = Math.min(max, Math.max(min, stepped));
  const decimals = getDecimalPlaces(step);
  return decimals > 0 ? Number(bounded.toFixed(decimals)) : Math.round(bounded);
}

function parseBooleanParam(raw: string): boolean | null {
  if (raw === '1' || raw === 'true') return true;
  if (raw === '0' || raw === 'false') return false;
  return null;
}

function isFieldVisible(field: PresetParamField<any>, options: Record<string, any>): boolean {
  if (!field.visibleWhen) {
    return true;
  }
  return options[field.visibleWhen.key] === field.visibleWhen.equals;
}

/**
 * 現在のプリセットまたはロゴオーバーレイ設定でカスタム画像が選択されているかを判定する
 */
export function hasSelectedCustomImage(
  preset: PresetPlugin<any>,
  options: Record<string, any>,
  logoOverlay?: LogoOverlayOptions
): boolean {
  const hasPresetImage = preset.params.some(
    (field) =>
      field.type === 'image' && isFieldVisible(field, options) && Boolean(options[field.key])
  );
  const hasLogoImage = Boolean(logoOverlay?.enabled && logoOverlay?.image);
  return hasPresetImage || hasLogoImage;
}

/**
 * 現在の設定からデフォルト値との差分のみを含む共有 URL を生成する
 */
export function buildShareUrl(
  baseUrl: string,
  preset: PresetPlugin<any>,
  state: ShareableAppState
): string {
  const url = new URL(baseUrl);
  const params = new URLSearchParams();

  // 将来デフォルトプリセットが変わっても再現できるよう preset は常に含める
  params.set('preset', state.presetId);

  const defaults = preset.defaultOptions as Record<string, any>;

  // 共通カラー（デフォルトと異なる色のみ）
  for (const { optionKey, paramKey } of COLOR_PARAM_MAP) {
    const currentVal = state.options[optionKey];
    const defaultVal = defaults[optionKey];
    if (typeof currentVal === 'string') {
      const normalizedCurrent = normalizeHexColor(currentVal);
      const normalizedDefault =
        typeof defaultVal === 'string' ? normalizeHexColor(defaultVal) : null;
      if (normalizedCurrent && normalizedCurrent !== normalizedDefault) {
        params.set(paramKey, stripHash(normalizedCurrent));
      }
    }
  }

  // 共通ディテール設定
  if (
    typeof state.options.borderWidth === 'number' &&
    state.options.borderWidth !== defaults.borderWidth
  ) {
    params.set('bw', String(state.options.borderWidth));
  }
  if (typeof state.options.hasGlow === 'boolean' && state.options.hasGlow !== defaults.hasGlow) {
    params.set('glowOn', state.options.hasGlow ? '1' : '0');
  }
  if (typeof state.options.glowBlur === 'number' && state.options.glowBlur !== defaults.glowBlur) {
    params.set('glowBlur', String(state.options.glowBlur));
  }

  // プリセット固有パラメータ（image 型は URL 共有対象外）
  for (const field of preset.params) {
    if (field.type === 'image') {
      continue;
    }
    const currentVal = state.options[field.key];
    const defaultVal = defaults[field.key];
    if (currentVal === undefined || currentVal === defaultVal) {
      continue;
    }
    const paramKey = `p.${field.key}`;
    if (field.type === 'boolean') {
      params.set(paramKey, currentVal ? '1' : '0');
    } else if (field.type === 'range') {
      params.set(paramKey, String(currentVal));
    } else if (field.type === 'select') {
      params.set(paramKey, String(currentVal));
    }
  }

  // 出力設定（デフォルトと異なる項目のみ）
  if (state.output.resolutionKey !== DEFAULT_OUTPUT_SETTINGS.resolutionKey) {
    params.set('res', state.output.resolutionKey);
  }
  if (state.output.fps !== DEFAULT_OUTPUT_SETTINGS.fps) {
    params.set('fps', String(state.output.fps));
  }
  if (Math.abs(state.output.durationSec - DEFAULT_OUTPUT_SETTINGS.durationSec) > 1e-6) {
    params.set('dur', state.output.durationSec.toFixed(1));
  }
  if (state.output.bitrateMbps !== DEFAULT_OUTPUT_SETTINGS.bitrateMbps) {
    params.set('br', String(state.output.bitrateMbps));
  }

  // ロゴオーバーレイ設定（有効時のみ、image 自体は URL 共有対象外）
  const logo = state.logoOverlay;
  if (logo?.enabled) {
    params.set('logo', '1');
    if (logo.animation !== DEFAULT_LOGO_OVERLAY_OPTIONS.animation) {
      params.set('logo.anim', logo.animation);
    }
    if (Math.abs(logo.scale - DEFAULT_LOGO_OVERLAY_OPTIONS.scale) > 1e-6) {
      params.set('logo.scale', logo.scale.toFixed(2));
    }
    if (Math.abs(logo.offsetX - DEFAULT_LOGO_OVERLAY_OPTIONS.offsetX) > 1e-6) {
      params.set('logo.x', logo.offsetX.toFixed(2));
    }
    if (Math.abs(logo.offsetY - DEFAULT_LOGO_OVERLAY_OPTIONS.offsetY) > 1e-6) {
      params.set('logo.y', logo.offsetY.toFixed(2));
    }
    if (Math.abs(logo.startProgress - DEFAULT_LOGO_OVERLAY_OPTIONS.startProgress) > 1e-6) {
      params.set('logo.start', logo.startProgress.toFixed(2));
    }
    if (Math.abs(logo.endProgress - DEFAULT_LOGO_OVERLAY_OPTIONS.endProgress) > 1e-6) {
      params.set('logo.end', logo.endProgress.toFixed(2));
    }
    if (Math.abs(logo.transitionRatio - DEFAULT_LOGO_OVERLAY_OPTIONS.transitionRatio) > 1e-6) {
      params.set('logo.trans', logo.transitionRatio.toFixed(2));
    }
    if (logo.hasShadow !== DEFAULT_LOGO_OVERLAY_OPTIONS.hasShadow) {
      params.set('logo.shadow', logo.hasShadow ? '1' : '0');
    }
    const normShadowColor = normalizeHexColor(logo.shadowColor);
    const normDefaultShadowColor = normalizeHexColor(DEFAULT_LOGO_OVERLAY_OPTIONS.shadowColor);
    if (normShadowColor && normShadowColor !== normDefaultShadowColor) {
      params.set('logo.shadowColor', stripHash(normShadowColor));
    }
    if (logo.shadowBlur !== DEFAULT_LOGO_OVERLAY_OPTIONS.shadowBlur) {
      params.set('logo.shadowBlur', String(logo.shadowBlur));
    }
  }

  url.search = params.toString();
  url.hash = '';
  return url.toString();
}

/**
 * URL クエリ文字列から共有設定を安全に復元する（未知キー・不正値は無視、範囲外はクランプ）
 */
export function parseShareUrl(
  search: string,
  presets: Map<string, PresetPlugin<any>>,
  fallbackPresetId: string
): ParsedShareState {
  const params = new URLSearchParams(search);

  let hasShareParams = false;
  for (const key of params.keys()) {
    if (KNOWN_FIXED_PARAM_KEYS.has(key) || key.startsWith('p.') || key.startsWith('logo.')) {
      hasShareParams = true;
      break;
    }
  }

  const rawPresetId = params.get('preset');
  const presetId = rawPresetId && presets.has(rawPresetId) ? rawPresetId : fallbackPresetId;
  const preset = presets.get(presetId)!;
  const options: Record<string, any> = { ...(preset.defaultOptions as Record<string, any>) };

  let isColorCustomized = false;

  if (hasShareParams) {
    // 共通カラー
    for (const { optionKey, paramKey } of COLOR_PARAM_MAP) {
      const raw = params.get(paramKey);
      if (raw !== null) {
        const normalized = normalizeHexColor(raw);
        if (normalized) {
          options[optionKey] = normalized;
          isColorCustomized = true;
        }
      }
    }

    // 共通ディテール設定
    const rawBw = params.get('bw');
    if (rawBw !== null) {
      const num = Number(rawBw);
      if (Number.isFinite(num)) {
        options.borderWidth = clampAndStep(num, 0, 10, 1);
      }
    }

    const rawGlowOn = params.get('glowOn');
    if (rawGlowOn !== null) {
      const parsedBool = parseBooleanParam(rawGlowOn);
      if (parsedBool !== null) {
        options.hasGlow = parsedBool;
      }
    }

    const rawGlowBlur = params.get('glowBlur');
    if (rawGlowBlur !== null) {
      const num = Number(rawGlowBlur);
      if (Number.isFinite(num)) {
        options.glowBlur = clampAndStep(num, 0, 40, 1);
      }
    }

    // プリセット固有パラメータ（スキーマベースでバリデーション）
    for (const field of preset.params) {
      if (field.type === 'image') {
        continue;
      }
      const raw = params.get(`p.${field.key}`);
      if (raw === null) {
        continue;
      }

      if (field.type === 'range') {
        const num = Number(raw);
        if (Number.isFinite(num)) {
          options[field.key] = clampAndStep(num, field.min, field.max, field.step);
        }
      } else if (field.type === 'boolean') {
        const parsedBool = parseBooleanParam(raw);
        if (parsedBool !== null) {
          options[field.key] = parsedBool;
        }
      } else if (field.type === 'select') {
        if (field.options.some((opt) => opt.value === raw)) {
          options[field.key] = raw;
        }
      }
    }
  }

  // 出力設定
  const output: ShareableOutputSettings = { ...DEFAULT_OUTPUT_SETTINGS };
  if (hasShareParams) {
    const rawRes = params.get('res');
    if (rawRes && rawRes in RESOLUTIONS) {
      output.resolutionKey = rawRes as ResolutionPreset;
    }

    const rawFps = params.get('fps');
    if (rawFps === '30' || rawFps === '60') {
      output.fps = Number(rawFps) as 30 | 60;
    }

    const rawDur = params.get('dur');
    if (rawDur !== null) {
      const num = Number(rawDur);
      if (Number.isFinite(num)) {
        output.durationSec = clampAndStep(num, 1.0, 4.0, 0.1);
      }
    }

    const rawBr = params.get('br');
    if (rawBr !== null) {
      const num = Number(rawBr);
      if (Number.isFinite(num)) {
        output.bitrateMbps = clampAndStep(num, 8, 40, 2);
      }
    }
  }

  // 復元後の設定で画像アップロード欄またはロゴオーバーレイが有効になっている場合は再選択案内を出す
  const logoOverlay: LogoOverlayOptions = { ...DEFAULT_LOGO_OVERLAY_OPTIONS };
  if (hasShareParams) {
    const rawLogo = params.get('logo');
    if (rawLogo !== null) {
      const parsedBool = parseBooleanParam(rawLogo);
      if (parsedBool !== null) {
        logoOverlay.enabled = parsedBool;
      }
    }

    const rawAnim = params.get('logo.anim');
    if (rawAnim && LOGO_OVERLAY_ANIMATIONS.some((a) => a.value === rawAnim)) {
      logoOverlay.animation = rawAnim as LogoOverlayAnimation;
    }

    const rawScale = params.get('logo.scale');
    if (rawScale !== null) {
      const num = Number(rawScale);
      if (Number.isFinite(num)) {
        logoOverlay.scale = clampAndStep(num, 0.1, 0.8, 0.01);
      }
    }

    const rawX = params.get('logo.x');
    if (rawX !== null) {
      const num = Number(rawX);
      if (Number.isFinite(num)) {
        logoOverlay.offsetX = clampAndStep(num, -0.5, 0.5, 0.01);
      }
    }

    const rawY = params.get('logo.y');
    if (rawY !== null) {
      const num = Number(rawY);
      if (Number.isFinite(num)) {
        logoOverlay.offsetY = clampAndStep(num, -0.5, 0.5, 0.01);
      }
    }

    const rawStart = params.get('logo.start');
    if (rawStart !== null) {
      const num = Number(rawStart);
      if (Number.isFinite(num)) {
        logoOverlay.startProgress = clampAndStep(num, 0.0, 0.9, 0.01);
      }
    }

    const rawEnd = params.get('logo.end');
    if (rawEnd !== null) {
      const num = Number(rawEnd);
      if (Number.isFinite(num)) {
        logoOverlay.endProgress = clampAndStep(num, 0.1, 1.0, 0.01);
      }
    }

    if (logoOverlay.endProgress < logoOverlay.startProgress + LOGO_OVERLAY_MIN_DURATION) {
      logoOverlay.endProgress = Math.min(
        1,
        Number((logoOverlay.startProgress + LOGO_OVERLAY_MIN_DURATION).toFixed(2))
      );
      if (logoOverlay.endProgress - logoOverlay.startProgress < LOGO_OVERLAY_MIN_DURATION) {
        logoOverlay.startProgress = Math.max(
          0,
          Number((logoOverlay.endProgress - LOGO_OVERLAY_MIN_DURATION).toFixed(2))
        );
      }
    }

    const rawTrans = params.get('logo.trans');
    if (rawTrans !== null) {
      const num = Number(rawTrans);
      if (Number.isFinite(num)) {
        logoOverlay.transitionRatio = clampAndStep(num, 0.05, 0.5, 0.01);
      }
    }

    const rawShadow = params.get('logo.shadow');
    if (rawShadow !== null) {
      const parsedBool = parseBooleanParam(rawShadow);
      if (parsedBool !== null) {
        logoOverlay.hasShadow = parsedBool;
      }
    }

    const rawShadowColor = params.get('logo.shadowColor');
    if (rawShadowColor !== null) {
      const normalized = normalizeHexColor(rawShadowColor);
      if (normalized) {
        logoOverlay.shadowColor = normalized;
      }
    }

    const rawShadowBlur = params.get('logo.shadowBlur');
    if (rawShadowBlur !== null) {
      const num = Number(rawShadowBlur);
      if (Number.isFinite(num)) {
        logoOverlay.shadowBlur = clampAndStep(num, 0, 50, 1);
      }
    }
  }

  const needsCustomImageNotice =
    hasShareParams &&
    (preset.params.some((field) => field.type === 'image' && isFieldVisible(field, options)) ||
      logoOverlay.enabled);

  return {
    hasShareParams,
    presetId,
    options,
    isColorCustomized,
    output,
    logoOverlay,
    needsCustomImageNotice,
  };
}
