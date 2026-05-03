// Top-down view of the Sun-Earth-Moon system. The Sun is treated as
// infinitely far, so its rays are parallel along +x: Earth's day side and
// the Moon's lit side are always the right halves of their discs. Earth's
// axial tilt is shown only as a tilted axis line; the observer rides a
// clean equatorial circle (a proper projection would be an ellipse with
// semi-minor axis r·sin(ε), but that's more detail than this view needs).

import { moonPhaseAngle } from './physics.js';
import { GOLD_RGB, LEFT_HALF, drawStars } from './render-utils.js';

const EARTH_TILT = 23.5 * Math.PI / 180;

const COLOR = {
  bg:           '#050810',
  nightOverlay: 'rgba(0,3,12,0.92)',
  sunGlowIn:    'rgba(255,220,80,0.35)',
  sunGlowOut:   'rgba(255,180,0,0)',
  earthRim:     'rgba(80,160,255,0.5)',
  moonRim:      'rgba(200,210,240,0.35)',
  axisLine:     'rgba(255,255,255,0.15)',
  orbitRing:    'rgba(255,255,255,0.08)',
  sunRay:       'rgba(255,220,100,0.15)',
  moonRay:      'rgba(200,205,216,0.2)',
  observer:     `rgb(${GOLD_RGB})`,
  observerHalo: `rgba(${GOLD_RGB},0.5)`,
  phaseArc:     `rgba(${GOLD_RGB},0.4)`,
  labelSun:     `rgba(${GOLD_RGB},0.7)`,
  labelEarth:   'rgba(80,160,255,0.7)',
  labelMoon:    'rgba(200,205,216,0.7)',
};

// Layout fractions (multiplied by canvas width unless noted).
const LAYOUT = {
  sunOffsetRight: 2.45, // Sun centre this fraction of canvas width past the right edge
  sunRadius:      2.50,
  sunGlow:        1.25,  // glow radius / sun radius
  earthRadius:   0.055,
  moonOrbit:     0.26,
  moonSize:      0.42,  // moon radius / earth radius
  observerDot:        3,  // px
  observerHaloRadius: 5,  // px (ring around the observer dot)
  starCount:     80,
  labelFont:     0.028,
  labelOffsetSE: 0.04,  // sun & earth label offset below body
  labelOffsetEx: 0.05,  // earth label extra offset
  labelMoonGap:  0.04,
  labelDescent:  0.015,
  phaseArcRel:   0.18,  // phase arc radius / moon orbit radius
};

// Geometry derived from canvas size and state — exported so the input layer
// can hit-test the draggable Moon and observer without duplicating layout math.
export function orbitalGeometry(canvas, state) {
  const W = canvas.width;
  const H = canvas.height;
  const cx = W / 2;
  const cy = H / 2;
  const earthR = W * LAYOUT.earthRadius;
  const moonOrbitR = W * LAYOUT.moonOrbit;
  const moonR = earthR * LAYOUT.moonSize;
  const sunX = W + W * LAYOUT.sunOffsetRight;
  const sunY = cy;
  const sunR = W * LAYOUT.sunRadius;

  // Canvas y grows downward, so the conventional CCW angle uses (cos, -sin).
  const moonAngle = moonPhaseAngle(state);
  const mX = cx + Math.cos(moonAngle) * moonOrbitR;
  const mY = cy - Math.sin(moonAngle) * moonOrbitR;

  const obsAngle = ((state.timeOfDay - 12) / 24) * Math.PI * 2;
  const oX = cx + Math.cos(obsAngle) * earthR;
  const oY = cy - Math.sin(obsAngle) * earthR;

  return { W, H, cx, cy, earthR, moonOrbitR, moonR, sunX, sunY, sunR, mX, mY, oX, oY };
}

export function drawOrbital(ctx, state) {
  const W = ctx.canvas.width;
  const H = ctx.canvas.height;
  const g = orbitalGeometry(ctx.canvas, state);
  const { cx, cy, earthR, moonOrbitR, moonR, sunX, sunY, sunR, mX, mY, oX, oY } = g;

  ctx.fillStyle = COLOR.bg;
  ctx.fillRect(0, 0, W, H);
  drawStars(ctx, W, H, { count: LAYOUT.starCount });

  drawOrbit(ctx, cx, cy, moonOrbitR);
  drawDirectionLine(ctx, cx, cy, sunX, sunY, COLOR.sunRay);
  drawDirectionLine(ctx, cx, cy, mX,  mY,  COLOR.moonRay);
  drawSun(ctx, sunX, sunY, sunR);
  drawEarth(ctx, cx, cy, earthR);
  drawObserver(ctx, oX, oY);
  drawMoon(ctx, mX, mY, moonR);
  drawLabels(ctx, W, { cx, cy, sunX, sunY, sunR, mX, mY, earthR, moonR });
  drawPhaseArc(ctx, cx, cy, moonOrbitR * LAYOUT.phaseArcRel, moonPhaseAngle(state));
}

function drawOrbit(ctx, cx, cy, r) {
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = COLOR.orbitRing;
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 8]);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawDirectionLine(ctx, x1, y1, x2, y2, color) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.stroke();
}

