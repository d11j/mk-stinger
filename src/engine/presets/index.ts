import { PresetPlugin } from '../../types';
import { HexAnimationPlugin, defaultHexOptions } from './HexAnimation';
import { SlashAnimationPlugin, defaultSlashOptions } from './SlashAnimation';
import { GlitchAnimationPlugin, defaultGlitchOptions } from './GlitchAnimation';
import { LineWipeAnimationPlugin, defaultLineWipeOptions } from './LineWipeAnimation';
import { SpriteWipeAnimationPlugin, defaultSpriteWipeOptions } from './SpriteWipeAnimation';
import { HyperJumpAnimationPlugin, defaultHyperJumpOptions } from './HyperJumpAnimation';
import { ShutterGateAnimationPlugin, defaultShutterGateOptions } from './ShutterGateAnimation';

export const ALL_PRESETS: PresetPlugin<any>[] = [
  HexAnimationPlugin,
  ShutterGateAnimationPlugin,
  LineWipeAnimationPlugin,
  SpriteWipeAnimationPlugin,
  HyperJumpAnimationPlugin,
  SlashAnimationPlugin,
  GlitchAnimationPlugin,
];

export const PRESET_MAP = new Map<string, PresetPlugin<any>>(ALL_PRESETS.map((p) => [p.id, p]));

export {
  HexAnimationPlugin,
  ShutterGateAnimationPlugin,
  LineWipeAnimationPlugin,
  SpriteWipeAnimationPlugin,
  HyperJumpAnimationPlugin,
  SlashAnimationPlugin,
  GlitchAnimationPlugin,
  defaultHexOptions,
  defaultShutterGateOptions,
  defaultLineWipeOptions,
  defaultSpriteWipeOptions,
  defaultHyperJumpOptions,
  defaultSlashOptions,
  defaultGlitchOptions,
};
