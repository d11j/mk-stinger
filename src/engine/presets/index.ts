import { PresetPlugin } from '../../types';
import { HexAnimationPlugin, defaultHexOptions } from './HexAnimation';
import { SlashAnimationPlugin, defaultSlashOptions } from './SlashAnimation';
import { GlitchAnimationPlugin, defaultGlitchOptions } from './GlitchAnimation';
import { LineWipeAnimationPlugin, defaultLineWipeOptions } from './LineWipeAnimation';
import { SpriteWipeAnimationPlugin, defaultSpriteWipeOptions } from './SpriteWipeAnimation';
import { HyperJumpAnimationPlugin, defaultHyperJumpOptions } from './HyperJumpAnimation';

export const ALL_PRESETS: PresetPlugin<any>[] = [
  HexAnimationPlugin,
  LineWipeAnimationPlugin,
  SpriteWipeAnimationPlugin,
  HyperJumpAnimationPlugin,
  SlashAnimationPlugin,
  GlitchAnimationPlugin,
];

export const PRESET_MAP = new Map<string, PresetPlugin<any>>(
  ALL_PRESETS.map((p) => [p.id, p])
);

export {
  HexAnimationPlugin,
  LineWipeAnimationPlugin,
  SpriteWipeAnimationPlugin,
  HyperJumpAnimationPlugin,
  SlashAnimationPlugin,
  GlitchAnimationPlugin,
  defaultHexOptions,
  defaultLineWipeOptions,
  defaultSpriteWipeOptions,
  defaultHyperJumpOptions,
  defaultSlashOptions,
  defaultGlitchOptions,
};

