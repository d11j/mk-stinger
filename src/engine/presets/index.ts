import { PresetPlugin } from '../../types';
import { HexAnimationPlugin, defaultHexOptions } from './HexAnimation';
import { SlashAnimationPlugin, defaultSlashOptions } from './SlashAnimation';
import { IrisAnimationPlugin, defaultIrisOptions } from './IrisAnimation';
import { GlitchAnimationPlugin, defaultGlitchOptions } from './GlitchAnimation';
import { LineWipeAnimationPlugin, defaultLineWipeOptions } from './LineWipeAnimation';
import { SpriteWipeAnimationPlugin, defaultSpriteWipeOptions } from './SpriteWipeAnimation';

export const ALL_PRESETS: PresetPlugin<any>[] = [
  HexAnimationPlugin,
  LineWipeAnimationPlugin,
  SpriteWipeAnimationPlugin,
  SlashAnimationPlugin,
  IrisAnimationPlugin,
  GlitchAnimationPlugin,
];

export const PRESET_MAP = new Map<string, PresetPlugin<any>>(
  ALL_PRESETS.map((p) => [p.id, p])
);

export {
  HexAnimationPlugin,
  LineWipeAnimationPlugin,
  SpriteWipeAnimationPlugin,
  SlashAnimationPlugin,
  IrisAnimationPlugin,
  GlitchAnimationPlugin,
  defaultHexOptions,
  defaultLineWipeOptions,
  defaultSpriteWipeOptions,
  defaultSlashOptions,
  defaultIrisOptions,
  defaultGlitchOptions,
};

