import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CFD_DEFAULTS, CFD_PRESETS, MAX_FRAMES, normalizeCFDSettings,
  makeFrame, parseCFDRecording, encodeCFDRecording, generateCFDPositions
} from '../src/cfdState.js';

test('CFD presets and controls remain typed, finite and bounded', () => {
  for (const config of Object.values(CFD_PRESETS)) {
    assert.deepEqual(normalizeCFDSettings(config, { strict: true }), config);
  }
  assert.deepEqual(normalizeCFDSettings({ ...CFD_DEFAULTS, density: -Infinity }), { ...CFD_DEFAULTS });
  assert.equal(normalizeCFDSettings({ ...CFD_DEFAULTS, density: 9e6 }).density, 2400);
  assert.equal(normalizeCFDSettings({ ...CFD_DEFAULTS, twist: -100 }).twist, 0);
  assert.equal(normalizeCFDSettings({ pattern: 'unknown', view: 'INVALID' }).pattern, 'spiral');
  assert.throws(() => normalizeCFDSettings({ ...CFD_DEFAULTS, density: -1 }, { strict: true }), /Out-of-range density/);
  assert.throws(() => normalizeCFDSettings({ ...CFD_DEFAULTS, hemisphere: 'cpu-gpu' }, { strict: true }), /Invalid hemisphere/);
  assert.throws(() => normalizeCFDSettings({ ...CFD_DEFAULTS, spin: '99' }, { strict: true }), /Invalid spin/);
});

test('All particle-field geometries are finite, bounded and deterministic', () => {
  for (const pattern of ['spiral', 'grid', 'bubble']) {
    for (const density of [200, 1400, 2400]) {
      const settings = { ...CFD_DEFAULTS, pattern, density, twist: 77, depth: 0 };
      const first = generateCFDPositions(settings);
      const second = generateCFDPositions(settings);
      assert.ok(first instanceof Float32Array);
      assert.equal(first.length, density * 3);
      assert.deepEqual(first, second);
      for (const coordinate of first) {
        assert.ok(Number.isFinite(coordinate), 'Every point must be finite.');
        assert.ok(Math.abs(coordinate) <= 3, 'Coordinates must stay bounded in the scene.');
      }
    }
  }
});

test('Versioned recordings round-trip with text labels and no executable interpretation', () => {
  const frame = makeFrame({ ...CFD_DEFAULTS, view: 'software', pattern: 'bubble' }, '<script>alert(1)</script>');
  const input = encodeCFDRecording([frame]);
  const parsed = parseCFDRecording(JSON.parse(input));
  assert.equal(parsed.version, 2);
  assert.equal(parsed.frames[0].label, '<script>alert(1)</script>');
  assert.deepEqual(parsed.frames[0].settings, frame.settings);
  assert.equal(parsed.frames[0].settings.view, 'software');
});

test('Import rejects oversized recordings, malformed formats and bad controls', () => {
  const frame = makeFrame(CFD_DEFAULTS, 'test');
  assert.throws(() => parseCFDRecording({ version: 1, frames: [frame] }), /Expected/);
  assert.throws(() => parseCFDRecording({ version: 2, frames: Array(MAX_FRAMES + 1).fill(frame) }), /24-frame/);
  assert.throws(() => parseCFDRecording({ version: 2, frames: [{ ...frame, at: 'garbage' }] }), /Invalid frame/);
  assert.throws(() => parseCFDRecording({ version: 2, frames: [{ ...frame, settings: { ...CFD_DEFAULTS, view: 'literal thoughts' } }] }), /Invalid view/);
  assert.throws(() => parseCFDRecording({ version: 2, frames: [{ ...frame, settings: { ...CFD_DEFAULTS, depth: 1e50 } }] }), /Out-of-range depth/);
});
