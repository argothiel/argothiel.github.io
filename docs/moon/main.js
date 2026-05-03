// Entry point. Owns the application state and drives the render pipeline.
// The two views (orbital, horizon) are pure functions of (ctx, state);
// physics functions are pure functions of state. State is mutated by
// dragging the Moon or observer directly on the orbital canvas.

import { drawOrbital, orbitalGeometry, drawDragHints } from './orbital-view.js';
import { drawHorizon } from './horizon-view.js';
import { LUNAR_CYCLE_DAYS, phaseName } from './physics.js';

const state = {
  lunarDay:  0,
  timeOfDay: 12,
};

const orbCanvas     = document.getElementById('orbitalCanvas');
const horizonCanvas = document.getElementById('horizonCanvas');
const orbCtx        = orbCanvas.getContext('2d');
const horizonCtx    = horizonCanvas.getContext('2d');

const ui = {
  lunarDayVal:  document.getElementById('lunarDayVal'),
  timeOfDayVal: document.getElementById('timeOfDayVal'),
  phaseName:    document.getElementById('phaseName'),
  resetButton:  document.getElementById('resetButton'),
  playButton:   document.getElementById('playButton'),
};

const DEFAULT_STATE = { lunarDay: 0, timeOfDay: 12 };

ui.resetButton.addEventListener('click', () => {
  setPlaying(false);
  state.lunarDay  = DEFAULT_STATE.lunarDay;
  state.timeOfDay = DEFAULT_STATE.timeOfDay;
  render();
});

// Compensate time-of-day so the Moon stays at the same altitude:
// moonAltitude = sunAltitude(timeOfDay - 24 * lunarDay / 29.5),
// so holding (timeOfDay - 24 * lunarDay / 29.5) constant pins altitude.
function setLunarDay(next) {
  const dt = (next - state.lunarDay) * 24 / LUNAR_CYCLE_DAYS;
  state.lunarDay = next;
  state.timeOfDay = ((state.timeOfDay + dt) % 24 + 24) % 24;
  render();
}

function setTimeOfDay(next) {
  state.timeOfDay = ((next % 24) + 24) % 24;
  render();
}

function updateInfo() {
  ui.lunarDayVal.textContent  = state.lunarDay.toFixed(1);
  ui.timeOfDayVal.textContent = formatHHMM(state.timeOfDay);
  ui.phaseName.textContent    = phaseName(state);
  // Disable the reset button when there's nothing to reset, so it stops
  // shouting for attention until the user has actually moved something.
  ui.resetButton.disabled =
    state.lunarDay  === DEFAULT_STATE.lunarDay &&
    state.timeOfDay === DEFAULT_STATE.timeOfDay;
}