function drawSun(ctx, x, y, r) {
  const glow = ctx.createRadialGradient(x, y, r * 0.5, x, y, r * LAYOUT.sunGlow);
  glow.addColorStop(0, COLOR.sunGlowIn);
  glow.addColorStop(1, COLOR.sunGlowOut);
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, y, r * LAYOUT.sunGlow, 0, Math.PI * 2);
  ctx.fill();

  const body = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 0, x, y, r);
  body.addColorStop(0, '#fff8c0');
  body.addColorStop(0.5, '#ffe066');
  body.addColorStop(1, `rgb(${GOLD_RGB})`);
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function drawEarth(ctx, cx, cy, r) {
  const grad = ctx.createRadialGradient(cx + r * 0.4, cy - r * 0.2, 0, cx, cy, r * 1.2);
  grad.addColorStop(0, '#6ab4ee');
  grad.addColorStop(0.5, '#2a6fbf');
  grad.addColorStop(1, '#0a2a5e');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  // Night side: left half (Sun is at +x).
  ctx.beginPath();
  ctx.arc(cx, cy, r, ...LEFT_HALF);
  ctx.closePath();
  ctx.fillStyle = COLOR.nightOverlay;
  ctx.fill();

  // Tilted rotation axis (visual cue only; the terminator stays vertical).
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(EARTH_TILT);
  ctx.beginPath();
  ctx.moveTo(0, -r * 1.25);
  ctx.lineTo(0,  r * 1.25);
  ctx.strokeStyle = COLOR.axisLine;
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 4]);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = COLOR.earthRim;
  ctx.lineWidth = 2;
  ctx.stroke();
}

// Observer rides Earth's equatorial circle; noon (12 h) puts them on the
// sunlit side (+x), midnight (0 h) on the night side (−x). Tilt is shown
// by the axis line, not by displacing the observer's longitude. Position
// is computed in orbitalGeometry so the input layer can hit-test it.
function drawObserver(ctx, x, y) {
  ctx.beginPath();
  ctx.arc(x, y, LAYOUT.observerDot, 0, Math.PI * 2);
  ctx.fillStyle = COLOR.observer;
  ctx.fill();

  ctx.beginPath();
  ctx.arc(x, y, LAYOUT.observerHaloRadius, 0, Math.PI * 2);
  ctx.strokeStyle = COLOR.observerHalo;
  ctx.lineWidth = 1;
  ctx.stroke();
}

function drawMoon(ctx, x, y, r) {
  const grad = ctx.createRadialGradient(x + r * 0.3, y - r * 0.15, 0, x, y, r);
  grad.addColorStop(0, '#f0f3ff');
  grad.addColorStop(0.5, '#c8cdd8');
  grad.addColorStop(1, '#6a7090');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();

  // Night hemisphere: always the left half (Sun at +x).
  ctx.beginPath();
  ctx.arc(x, y, r, ...LEFT_HALF);
  ctx.closePath();
  ctx.fillStyle = COLOR.nightOverlay;
  ctx.fill();

  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.strokeStyle = COLOR.moonRim;
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function drawLabels(ctx, W, p) {
  ctx.font = `${W * LAYOUT.labelFont}px 'Syne Mono', monospace`;
  ctx.textAlign = 'center';

  // Sun centre is off-canvas; label sits just inside the visible left edge of the Sun.
  const sunVisibleEdgeX = p.sunX - p.sunR;
  ctx.textAlign = 'right';
  drawLabel(ctx, 'SUN', sunVisibleEdgeX - W * 0.012, p.sunY, COLOR.labelSun);
  ctx.textAlign = 'center';
  drawLabel(ctx, 'EARTH', p.cx,   p.cy   + p.earthR + W * LAYOUT.labelOffsetEx, COLOR.labelEarth);

  const dx = p.mX - p.cx;
  const dy = p.mY - p.cy;
  const len = Math.sqrt(dx * dx + dy * dy);
  drawLabel(ctx, 'MOON',
    p.mX + (dx / len) * (p.moonR + W * LAYOUT.labelMoonGap),
    p.mY + (dy / len) * (p.moonR + W * LAYOUT.labelMoonGap) + W * LAYOUT.labelDescent,
    COLOR.labelMoon,
  );
}

function drawLabel(ctx, text, x, y, color) {
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

// Expanding gold rings over the draggable elements (Moon + observer) —
// a load-time hint. Loops indefinitely; the caller stops calling on first
// interaction. Both elements pulse in sync so the user reads them as a pair.
const PULSE_RING_MS = 1500;
const PULSE_STAGGER_MS = 750;
const PULSE_RING_COUNT = 2;

export function drawDragHints(ctx, state, elapsedMs) {
  const g = orbitalGeometry(ctx.canvas, state);
  ctx.save();
  for (let i = 0; i < PULSE_RING_COUNT; i++) {
    // Phase each ring within the same cycle; modulo gives a seamless repeat.
    const t = ((elapsedMs - i * PULSE_STAGGER_MS) % PULSE_RING_MS + PULSE_RING_MS) % PULSE_RING_MS;
    const u = t / PULSE_RING_MS;
    const alpha = (1 - u) * 0.55;
    const stroke = `rgba(${GOLD_RGB},${alpha})`;

    // Moon pulse: expand well past the Moon's disc.
    drawPulseRing(ctx, g.mX, g.mY, g.moonR * (1.15 + u * 3.6), stroke);

    // Observer pulse: cap near Earth's disc so it doesn't sprawl into the
    // orbital ring or compete with the Moon's pulse for visual space.
    const obsBase = LAYOUT.observerHaloRadius;
    const obsMax  = g.earthR * 1.6;
    drawPulseRing(ctx, g.oX, g.oY, obsBase + u * (obsMax - obsBase), stroke);
  }
  ctx.restore();
}

function drawPulseRing(ctx, x, y, r, stroke) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function drawPhaseArc(ctx, cx, cy, r, angle) {
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, -angle, true);
  ctx.strokeStyle = COLOR.phaseArc;
  ctx.lineWidth = 1.5;
  ctx.stroke();
}
