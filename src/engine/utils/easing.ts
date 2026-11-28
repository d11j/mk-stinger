/**
 * 値を 0.0 〜 1.0 の範囲にクランプする
 */
export function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

/**
 * 緩急のある3次イージング (In-Out Cubic)
 */
export function easeInOutCubic(x: number): number {
  const t = clamp01(x);
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/**
 * 鋭い加速・減速の指数イージング (In-Out Expo)
 */
export function easeInOutExpo(x: number): number {
  const t = clamp01(x);
  if (t === 0) return 0;
  if (t === 1) return 1;
  return t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2;
}

/**
 * 少し行き過ぎて戻る終了イージング (Out Back)
 */
export function easeOutBack(x: number): number {
  const t = clamp01(x);
  if (t === 0) return 0;
  if (t === 1) return 1;
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

/**
 * 少し引いてから加速する開始イージング (In Back)
 */
export function easeInBack(x: number): number {
  const t = clamp01(x);
  if (t === 0) return 0;
  if (t === 1) return 1;
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return c3 * t * t * t - c1 * t * t;
}

/**
 * 収縮フェーズ用イージング（ややゆっくり溜めて中心へ向かって加速）
 */
export function easeInCharge(x: number): number {
  const t = clamp01(x);
  return 0.2 * t + 0.8 * t * t * t;
}

/**
 * 強い加速の4次イージング (In Quart)
 */
export function easeInQuart(x: number): number {
  const t = clamp01(x);
  return t * t * t * t;
}

/**
 * 拡大フェーズ用イージング（中心から一気に高速で抜ける）
 */
export function easeOutBurst(x: number): number {
  const t = clamp01(x);
  return 1 - Math.pow(1 - t, 4);
}
