// Entry point. Owns the application state, wires up controls, and drives
// the render pipeline. The two views (orbital, horizon) are pure functions
// of (ctx, state); physics functions are pure functions of state.

import { drawOrbital, orbitalGeometry } from './orbital-view.js';
import { drawHorizon } from './horizon-view.js';
import {
  LUNAR_CYCLE_DAYS,
  illuminationFraction,
  moonPhaseAngle,
  phaseName,
} from './physics.js';

const state = {
  lunarDay:  0,
  timeOfDay: 12,
};

const orbCanvas     = document.getElementById('orbitalCanvas');
const horizonCanvas = document.getElementById('horizonCanvas');
const orbCtx        = orbCanvas.getContext('2d');
const horizonCtx    = horizonCanvas.getContext('2d');

const ui = {
  lunarSlider:    document.getElementById('lunarDay'),
  timeSlider:     document.getElementById('timeOfDay'),
  lunarDayVal:    document.getElementById('lunarDayVal'),
  timeOfDayVal:   document.getElementById('timeOfDayVal'),
  phaseName:      document.getElementById('phaseName'),
  illumination:   document.getElementById('illumination'),
  moonAngle:      document.getElementById('moonAngle'),
};

function syncLunarUI() {
  const text = state.lunarDay.toFixed(1);
  ui.lunarDayVal.textContent = text;
  ui.lunarSlider.setAttribute('aria-valuetext', `${text} days`);
}

function syncTimeUI() {
  const text = formatHHMM(state.timeOfDay);
  ui.timeOfDayVal.textContent = text;
  ui.timeSlider.setAttribute('aria-valuetext', text);
}

// Compensate time-of-day so the Moon stays at the same altitude:
// moonAltitude = sunAltitude(timeOfDay - 24 * lunarDay / 29.5),
// so holding (timeOfDay - 24 * lunarDay / 29.5) constant pins altitude.
function setLunarDay(next) {
  const dt = (next - state.lunarDay) * 24 / LUNAR_CYCLE_DAYS;
  state.lunarDay = next;
  state.timeOfDay = ((state.timeOfDay + dt) % 24 + 24) % 24;
  ui.lunarSlider.value = state.lunarDay;
  ui.timeSlider.value = state.timeOfDay;
  syncLunarUI();
  syncTimeUI();
  render();
}

function setTimeOfDay(next) {
  state.timeOfDay = ((next % 24) + 24) % 24;
  ui.timeSlider.value = state.timeOfDay;
  syncTimeUI();
  render();
}

ui.lunarSlider.addEventListener('input', (e) => setLunarDay(parseFloat(e.target.value)));
ui.timeSlider.addEventListener('input',  (e) => setTimeOfDay(parseFloat(e.target.value)));

function formatHHMM(hours) {
  const h = Math.floor(hours);
  const m = Math.floor((hours - h) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function updateInfo() {
  ui.phaseName.textContent    = phaseName(state);
  ui.illumination.textContent = `${Math.round(illuminationFraction(state) * 100)}%`;
  ui.moonAngle.textContent    = `${Math.round((moonPhaseAngle(state) * 180 / Math.PI) % 360)}°`;
}

function resizeCanvases() {
  const orbW = Math.min(orbCanvas.parentElement.clientWidth - 40, 480);
  orbCanvas.width  = orbW;
  orbCanvas.height = orbW;

  const horizonW = horizonCanvas.parentElement.clientWidth - 40;
  horizonCanvas.width  = horizonW;
  horizonCanvas.height = Math.round(horizonW * 9 / 16);
}

function render() {
  drawOrbital(orbCtx, state);
  drawHorizon(horizonCtx, state);
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

syncLunarUI();
syncTimeUI();
resizeCanvases();
render();

// Canvas text doesn't redraw when fonts finish loading, so trigger one more
// pass once Google Fonts arrive.
if (document.fonts?.ready) {
  document.fonts.ready.then(render);
}
