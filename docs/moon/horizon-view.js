// Observer's horizon view: sky gradient that shifts with Sun altitude,
// stars when dark enough, and the Moon at its current altitude with the
// correct phase rendered on its disc.

import {
  illuminationFraction,
  moonAltitude,
  moonPhaseAngle,
  sunAltitude,
} from './physics.js';
import { GOLD_RGB, drawStars, lerpRGB } from './render-utils.js';

// Sky palette stops (top, mid, bottom) for night, twilight, day.
// Twilight keeps the zenith cool and concentrates warm light at the horizon.
const SKY = {
  night:    { top: [3, 6, 15],    mid: [6, 12, 30],    bot: [10, 21, 48]    },
  twilight: { top: [15, 25, 60],  mid: [50, 50, 95],   bot: [220, 110, 70]  },
  day:      { top: [30, 72, 112], mid: [60, 120, 165], bot: [120, 185, 220] },
};

const LAYOUT = {
  // Default share of canvas height that is sky. drawHorizon accepts an override
  // so the caller can pin the horizon line to a layout landmark (the info-bar
  // top edge) regardless of how the strip is sized vs the rest of the panel.
  defaultHorizonFraction: 0.85,
  altitudeScale:     0.85,  // how high alt=+1 reaches in the sky region
  moonRadius:        0.40,  // of min(W, H) — scales for narrow strip
  moonGlowInner:     0.8,   // multipliers on moon radius
  moonGlowOuter:     2.2,
  starCount:         50,
  starSeedOffset:    100,   // decorrelate from orbital starfield
  starBigSize:       1.2,
  starSmallSize:     0.6,
};

const COLOR = {
  ground:       '#0a0d18',
  horizonLine:  `rgba(${GOLD_RGB},0.4)`,
  moonLit:      '#e8ecf4',
  moonDark:     '#252835',
  moonRim:      'rgba(150,160,200,0.3)',
};

export function drawHorizon(ctx, state, horizonFraction = LAYOUT.defaultHorizonFraction) {
  const W = ctx.canvas.width;
  const H = ctx.canvas.height;
  ctx.clearRect(0, 0, W, H);

  const sunAlt   = sunAltitude(state);
  const moonAlt  = moonAltitude(state);
  const horizonY = H * horizonFraction;
  const skyHeight = horizonY;

  drawSky(ctx, W, skyHeight, sunAlt);
  drawSkyStars(ctx, W, skyHeight, sunAlt);
  drawGround(ctx, W, H, horizonY);
  drawHorizonLine(ctx, W, horizonY);

  const moonR = Math.min(W, H) * LAYOUT.moonRadius;
  const moonX = W * 0.5;
  const moonY = altitudeToY(moonAlt, horizonY, skyHeight);
  const illum = illuminationFraction(state);
  const waxing = moonPhaseAngle(state) <= Math.PI;

  if (moonAlt > 0 && illum > 0.1) drawMoonGlow(ctx, moonX, moonY, moonR, illum);
  drawMoonPhase(ctx, moonX, moonY, moonR, illum, waxing);
}

// altitude +1 → high in sky, 0 → on horizon, −1 → fully below ground.
function altitudeToY(alt, horizonY, skyHeight) {
  return horizonY - alt * skyHeight * LAYOUT.altitudeScale;
}

function drawSky(ctx, W, skyHeight, sunAlt) {
  const { top, mid, bot } = pickSkyStops(sunAlt);
  const grad = ctx.createLinearGradient(0, 0, 0, skyHeight);
  grad.addColorStop(0,   top);
  grad.addColorStop(0.6, mid);
  grad.addColorStop(1,   bot);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, skyHeight);
}

function pickSkyStops(sunAlt) {
  if (sunAlt > 0.15)  return blendStops(SKY.day,      SKY.day,      0);
  if (sunAlt > -0.05) return blendStops(SKY.twilight, SKY.day,      (sunAlt + 0.05) / 0.20);
  if (sunAlt > -0.25) return blendStops(SKY.night,    SKY.twilight, (sunAlt + 0.25) / 0.20);
  return blendStops(SKY.night, SKY.night, 0);
}

function blendStops(a, b, t) {
  return {
    top: lerpRGB(a.top, b.top, t),
    mid: lerpRGB(a.mid, b.mid, t),
    bot: lerpRGB(a.bot, b.bot, t),
  };
}

function drawSkyStars(ctx, W, skyHeight, sunAlt) {
  if (sunAlt >= -0.1) return;
  const alphaScale = Math.min(1, (-sunAlt - 0.1) / 0.5);
  drawStars(ctx, W, skyHeight, {
    count:      LAYOUT.starCount,
    seedOffset: LAYOUT.starSeedOffset,
    bigSize:    LAYOUT.starBigSize,
    smallSize:  LAYOUT.starSmallSize,
    alphaScale,
  });
}

function drawGround(ctx, W, H, horizonY) {
  ctx.fillStyle = COLOR.ground;
  ctx.fillRect(0, horizonY, W, H - horizonY);
}

function drawHorizonLine(ctx, W, y) {
  ctx.beginPath();
  ctx.moveTo(0, y);
  ctx.lineTo(W, y);
  ctx.strokeStyle = COLOR.horizonLine;
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 6]);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawMoonGlow(ctx, x, y, r, illum) {
  const inner = r * LAYOUT.moonGlowInner;
  const outer = r * LAYOUT.moonGlowOuter;
  const glow = ctx.createRadialGradient(x, y, inner, x, y, outer);
  glow.addColorStop(0, `rgba(220,225,245,${illum * 0.25})`);
  glow.addColorStop(1, 'rgba(220,225,245,0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, y, outer, 0, Math.PI * 2);
  ctx.fill();
}

// ── Mini Moon disc with the current phase ──────────────────────────────────
// Lit region drawn as a single closed path: the lit-side disc arc joined to
// a terminator half-ellipse of width termX = |cos α|·r (since
// illum = (1 − cos α)/2). Doing this in one path — rather than a lit
// semicircle + a separate terminator ellipse butted at the diameter —
// avoids the AA seam visible on high-DPI displays where the two paths'
// anti-aliased edges left a 1-px column of the dark base showing through.

function drawMoonPhase(ctx, mx, my, r, illum, waxing) {
  // Dark disc shows through wherever the lit path doesn't cover.
  ctx.beginPath();
  ctx.arc(mx, my, r, 0, Math.PI * 2);
  ctx.fillStyle = COLOR.moonDark;
  ctx.fill();

  const termX = Math.abs(1 - 2 * illum) * r;
  const crescent = illum < 0.5;
  // The terminator half-ellipse bulges right for waxing crescent and
  // waning gibbous; left otherwise.
  const ellipseRight = crescent === waxing;

  ctx.beginPath();
  // Lit-side disc edge, top → bottom: via +x (waxing) or via −x (waning).
  ctx.arc(mx, my, r, -Math.PI / 2, Math.PI / 2, !waxing);
  // Terminator, bottom → top, via the chosen side.
  ctx.ellipse(mx, my, termX, r, 0, Math.PI / 2, -Math.PI / 2, ellipseRight);
  ctx.closePath();
  ctx.fillStyle = COLOR.moonLit;
  ctx.fill();

  ctx.beginPath();
  ctx.arc(mx, my, r, 0, Math.PI * 2);
  ctx.strokeStyle = COLOR.moonRim;
  ctx.lineWidth = 1;
  ctx.stroke();
}
