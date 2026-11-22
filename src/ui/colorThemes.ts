export interface ColorPalette {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  borderColor: string;
  glowColor: string;
}

export interface ColorThemePreset {
  id: string;
  name: string;
  reference: string;
  colors: ColorPalette;
}

/**
 * 定番カラースキームをリファレンスにしたカラーテーマプリセット
 */
export const COLOR_THEMES: readonly ColorThemePreset[] = [
  {
    id: 'tokyo-night',
    name: 'Tokyo Night',
    reference: 'Tokyo Night',
    colors: {
      primaryColor: '#7aa2f7',
      secondaryColor: '#2ac3de',
      accentColor: '#bb9af7',
      borderColor: '#c0caf5',
      glowColor: '#7aa2f7',
    },
  },
  {
    id: 'dracula',
    name: 'Dracula',
    reference: 'Dracula Theme',
    colors: {
      primaryColor: '#bd93f9',
      secondaryColor: '#8be9fd',
      accentColor: '#ff79c6',
      borderColor: '#f8f8f2',
      glowColor: '#bd93f9',
    },
  },
  {
    id: 'catppuccin',
    name: 'Catppuccin',
    reference: 'Catppuccin Mocha',
    colors: {
      primaryColor: '#cba6f7',
      secondaryColor: '#89dceb',
      accentColor: '#f5c2e7',
      borderColor: '#f9e2af',
      glowColor: '#cba6f7',
    },
  },
  {
    id: 'nord',
    name: 'Nord',
    reference: 'Nord Theme',
    colors: {
      primaryColor: '#5e81ac',
      secondaryColor: '#88c0d0',
      accentColor: '#ebcb8b',
      borderColor: '#eceff4',
      glowColor: '#88c0d0',
    },
  },
  {
    id: 'synthwave',
    name: 'Synthwave',
    reference: "Synthwave '84",
    colors: {
      primaryColor: '#ff7edb',
      secondaryColor: '#36f9f6',
      accentColor: '#fede5d',
      borderColor: '#ffffff',
      glowColor: '#ff7edb',
    },
  },
  {
    id: 'gruvbox',
    name: 'Gruvbox',
    reference: 'Gruvbox Dark',
    colors: {
      primaryColor: '#fb4934',
      secondaryColor: '#fe8019',
      accentColor: '#fabd2f',
      borderColor: '#ebdbb2',
      glowColor: '#fe8019',
    },
  },
  {
    id: 'gaming-red',
    name: 'Gaming Red',
    reference: 'eSports Crimson',
    colors: {
      primaryColor: '#dc2626',
      secondaryColor: '#1e293b',
      accentColor: '#f97316',
      borderColor: '#ffffff',
      glowColor: '#ef4444',
    },
  },
  {
    id: 'monochrome',
    name: 'Monochrome',
    reference: 'Noir / Slate',
    colors: {
      primaryColor: '#334155',
      secondaryColor: '#64748b',
      accentColor: '#cbd5e1',
      borderColor: '#ffffff',
      glowColor: '#e2e8f0',
    },
  },
];

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function normalizeHue(h: number): number {
  return ((h % 360) + 360) % 360;
}

/**
 * HSL (h: 0-360, s: 0-100, l: 0-100) を #rrggbb 形式の HEX 文字列へ変換
 */
export function hslToHex(h: number, s: number, l: number): string {
  const hue = normalizeHue(h);
  const sat = clamp(s, 0, 100) / 100;
  const lig = clamp(l, 0, 100) / 100;

  const c = (1 - Math.abs(2 * lig - 1)) * sat;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = lig - c / 2;

  let r = 0;
  let g = 0;
  let b = 0;

  if (hue < 60) {
    r = c;
    g = x;
  } else if (hue < 120) {
    r = x;
    g = c;
  } else if (hue < 180) {
    g = c;
    b = x;
  } else if (hue < 240) {
    g = x;
    b = c;
  } else if (hue < 300) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }

  const toHex = (channel: number) =>
    Math.round(clamp((channel + m) * 255, 0, 255))
      .toString(16)
      .padStart(2, '0');

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

type HarmonyScheme = 'analogous' | 'complementary' | 'triadic' | 'split-complementary';

const HARMONY_SCHEMES: readonly HarmonyScheme[] = [
  'analogous',
  'complementary',
  'triadic',
  'split-complementary',
];

/**
 * HSL 色彩理論（ハーモニー配色）に基づき、配信画面で映えるランダム配色を生成
 */
export function generateRandomColorPalette(rng: () => number = Math.random): ColorPalette {
  const randRange = (min: number, max: number) => min + rng() * (max - min);
  const baseHue = rng() * 360;
  const scheme =
    HARMONY_SCHEMES[Math.floor(rng() * HARMONY_SCHEMES.length) % HARMONY_SCHEMES.length];

  let secondaryHue: number;
  let accentHue: number;

  switch (scheme) {
    case 'analogous':
      secondaryHue = baseHue + randRange(25, 45);
      accentHue = baseHue - randRange(25, 45);
      break;
    case 'complementary':
      secondaryHue = baseHue + randRange(18, 35);
      accentHue = baseHue + 180 + randRange(-15, 15);
      break;
    case 'triadic':
      secondaryHue = baseHue + 120 + randRange(-12, 12);
      accentHue = baseHue + 240 + randRange(-12, 12);
      break;
    case 'split-complementary':
      secondaryHue = baseHue + 150 + randRange(-12, 12);
      accentHue = baseHue + 210 + randRange(-12, 12);
      break;
  }

  const primarySat = randRange(66, 92);
  const primaryLig = randRange(48, 62);
  const secondarySat = randRange(62, 88);
  const secondaryLig = randRange(46, 62);
  const accentSat = randRange(72, 95);
  const accentLig = randRange(54, 68);

  const primaryColor = hslToHex(baseHue, primarySat, primaryLig);
  const secondaryColor = hslToHex(secondaryHue, secondarySat, secondaryLig);
  const accentColor = hslToHex(accentHue, accentSat, accentLig);

  // ボーダーは視認性の高いホワイトまたは明るいティント色
  const borderColor =
    rng() < 0.55 ? '#ffffff' : hslToHex(baseHue, randRange(40, 70), randRange(84, 94));

  // グローはメイン・サブ・アクセントのいずれか鮮やかな色
  const glowCandidates = [primaryColor, secondaryColor, accentColor];
  const glowColor =
    glowCandidates[Math.floor(rng() * glowCandidates.length) % glowCandidates.length];

  return {
    primaryColor,
    secondaryColor,
    accentColor,
    borderColor,
    glowColor,
  };
}