function formatHHMM(hours) {
  const h = Math.floor(hours);
  const m = Math.floor((hours - h) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function resizeCanvases() {
  // CSS now drives canvas display size (orbital is square, horizon strip
  // matches its height). Sync the internal pixel dimensions to whatever
  // layout produced — works even if column widths shift on resize.
  for (const c of [orbCanvas, horizonCanvas]) {
    const rect = c.getBoundingClientRect();
    c.width  = Math.max(1, Math.round(rect.width));
    c.height = Math.max(1, Math.round(rect.height));
  }
}

// Pin the horizon line on the strip to the info-bar's top edge so the strip's
// "ground" continues seamlessly into the info-bar and its dark sibling cell.
function computeHorizonFraction() {
  const strip = horizonCanvas.getBoundingClientRect();
  const info  = document.querySelector('.info-panel').getBoundingClientRect();
  if (strip.height <= 0) return undefined;
  const f = (info.top - strip.top) / strip.height;
  return Math.min(1, Math.max(0, f));
}

function render() {
  drawOrbital(orbCtx, state);
  drawHorizon(horizonCtx, state, computeHorizonFraction());
  updateInfo();
}

// Coalesce burst resize events into one redraw per animation frame.
let resizePending = false;
window.addEventListener('resize', () => {
  if (resizePending) return;
  resizePending = true;
  requestAnimationFrame(() => {
    resizePending = false;
    resizeCanvases();
    render();
  });
});

// Drag the Moon or the observer directly on the orbital canvas. Hit-test in
// canvas-internal pixels (CSS pixels are scaled to that via getBoundingClientRect).
// Touch fingers need a larger hit target than a mouse cursor.
const coarsePointer = window.matchMedia?.('(pointer: coarse)').matches;
const HIT_SLACK_PX  = coarsePointer ? 22 : 8;
const OBS_HIT_PX    = coarsePointer ? 22 : 16;
let drag = null;

function canvasPoint(e) {
  const rect = orbCanvas.getBoundingClientRect();
  const sx = orbCanvas.width  / rect.width;
  const sy = orbCanvas.height / rect.height;
  return { x: (e.clientX - rect.left) * sx, y: (e.clientY - rect.top) * sy };
}

function pickTarget(p) {
  const g = orbitalGeometry(orbCanvas, state);
  const dm = Math.hypot(p.x - g.mX, p.y - g.mY);
  const dObs = Math.hypot(p.x - g.oX, p.y - g.oY);
  const moonHit = dm <= g.moonR + HIT_SLACK_PX;
  const obsHit  = dObs <= OBS_HIT_PX;
  // If both regions overlap (small canvas), prefer whichever is closer in
  // proportion to its hit radius.
  if (moonHit && obsHit) {
    return (dm / (g.moonR + HIT_SLACK_PX)) < (dObs / OBS_HIT_PX) ? 'moon' : 'observer';
  }
  if (moonHit) return 'moon';
  if (obsHit)  return 'observer';
  return null;
}

function applyDrag(target, p) {
  const g = orbitalGeometry(orbCanvas, state);
  const angle = Math.atan2(g.cy - p.y, p.x - g.cx); // CCW from +x, [-π, π]
  const turns = ((angle / (Math.PI * 2)) % 1 + 1) % 1;
  if (target === 'moon') {
    setLunarDay(turns * LUNAR_CYCLE_DAYS);
  } else {
    setTimeOfDay(12 + turns * 24);
  }
}

orbCanvas.addEventListener('pointerdown', (e) => {
  const p = canvasPoint(e);
  const target = pickTarget(p);
  if (!target) return;
  if (playing) setPlaying(false);
  drag = target;
  orbCanvas.setPointerCapture(e.pointerId);
  orbCanvas.style.cursor = 'grabbing';
  applyDrag(drag, p);
  e.preventDefault();
});

orbCanvas.addEventListener('pointermove', (e) => {
  if (drag) {
    applyDrag(drag, canvasPoint(e));
    return;
  }
  orbCanvas.style.cursor = pickTarget(canvasPoint(e)) ? 'grab' : 'default';
});

function endDrag(e) {
  if (drag == null) return;
  drag = null;
  if (orbCanvas.hasPointerCapture(e.pointerId)) orbCanvas.releasePointerCapture(e.pointerId);
  orbCanvas.style.cursor = pickTarget(canvasPoint(e)) ? 'grab' : 'default';
}
orbCanvas.addEventListener('pointerup', endDrag);
orbCanvas.addEventListener('pointercancel', endDrag);

resizeCanvases();
render();

// Canvas text doesn't redraw when fonts finish loading, so trigger one more
// pass once Google Fonts arrive.
if (document.fonts?.ready) {
  document.fonts.ready.then(render);
}

// Pulse both draggable elements (Moon + observer) to hint they're interactive.
// Loops until the first interaction so a user who's still reading doesn't miss it.
let pulseStart = null;
let pulseActive = true;

function pulseFrame(now) {
  if (!pulseActive) return;
  if (pulseStart == null) pulseStart = now;
  render();
  drawDragHints(orbCtx, state, now - pulseStart);
  requestAnimationFrame(pulseFrame);
}

function cancelPulse() {
  if (!pulseActive) return;
  pulseActive = false;
  render();
}
orbCanvas.addEventListener('pointerdown', cancelPulse, { once: true });

requestAnimationFrame(pulseFrame);

// Play button: animate solar time forward until paused. Lunar day advances
// continuously at the physical rate (1 unit per 24 h of solar time), so the
// Moon drifts smoothly around its orbit as the days cycle.
const PLAY_HOURS_PER_SEC = 12;
let playing = false;
let lastPlayMs = 0;

function playFrame(now) {
  if (!playing) return;
  // Clamp dt so a backgrounded tab doesn't jump the simulation by hours.
  const dt = Math.min((now - lastPlayMs) / 1000, 0.1);
  lastPlayMs = now;
  const dHours = dt * PLAY_HOURS_PER_SEC;
  state.timeOfDay = ((state.timeOfDay + dHours) % 24 + 24) % 24;
  state.lunarDay  = (state.lunarDay + dHours / 24) % LUNAR_CYCLE_DAYS;
  render();
  requestAnimationFrame(playFrame);
}

function setPlaying(next) {
  if (playing === next) return;
  playing = next;
  ui.playButton.classList.toggle('playing', playing);
  ui.playButton.setAttribute('aria-label', playing ? 'Pause' : 'Play');
  if (playing) {
    cancelPulse();
    lastPlayMs = performance.now();
    requestAnimationFrame(playFrame);
  }
}

ui.playButton.addEventListener('click', () => setPlaying(!playing));
