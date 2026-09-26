import { PresetPlugin } from '../../types';
import { HexAnimationPlugin, defaultHexOptions } from './HexAnimation';
import { SlashAnimationPlugin, defaultSlashOptions } from './SlashAnimation';
import { IrisAnimationPlugin, defaultIrisOptions } from './IrisAnimation';
import { GlitchAnimationPlugin, defaultGlitchOptions } from './GlitchAnimation';

export const ALL_PRESETS: PresetPlugin<any>[] = [
  HexAnimationPlugin,
  SlashAnimationPlugin,
  IrisAnimationPlugin,
  GlitchAnimationPlugin,
];

export const PRESET_MAP = new Map<string, PresetPlugin<any>>(
  ALL_PRESETS.map((p) => [p.id, p])
);

export {
  HexAnimationPlugin,
  SlashAnimationPlugin,
  IrisAnimationPlugin,
  GlitchAnimationPlugin,
  defaultHexOptions,
  defaultSlashOptions,
  defaultIrisOptions,
  defaultGlitchOptions,
};
