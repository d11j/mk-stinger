import { describe, expect, it } from 'vitest';
import {
  clamp01,
  easeInBack,
  easeInCharge,
  easeInOutCubic,
  easeInOutExpo,
  easeInQuart,
  easeOutBack,
  easeOutBurst,
} from '../easing';

describe('clamp01', () => {
  it('0〜1の範囲外をクランプすること', () => {
    expect(clamp01(-0.5)).toBe(0);
    expect(clamp01(0)).toBe(0);
    expect(clamp01(0.42)).toBe(0.42);
    expect(clamp01(1)).toBe(1);
    expect(clamp01(1.5)).toBe(1);
  });
});

describe.each([
  ['easeInOutCubic', easeInOutCubic],
  ['easeInOutExpo', easeInOutExpo],
  ['easeOutBack', easeOutBack],
  ['easeInBack', easeInBack],
  ['easeInCharge', easeInCharge],
  ['easeInQuart', easeInQuart],
  ['easeOutBurst', easeOutBurst],
])('%s', (_name, fn) => {
  it('境界値 0 と 1 でそれぞれ 0 と 1 を返すこと', () => {
    expect(fn(0)).toBe(0);
    expect(fn(1)).toBe(1);
  });

  it('範囲外の入力を 0〜1 にクランプすること', () => {
    expect(fn(-1)).toBe(0);
    expect(fn(2)).toBe(1);
  });
});

describe('イージング関数の曲線特性', () => {
  it('easeInOutCubic と easeInOutExpo は中間点 0.5 で 0.5 を返すこと', () => {
    expect(easeInOutCubic(0.5)).toBeCloseTo(0.5, 6);
    expect(easeInOutExpo(0.5)).toBeCloseTo(0.5, 6);
  });

  it('easeOutBack は後半に 1 をわずかにオーバーシュートすること', () => {
    expect(easeOutBack(0.7)).toBeGreaterThan(1);
  });

  it('easeInBack は序盤に 0 未満へ引くこと', () => {
    expect(easeInBack(0.3)).toBeLessThan(0);
  });

  it('easeInCharge / easeInQuart は加速型、easeOutBurst は減速型であること', () => {
    expect(easeInCharge(0.5)).toBeLessThan(0.5);
    expect(easeInQuart(0.5)).toBeCloseTo(0.0625, 6);
    expect(easeOutBurst(0.5)).toBeGreaterThan(0.5);
  });
});
