import { describe, expect, it } from 'vitest';
import { COLOR_THEMES, generateRandomColorPalette, hslToHex } from '../colorThemes';

const HEX_COLOR_RE = /^#[0-9a-f]{6}$/;

describe('COLOR_THEMES', () => {
  it('すべてのテーマに一意な ID と有効な 6 桁 HEX カラーが設定されている', () => {
    expect(COLOR_THEMES.length).toBeGreaterThanOrEqual(6);

    const ids = new Set<string>();
    for (const theme of COLOR_THEMES) {
      expect(theme.id.length).toBeGreaterThan(0);
      expect(ids.has(theme.id)).toBe(false);
      ids.add(theme.id);

      expect(theme.name.length).toBeGreaterThan(0);
      expect(theme.reference.length).toBeGreaterThan(0);

      expect(theme.colors.primaryColor).toMatch(HEX_COLOR_RE);
      expect(theme.colors.secondaryColor).toMatch(HEX_COLOR_RE);
      expect(theme.colors.accentColor).toMatch(HEX_COLOR_RE);
      expect(theme.colors.borderColor).toMatch(HEX_COLOR_RE);
      expect(theme.colors.glowColor).toMatch(HEX_COLOR_RE);
    }
  });
});

describe('hslToHex', () => {
  it('基本色・無彩色・負の色相を正しく HEX 変換できる', () => {
    expect(hslToHex(0, 100, 50)).toBe('#ff0000');
    expect(hslToHex(120, 100, 50)).toBe('#00ff00');
    expect(hslToHex(240, 100, 50)).toBe('#0000ff');
    expect(hslToHex(0, 0, 100)).toBe('#ffffff');
    expect(hslToHex(0, 0, 0)).toBe('#000000');
    expect(hslToHex(-60, 100, 50)).toBe('#ff00ff');
    expect(hslToHex(420, 100, 50)).toBe('#ffff00');
  });
});

describe('generateRandomColorPalette', () => {
  it('決定論的 RNG を渡したときに常に有効な 5 色の HEX パレットを返す', () => {
    let seed = 1;
    const seededRng = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };

    for (let i = 0; i < 40; i++) {
      const palette = generateRandomColorPalette(seededRng);
      expect(palette.primaryColor).toMatch(HEX_COLOR_RE);
      expect(palette.secondaryColor).toMatch(HEX_COLOR_RE);
      expect(palette.accentColor).toMatch(HEX_COLOR_RE);
      expect(palette.borderColor).toMatch(HEX_COLOR_RE);
      expect(palette.glowColor).toMatch(HEX_COLOR_RE);
      expect([palette.primaryColor, palette.secondaryColor, palette.accentColor]).toContain(
        palette.glowColor
      );
    }
  });
});
