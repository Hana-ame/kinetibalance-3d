import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MultiSegmentPendulumEngine,
  buildDefaultSegments,
  computeLQRGains,
  DEFAULT_SYSTEM_CONFIG,
} from './pendulumEngine';

test('LQR gain solver computes finite optimal gains for 2, 3, and 4 segments', () => {
  for (const count of [2, 3, 4] as const) {
    const segments = buildDefaultSegments(count);
    const gains = computeLQRGains(segments, {
      ...DEFAULT_SYSTEM_CONFIG,
      segmentCount: count,
    });

    assert.equal(gains.kTheta.length, count);
    assert.equal(gains.kOmega.length, count);
    assert.ok(Number.isFinite(gains.kPos));
    assert.ok(Number.isFinite(gains.kVel));
  }
});

test('Control vector components sum strictly to the combined resultant vector', () => {
  const engine = new MultiSegmentPendulumEngine({ segmentCount: 3 }, false);
  const snap = engine.getTelemetrySnapshot();

  assert.equal(snap.components.length, 5);
  const sumX = snap.components.reduce((acc, c) => acc + c.vec.x, 0);
  const sumZ = snap.components.reduce((acc, c) => acc + c.vec.z, 0);

  assert.ok(Math.abs(sumX - snap.rawResultant.vec.x) < 1e-9);
  assert.ok(Math.abs(sumZ - snap.rawResultant.vec.z) < 1e-9);
});

test('Without base motion (controller disabled), fallen joints NEVER stand up by themselves', () => {
  const engine = new MultiSegmentPendulumEngine({ segmentCount: 3 }, false);
  engine.controllerEnabled = false;

  // Simulate 6 seconds of unforced gravity fall
  for (let i = 0; i < 360; i++) {
    engine.step(1 / 60);
  }

  const snap = engine.getTelemetrySnapshot();
  assert.equal(snap.isBalanced, false);
  assert.ok(
    snap.maxTiltDeg > 130,
    `Expected unforced pendulum to hang downward (>130 deg), got ${snap.maxTiltDeg}`
  );
  assert.ok(
    snap.joints[2].tipPos.y < -0.5,
    `Expected top tip to hang below y=0, got y=${snap.joints[2].tipPos.y}`
  );
});

test('Algorithm 1 (energy_lqr) swings up 3-segment pendulum from vertically downward (180 deg) to upright (0 deg) purely via RK4 ODE', () => {
  const engine = new MultiSegmentPendulumEngine(
    { segmentCount: 3, algorithm: 'energy_lqr' },
    true
  );

  const initSnap = engine.getTelemetrySnapshot();
  assert.ok(initSnap.maxTiltDeg > 175, `Starts downward near 180 deg, got ${initSnap.maxTiltDeg}`);
  assert.ok(initSnap.joints[2].tipPos.y < -1.0, 'Tip starts hanging straight down below y = -1m');

  for (let i = 0; i < 720; i++) {
    engine.step(1 / 60);
  }

  const finalSnap = engine.getTelemetrySnapshot();
  assert.equal(finalSnap.isBalanced, true);
  assert.ok(finalSnap.maxTiltDeg < 1.5, `Expected upright < 1.5 deg, got ${finalSnap.maxTiltDeg}`);
});

test('Algorithm 2 (homoclinic_smc) swings up 3-segment pendulum from vertically downward (180 deg) to upright (0 deg) purely via RK4 ODE', () => {
  const engine = new MultiSegmentPendulumEngine(
    { segmentCount: 3, algorithm: 'homoclinic_smc' },
    true
  );

  for (let i = 0; i < 720; i++) {
    engine.step(1 / 60);
  }

  const finalSnap = engine.getTelemetrySnapshot();
  assert.equal(finalSnap.isBalanced, true);
  assert.ok(finalSnap.maxTiltDeg < 1.5, `Expected upright < 1.5 deg, got ${finalSnap.maxTiltDeg}`);
});

test('Blind Support-Only Observer + Sensor Measurement Noise swings up and stabilizes without direct attitude sensors', () => {
  const engine = new MultiSegmentPendulumEngine(
    {
      segmentCount: 3,
      algorithm: 'blind_observer_lqg',
      sensorMode: 'blind_with_noise',
      sensorNoiseSigma: 0.35,
    },
    true
  );

  for (let i = 0; i < 720; i++) {
    engine.step(1 / 60);
  }

  const snap = engine.getTelemetrySnapshot();
  assert.equal(snap.isBalanced, true);
  assert.ok(
    snap.maxTiltDeg < 5.0,
    `Expected blind noisy observer to stabilize < 5 deg, got ${snap.maxTiltDeg}`
  );

  // Apply disturbance specifically at Joint Connection J_2 (index 1) and verify blind recovery
  engine.applyImpulseDisturbance(0.9, -0.4, 1, 1.0);
  assert.equal(engine.getTelemetrySnapshot().activeMouseDisturbance.jointIndex, 1);

  for (let i = 0; i < 240; i++) {
    engine.step(1 / 60);
  }
  assert.equal(engine.getTelemetrySnapshot().isBalanced, true);
});

test('No-Algorithm manual mode allows dragging the support point directly and excites real passive pendulum motion', () => {
  const engine = new MultiSegmentPendulumEngine({ segmentCount: 3 }, true);
  engine.controllerEnabled = false;

  // Drag support point to (+0.85m, -0.45m) manually with mouse
  engine.setManualSupportDrag(true, 0.85, -0.45);
  for (let i = 0; i < 45; i++) {
    engine.step(1 / 60);
  }

  const snap = engine.getTelemetrySnapshot();
  assert.equal(snap.phase, 'manual_free');
  assert.ok(Math.abs(snap.supportPos.x - 0.85) < 0.15, 'Support point tracked manual mouse drag X');
  assert.ok(Math.abs(snap.supportPos.z - -0.45) < 0.15, 'Support point tracked manual mouse drag Z');
});
