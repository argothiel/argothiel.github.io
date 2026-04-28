import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  LUNAR_CYCLE_DAYS,
  illuminationFraction,
  moonAltitude,
  moonPhaseAngle,
  phaseName,
  sunAltitude,
} from '../docs/lunar-visualizer/physics.js';

const TWO_PI = 2 * Math.PI;
const close = (a, b, tol = 1e-12) => Math.abs(a - b) <= tol;

test('moonPhaseAngle is 0 at New Moon and 2π after one cycle', () => {
  assert.equal(moonPhaseAngle({ lunarDay: 0 }), 0);
  assert.ok(close(moonPhaseAngle({ lunarDay: LUNAR_CYCLE_DAYS }), TWO_PI));
});

test('moonPhaseAngle is π at Full Moon (half cycle)', () => {
  assert.ok(close(moonPhaseAngle({ lunarDay: LUNAR_CYCLE_DAYS / 2 }), Math.PI));
});

test('illuminationFraction is 0 at New Moon, 1 at Full Moon, 0.5 at quarters', () => {
  assert.ok(close(illuminationFraction({ lunarDay: 0 }), 0));
  assert.ok(close(illuminationFraction({ lunarDay: LUNAR_CYCLE_DAYS }), 0));
  assert.ok(close(illuminationFraction({ lunarDay: LUNAR_CYCLE_DAYS / 2 }), 1));
  assert.ok(close(illuminationFraction({ lunarDay: LUNAR_CYCLE_DAYS / 4 }), 0.5));
  assert.ok(close(illuminationFraction({ lunarDay: 3 * LUNAR_CYCLE_DAYS / 4 }), 0.5));
});

test('phaseName covers all eight phases at their cardinal centres', () => {
  // Phase names are sliding-window labels; check the centre of each window.
  const cases = [
    [0,     'New Moon'],
    [4,     'Waxing Crescent'],
    [7.4,   'First Quarter'],
    [11,    'Waxing Gibbous'],
    [14.75, 'Full Moon'],
    [19,    'Waning Gibbous'],
    [23,    'Last Quarter'],
    [25.5,  'Waning Crescent'],
    [29.0,  'New Moon'],
  ];
  for (const [d, name] of cases) {
    assert.equal(phaseName({ lunarDay: d }), name, `lunarDay=${d}`);
  }
});

test('phaseName boundary conditions are stable', () => {
  // Lower edges are inclusive (the value falls into the next phase only at
  // the boundary). Verify a value just inside each band.
  // W = cycle/16 = 1.84375. The boundary at the right end is cycle − W = 27.65625.
  assert.equal(phaseName({ lunarDay: 1.84  }), 'New Moon');
  assert.equal(phaseName({ lunarDay: 1.85  }), 'Waxing Crescent');
  assert.equal(phaseName({ lunarDay: 27.65 }), 'Waning Crescent');
  assert.equal(phaseName({ lunarDay: 27.66 }), 'New Moon');
});

test('sunAltitude is +1 at noon, −1 at midnight, 0 at sunrise/sunset', () => {
  assert.ok(close(sunAltitude({ timeOfDay: 12 }),  1));
  assert.ok(close(sunAltitude({ timeOfDay: 0  }), -1));
  assert.ok(close(sunAltitude({ timeOfDay: 6  }),  0));
  assert.ok(close(sunAltitude({ timeOfDay: 18 }),  0));
});

test('moonAltitude tracks the Sun at New Moon and is opposite at Full Moon', () => {
  for (const t of [0, 6, 9, 12, 15, 18, 21]) {
    assert.ok(
      close(moonAltitude({ lunarDay: 0, timeOfDay: t }), sunAltitude({ timeOfDay: t })),
      `New Moon: t=${t}`,
    );
  }
  // Full Moon: moon altitude is sun altitude shifted by 12h (i.e., negated).
  for (const t of [0, 3, 6, 9, 12, 15]) {
    assert.ok(
      close(
        moonAltitude({ lunarDay: LUNAR_CYCLE_DAYS / 2, timeOfDay: t }),
        -sunAltitude({ timeOfDay: t }),
      ),
      `Full Moon: t=${t}`,
    );
  }
});
