// Observer's horizon view: sky gradient that shifts with Sun altitude,
// stars when dark enough, and the Moon at its current altitude with the
// correct phase rendered on its disc.

import {
  illuminationFraction,
  moonAltitude,
  moonPhaseAngle,
  phaseName,
  sunAltitude,
} from './physics.js';
import { GOLD_RGB, LEFT_HALF, RIGHT_HALF, drawStars, lerpRGB } from './render-utils.js';

// Sky palette stops (top, mid, bottom) for night, twilight, day.
// Twilight keeps the zenith cool and concentrates warm light at the horizon.
const SKY = {
  night:    { top: [3, 6, 15],    mid: [6, 12, 30],    bot: [10, 21, 48]    },
  twilight: { top: [15, 25, 60],  mid: [50, 50, 95],   bot: [220, 110, 70]  },
  day:      { top: [30, 72, 112], mid: [60, 120, 165], bot: [120, 185, 220] },
};

const LAYOUT = {
  horizonFraction:   0.85,  // share of canvas height that is sky
  altitudeScale:     0.85,  // how high alt=+1 reaches in the sky region
  moonRadius:        0.13,  // of canvas height
  moonGlowInner:     0.8,   // multipliers on moon radius
  moonGlowOuter:     2.2,
  starCount:         50,
  starSeedOffset:    100,   // decorrelate from orbital starfield
  starBigSize:       1.2,
  starSmallSize:     0.6,
  phaseLabelFont:    0.075,
  phaseLabelY:       0.96,
};

const COLOR = {
  ground:       '#0a0d18',
  horizonLine:  `rgba(${GOLD_RGB},0.4)`,
  moonLit:      '#e8ecf4',
  moonDark:     '#252835',
  moonRim:      'rgba(150,160,200,0.3)',
  phaseLabel:   `rgba(${GOLD_RGB},0.85)`,
};

export function drawHorizon(ctx, state) {
  const W = ctx.canvas.width;
  const H = ctx.canvas.height;
  ctx.clearRect(0, 0, W, H);

  const sunAlt   = sunAltitude(state);
  const moonAlt  = moonAltitude(state);
  const horizonY = H * LAYOUT.horizonFraction;
  const skyHeight = horizonY;

  drawSky(ctx, W, skyHeight, sunAlt);
  drawSkyStars(ctx, W, skyHeight, sunAlt);
  drawGround(ctx, W, H, horizonY);
  drawHorizonLine(ctx, W, horizonY);

  const moonR = H * LAYOUT.moonRadius;
  const moonX = W * 0.5;
  const moonY = altitudeToY(moonAlt, horizonY, skyHeight);
  const illum = illuminationFraction(state);
  const waxing = moonPhaseAngle(state) <= Math.PI;

  if (moonAlt > 0 && illum > 0.1) drawMoonGlow(ctx, moonX, moonY, moonR, illum);
  drawMoonPhase(ctx, moonX, moonY, moonR, illum, waxing);
  drawPhaseLabel(ctx, W, H, state);
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

function drawPhaseLabel(ctx, W, H, state) {
  ctx.font = `${H * LAYOUT.phaseLabelFont}px 'Syne', sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillStyle = COLOR.phaseLabel;
  ctx.fillText(phaseName(state), W / 2, H * LAYOUT.phaseLabelY);
}

// ── Mini Moon disc with the current phase ──────────────────────────────────
// Three layers, clipped to the disc:
//   1. dark background
//   2. lit semicircle (right when waxing, left when waning)
//   3. terminator ellipse — width = |cos α|·r where α is the phase angle.
//      Crescent (illum < 0.5): ellipse on the LIT side, painted dark
//                              → carves a crescent out of the lit half.
//      Gibbous  (illum > 0.5): ellipse on the DARK side, painted lit
//                              → extends the lit region past the centre.
//      At the limits: illum = 1 → termX = r → ellipse covers the dark
//      hemisphere completely (full moon); illum = 0 → ellipse covers the
//      lit hemisphere completely (new moon).

function drawMoonPhase(ctx, mx, my, r, illum, waxing) {
  ctx.beginPath();
  ctx.arc(mx, my, r, 0, Math.PI * 2);
  ctx.fillStyle = COLOR.moonDark;
  ctx.fill();

  ctx.save();
  ctx.beginPath();
  ctx.arc(mx, my, r, 0, Math.PI * 2);
  ctx.clip();

  drawLitHemisphere(ctx, mx, my, r, waxing);
  drawTerminator(ctx, mx, my, r, illum, waxing);

  ctx.restore();

  ctx.beginPath();
  ctx.arc(mx, my, r, 0, Math.PI * 2);
  ctx.strokeStyle = COLOR.moonRim;
  ctx.lineWidth = 1;
  ctx.stroke();
}

function drawLitHemisphere(ctx, mx, my, r, waxing) {
  const [start, end] = waxing ? RIGHT_HALF : LEFT_HALF;
  ctx.beginPath();
  ctx.arc(mx, my, r, start, end);
  ctx.closePath();
  ctx.fillStyle = COLOR.moonLit;
  ctx.fill();
}

function drawTerminator(ctx, mx, my, r, illum, waxing) {
  // |cos α| = |1 − 2·illum|, since illum = (1 − cos α) / 2.
  const termX = Math.abs(1 - 2 * illum) * r;
  const crescent = illum < 0.5;

  // The lit hemisphere is on the right when waxing, left when waning.
  // Crescent → paint a dark ellipse over the lit side (carve a sliver).
  // Gibbous  → paint a lit  ellipse over the dark side (extend lit area).
  const ellipseOnRight = crescent ? waxing : !waxing;
  const [start, end] = ellipseOnRight ? RIGHT_HALF : LEFT_HALF;

  ctx.beginPath();
  ctx.ellipse(mx, my, termX, r, 0, start, end, false);
  ctx.closePath();
  ctx.fillStyle = crescent ? COLOR.moonDark : COLOR.moonLit;
  ctx.fill();
}
