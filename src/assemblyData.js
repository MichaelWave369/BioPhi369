// BioPhi369 v0.3 design-document schema. Nothing here measures neural activity
// or provides certified mechanical/structural or collision simulation.
export const ASSEMBLY_KEY = 'biophi369.assembly.v1';
export const ASSEMBLY_VERSION = 1;
export const MAX_PARTS = 24;
export const MAX_FRAMES = 12;
export const MAX_FILE_BYTES = 250000;
export const PART_TYPES = ['gear', 'ring', 'shaft', 'block', 'bubble'];
const AXES = ['x', 'y', 'z'];

const copy = (value) => JSON.parse(JSON.stringify(value));
const finite = (value, min, max, integer = false) => typeof value === 'number' &&
  Number.isFinite(value) && value >= min && value <= max && (!integer || Number.isInteger(value));

function xyz(value, limits, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('Invalid ' + label);
  const output = {};
  for (const axis of AXES) {
    if (!finite(value[axis], limits[0], limits[1])) throw Error('Invalid ' + label + '.' + axis);
    output[axis] = value[axis];
  }
  return output;
}
function safeText(value, label, max = 60) {
  if (typeof value !== 'string' || value.length > max) throw Error('Invalid ' + label);
  return value.trim().slice(0,max);
}

export function initialAssembly() {
  return {
    version: ASSEMBLY_VERSION,
    serial: 3,
    selected: 'part-1',
    explode: 0,
    parts: [
      { id: 'part-1', name: 'Drive gear', type: 'gear', position: { x: -0.66, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, size: 0.8, rpm: 18, teeth: 16 },
      { id: 'part-2', name: 'Follower gear', type: 'gear', position: { x: 0.65, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, size: 0.72, rpm: -20, teeth: 16 }
    ],
    links: [{ from: 'part-1', to: 'part-2' }],
    frames: []
  };
}

export function validateAssembly(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || input.version !== ASSEMBLY_VERSION ||
      !Array.isArray(input.parts) || !Array.isArray(input.links) || !Array.isArray(input.frames)) throw Error('Not a BioPhi369 assembly v1 file.');
  if (input.parts.length > MAX_PARTS || input.links.length > MAX_PARTS*2 || input.frames.length > MAX_FRAMES)
    throw Error('Assembly exceeds part/link/frame limits.');
  if (!finite(input.serial, 0, 1000000, true) || !finite(input.explode, 0, 100, true)) throw Error('Invalid assembly controls');
  const seen = new Set();
  const parts = input.parts.map((part) => {
    if (!part || typeof part !== 'object' || Array.isArray(part) ||
        typeof part.id !== 'string' || !/^part-[1-9][0-9]{0,6}$/.test(part.id) || seen.has(part.id) ||
        !PART_TYPES.includes(part.type) || !finite(part.size,0.2,3) || !finite(part.rpm,-120,120) ||
        !finite(part.teeth,8,40,true)) throw Error('Invalid component');
    seen.add(part.id);
    return {
      id: part.id, name: safeText(part.name, 'component name'),
      type: part.type, position: xyz(part.position,[-8,8],'position'),
      rotation: xyz(part.rotation,[-360,360],'rotation'),
      size: part.size, rpm: part.rpm, teeth: part.teeth
    };
  });
  const linkSet = new Set();
  const links = input.links.map((link) => {
    if (!link || typeof link !== 'object' || typeof link.from !== 'string' || typeof link.to !== 'string' ||
        !seen.has(link.from) || !seen.has(link.to) || link.from === link.to) throw Error('Invalid connection endpoints');
    const signature = [link.from, link.to].sort().join('|');
    if (linkSet.has(signature)) throw Error('Duplicate connection');
    linkSet.add(signature);
    return { from: link.from, to: link.to };
  });
  if (input.selected !== null && (!seen.has(input.selected) || typeof input.selected !== 'string')) throw Error('Invalid selected component');
  const frames = input.frames.map((frame) => {
    if (!frame || typeof frame !== 'object' || !Array.isArray(frame.parts) ||
        !Array.isArray(frame.links) || !finite(frame.explode,0,100,true) ||
        typeof frame.timestamp !== 'string' || frame.timestamp.length > 40 ||
        !Number.isFinite(Date.parse(frame.timestamp))) throw Error('Invalid keyframe');
    const verified = validateAssembly({
      version: 1, serial: input.serial, selected: null,
      explode: frame.explode, parts: frame.parts, links: frame.links, frames: []
    });
    return { label: safeText(frame.label, 'frame label'), timestamp: frame.timestamp,
      parts: verified.parts, links: verified.links, explode: frame.explode };
  });
  return { version: 1, serial: input.serial, selected: input.selected,
    explode: input.explode, parts, links, frames };
}

export function newComponent(assembly, type) {
  if (!PART_TYPES.includes(type)) throw Error('Unknown component type');
  const doc = validateAssembly(assembly);
  if (doc.parts.length >= MAX_PARTS) throw Error('Maximum 24 components.');
  let serial = doc.serial;
  while (doc.parts.some(p=>p.id==='part-'+serial)) serial++;
  const id = 'part-'+serial;
  const size = type === 'shaft' ? 0.75 : type === 'block' ? 0.85 : 1;
  const offset = doc.parts.length * 0.17;
  doc.parts.push({
    id, name: type.charAt(0).toUpperCase()+type.slice(1)+' '+serial,
    type, position: { x: Math.min(3,offset-0.7), y: 0, z: 0 },
    rotation: { x: 0,y:0,z:0 }, size, rpm: 0, teeth: 16
  });
  doc.serial = serial + 1;
  doc.selected = id;
  return doc;
}
export function patchComponent(assembly, id, patch) {
  const doc = validateAssembly(assembly);
  const index = doc.parts.findIndex(x => x.id === id);
  if (index < 0) throw Error('Component no longer exists.');
  const old = doc.parts[index];
  doc.parts[index] = { ...old, ...patch,
    position: { ...old.position, ...(patch.position || {}) },
    rotation: { ...old.rotation, ...(patch.rotation || {}) } };
  return validateAssembly(doc);
}
export function removeComponent(assembly, id) {
  const doc = validateAssembly(assembly);
  doc.parts = doc.parts.filter(p=>p.id!==id);
  doc.links = doc.links.filter(l=>l.from!==id&&l.to!==id);
  doc.selected = doc.parts[0]?.id ?? null;
  return validateAssembly(doc);
}
export function connectComponents(assembly, from, to) {
  const doc = validateAssembly(assembly);
  const signature = [from,to].sort().join('|');
  if (from===to || !doc.parts.some(p=>p.id===from) || !doc.parts.some(p=>p.id===to))
    throw Error('Pick two different existing components.');
  if (doc.links.some(l=>[l.from,l.to].sort().join('|')===signature)) throw Error('These components are already linked.');
  if (doc.links.length >= MAX_PARTS*2) throw Error('Connection limit reached.');
  doc.links.push({ from,to });
  return validateAssembly(doc);
}
export function disconnectComponents(assembly, from, to) {
  const doc = validateAssembly(assembly);
  const signature = [from,to].sort().join('|');
  doc.links = doc.links.filter(l=>[l.from,l.to].sort().join('|')!==signature);
  return doc;
}
export function captureAssembly(assembly, label) {
  const doc = validateAssembly(assembly);
  if (doc.frames.length>=MAX_FRAMES) throw Error('Maximum 12 assembly keyframes.');
  doc.frames.push({
    label: String(label||'').trim().slice(0,60) || 'Assembly '+(doc.frames.length+1),
    timestamp: new Date().toISOString(), parts: copy(doc.parts),
    links: copy(doc.links), explode: doc.explode
  });
  return validateAssembly(doc);
}
export function applyAssemblyFrame(assembly, index) {
  const doc = validateAssembly(assembly);
  const frame = doc.frames[index];
  if (!frame) throw Error('Frame does not exist.');
  doc.parts = copy(frame.parts); doc.links = copy(frame.links); doc.explode = frame.explode;
  doc.selected = doc.parts[0]?.id ?? null;
  // Keep monotonically advancing IDs across rewinds.
  for (const part of doc.parts) doc.serial = Math.max(doc.serial, Number(part.id.slice(5))+1);
  return validateAssembly(doc);
}
export function exportAssembly(assembly) {
  return JSON.stringify({format:'BioPhi369-Assembly',...validateAssembly(assembly)},null,2);
}
export function parseAssembly(text) {
  if (typeof text!=='string' || text.length>MAX_FILE_BYTES) throw Error('Import too large');
  const parsed = JSON.parse(text);
  if (parsed.format !== 'BioPhi369-Assembly') throw Error('Unrecognized file format.');
  return validateAssembly(parsed);
}
