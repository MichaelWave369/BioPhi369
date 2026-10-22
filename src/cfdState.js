// CFD v0.2 state contract. All geometry is conceptual, not neural measurement.
export const CFD_STORAGE_KEY = 'biophi369.cfd.v2';
export const MAX_FRAMES = 24;
export const MAX_IMPORT_BYTES = 100_000;
export const CFD_DEFAULTS = Object.freeze({
  view: 'hardware',
  pattern: 'spiral',
  hemisphere: 'both',
  density: 1400,
  twist: 38,
  depth: 55,
  spin: 35,
  explode: 34
});
export const CFD_PATTERNS = ['spiral', 'grid', 'bubble'];
export const CFD_VIEWS = ['hardware', 'software'];
export const HEMISPHERES = ['both', 'left', 'right'];
export const CFD_PRESETS = Object.freeze({
  'CFD spiral': { ...CFD_DEFAULTS },
  'Nested lattice': { ...CFD_DEFAULTS, pattern: 'grid', view: 'software', density: 1900, twist: 25, depth: 40, explode: 65 },
  'Bubble orbit': { ...CFD_DEFAULTS, pattern: 'bubble', view: 'hardware', density: 2200, twist: 80, depth: 80, explode: 82 }
});

const ranges = { density: [200, 2400], twist: [0, 100], depth: [0, 100], spin: [0, 100], explode: [0, 100] };
function bounded(name, value, strict) {
  if (strict && (typeof value !== 'number' || !Number.isFinite(value))) throw new Error('Invalid ' + name);
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return CFD_DEFAULTS[name];
  const [low, high] = ranges[name];
  if (strict && (numeric < low || numeric > high || !Number.isInteger(numeric))) throw new Error('Out-of-range ' + name);
  return Math.round(Math.max(low, Math.min(high, numeric)));
}

export function normalizeCFDSettings(input = {}, { strict = false } = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Settings must be an object.');
  const result = {};
  for (const [key, allowed] of [['view', CFD_VIEWS], ['pattern', CFD_PATTERNS], ['hemisphere', HEMISPHERES]]) {
    const value = input[key];
    if (strict && !allowed.includes(value)) throw new Error('Invalid ' + key);
    result[key] = allowed.includes(value) ? value : CFD_DEFAULTS[key];
  }
  for (const key of Object.keys(ranges)) result[key] = bounded(key, input[key], strict);
  return result;
}

export function makeFrame(settings, label = '', at = new Date().toISOString()) {
  const clean = normalizeCFDSettings(settings);
  return { label: String(label).trim().slice(0, 60) || 'Untitled frame', at, settings: clean };
}

export function parseCFDRecording(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || input.version !== 2 || !Array.isArray(input.frames)) {
    throw new Error('Expected a BioPhi369 CFD v2 recording.');
  }
  if (input.frames.length > MAX_FRAMES) throw new Error('Recording exceeds the 24-frame limit.');
  const frames = input.frames.map((frame, index) => {
    if (!frame || typeof frame !== 'object' || Array.isArray(frame) ||
        typeof frame.label !== 'string' || frame.label.length > 60 ||
        typeof frame.at !== 'string' || frame.at.length > 40 ||
        !Number.isFinite(Date.parse(frame.at))) throw new Error('Invalid frame ' + (index + 1));
    return { label: frame.label.trim() || 'Untitled frame', at: frame.at,
      settings: normalizeCFDSettings(frame.settings, { strict: true }) };
  });
  return { format: 'BioPhi369-CFD', version: 2, frames };
}

export function encodeCFDRecording(frames) {
  return JSON.stringify(parseCFDRecording({ version: 2, frames }), null, 2);
}

// Deterministic and bounded positions for an illustrative CFD point field.
// This is *not* a simulation of brain firing, pixels in consciousness, or measured physics.
export function generateCFDPositions(input) {
  const s = normalizeCFDSettings(input);
  const positions = new Float32Array(s.density * 3);
  const total = s.density;
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < total; i++) {
    const t = (i + .5) / total;
    const phi = golden * i + (s.twist / 100) * Math.PI * 6 * t;
    const z = (t * 2 - 1) * (.28 + s.depth / 85);
    let x, y, zz;
    if (s.pattern === 'grid') {
      const n = Math.ceil(Math.cbrt(total));
      const ix = i % n;
      const iy = Math.floor(i / n) % n;
      const iz = Math.floor(i / (n * n));
      const angle = (s.twist / 100) * Math.PI * (iz / Math.max(1, n - 1));
      const xx = (ix - (n - 1) / 2) * 2.9 / n;
      const yy = (iy - (n - 1) / 2) * 2.9 / n;
      x = xx * Math.cos(angle) - yy * Math.sin(angle);
      y = xx * Math.sin(angle) + yy * Math.cos(angle);
      zz = (iz - (n - 1) / 2) * (0.9 + s.depth / 40) / n;
    } else if (s.pattern === 'bubble') {
      const theta = Math.acos(1 - 2 * t);
      const radius = 0.65 + 0.75 * ((i * 13 % 19) / 19);
      x = Math.cos(phi) * Math.sin(theta) * radius;
      y = Math.sin(phi) * Math.sin(theta) * radius;
      zz = Math.cos(theta) * radius * (0.35 + s.depth / 80);
    } else {
      const radial = .17 + 1.4 * Math.sqrt(t);
      x = Math.cos(phi) * radial;
      y = Math.sin(phi) * radial;
      zz = z;
    }
    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = zz;
  }
  return positions;
}
