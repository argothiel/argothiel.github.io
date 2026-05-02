// Mirrors --gold-rgb in styles.css. Kept as the raw RGB triple so it can
// compose with any alpha for both rgba() strings and CSS variable usage.
export const GOLD_RGB = '240,165,0';

// Half-disc arc tuples for ctx.arc(cx, cy, r, ...HALF). Canvas y grows down,
// so RIGHT_HALF traces the right semicircle and LEFT_HALF the left one.
export const RIGHT_HALF = [-Math.PI / 2,    Math.PI / 2];
export const LEFT_HALF  = [ Math.PI / 2, 3 * Math.PI / 2];

// Knuth multiplicative hash → pseudo-random in [0,1). Used for deterministic
// star placement so the field is stable across redraws without storing it.
export function hash01(n) {
  n = (n * 2654435761) >>> 0;
  n = ((n >>> 16) ^ n) * 0x45d9f3b;
  n = ((n >>> 16) ^ n) >>> 0;
  return (n & 0xfffff) / 0x100000;
}

// One starfield drawer for both views. `seedOffset` decorrelates fields so
// the orbital and horizon starfields don't share positions; `alphaScale`
// lets the horizon fade stars in as the sky darkens.
export function drawStars(ctx, W, H, {
  count,
  seedOffset = 0,
  bigSize = 1.5,
  smallSize = 0.8,
  alphaScale = 1,
}) {
  for (let i = 0; i < count; i++) {
    const k = i + seedOffset;
    const x = hash01(k * 3 + 1) * W;
    const y = hash01(k * 3 + 2) * H;
    const r = hash01(k * 3 + 3) < 0.3 ? bigSize : smallSize;
    const a = (0.25 + hash01(k * 5 + 7) * 0.5) * alphaScale;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,255,255,${a})`;
    ctx.fill();
  }
}

export function lerpRGB(from, to, t) {
  const mix = (i) => Math.round(from[i] + (to[i] - from[i]) * t);
  return `rgb(${mix(0)},${mix(1)},${mix(2)})`;
}
