// Pure functions of state = { lunarDay, timeOfDay }.
// No DOM, no canvas, no globals — easy to unit-test or swap in a different UI.

export const LUNAR_CYCLE_DAYS = 29.5;

// Phase angle of the Moon around Earth, measured CCW from the Sun direction.
// 0 = New Moon (Moon in Sun's direction), π = Full Moon (Moon opposite Sun).
export function moonPhaseAngle({ lunarDay }) {
  return (lunarDay / LUNAR_CYCLE_DAYS) * 2 * Math.PI;
}

// Fraction of the visible disc that is illuminated (0 = new, 1 = full).
export function illuminationFraction(state) {
  return (1 - Math.cos(moonPhaseAngle(state))) / 2;
}

// Cardinal phases (New, First Quarter, Full, Last Quarter) sit at multiples
// of cycle/4. Each cardinal owns a band of width W = cycle/16 starting at
// its centre (New is split across both ends). The remaining gaps belong to
// the in-between phases.
const Q = LUNAR_CYCLE_DAYS / 4;
const W = LUNAR_CYCLE_DAYS / 16;

export function phaseName({ lunarDay: d }) {
  if (d < W || d >= LUNAR_CYCLE_DAYS - W) return 'New Moon';
  if (d < Q)         return 'Waxing Crescent';
  if (d < Q + W)     return 'First Quarter';
  if (d < 2 * Q)     return 'Waxing Gibbous';
  if (d < 2 * Q + W) return 'Full Moon';
  if (d < 3 * Q)     return 'Waning Gibbous';
  if (d < 3 * Q + W) return 'Last Quarter';
  return 'Waning Crescent';
}

// Sun altitude as a sine wave: +1 noon, 0 at sunrise/sunset, −1 midnight.
export function sunAltitude({ timeOfDay }) {
  return Math.sin((timeOfDay - 6) / 24 * Math.PI * 2);
}

// Moon altitude: same sine as the Sun, time-shifted by the Moon's rise drift
// (~24/29.5 ≈ 0.81 h later each lunar day). At New Moon shift = 0 and the
// Moon tracks the Sun; at Full Moon shift = 12 h and they're opposite.
export function moonAltitude({ lunarDay, timeOfDay }) {
  const riseShift = (lunarDay / LUNAR_CYCLE_DAYS) * 24;
  return sunAltitude({ timeOfDay: timeOfDay - riseShift });
}
