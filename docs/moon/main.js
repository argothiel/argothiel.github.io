// Entry point. Owns the application state, wires up controls, and drives
// the render pipeline. The two views (orbital, horizon) are pure functions
// of (ctx, state); physics functions are pure functions of state.

import { drawOrbital } from './orbital-view.js';
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

ui.lunarSlider.addEventListener('input', (e) => {
  const next = parseFloat(e.target.value);
  // Compensate time-of-day so the Moon stays at the same altitude:
  // moonAltitude = sunAltitude(timeOfDay - 24 * lunarDay / 29.5),
  // so holding (timeOfDay - 24 * lunarDay / 29.5) constant pins altitude.
  const dt = (next - state.lunarDay) * 24 / LUNAR_CYCLE_DAYS;
  state.lunarDay = next;
  state.timeOfDay = ((state.timeOfDay + dt) % 24 + 24) % 24;
  ui.timeSlider.value = state.timeOfDay;
  syncLunarUI();
  syncTimeUI();
  render();
});

ui.timeSlider.addEventListener('input', (e) => {
  state.timeOfDay = parseFloat(e.target.value);
  syncTimeUI();
  render();
});

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

syncLunarUI();
syncTimeUI();
resizeCanvases();
render();

// Canvas text doesn't redraw when fonts finish loading, so trigger one more
// pass once Google Fonts arrive.
if (document.fonts?.ready) {
  document.fonts.ready.then(render);
}
