// BioPhi369 v0.7 Creative Engineering Bridge: true Framefield Studio JSON
// conversion + a static-geometry GLB handoff for PixelForge VR Studio.
// The target formats were inspected in the corresponding public repos.
// Modeling is conceptual and source geometry cannot be certified from this.
import { validateAssembly, exportAssembly } from './assemblyData.js';
import { solvePreviewSpeeds } from './digitalTwin.js';

export const BRIDGE_VERSION = 1;
export const FRAMEFIELD_FPS = 24;
export const FRAMEFIELD_DURATION = 240; // 10 seconds, below 600-frame target cap.
export const FRAMEFIELD_URL = 'https://michaelwave369.github.io/FramefieldStudio/';
export const PIXELFORGE_URL = 'https://michaelwave369.github.io/parallax-pixelforge/vr-studio/';
export const BRIDGE_MODES = ['coupled','independent'];
const TAU = Math.PI * 2;
const colors = {gear:'#e6bf81',ring:'#8cb5f0',shaft:'#93dfc7',block:'#b7a9ed',bubble:'#83cadd'};
const clean = n=>Math.round(n * 1e6) / 1e6;

// Framefield editable geometry accepts 3..800 vertices, <=1200 polygon faces,
// at most 16 indices per face, all finite. Custom gear mesh approximates a
// *solid* toothed disk (not BioPhi's holed extrusion). No hole claims are made.
function gearMesh(teeth) {
  const n=teeth*4, vertices=[],faces=[];
  for(let side=0;side<2;side++) {
    const y=side===0?-.1:.1;
    for(let i=0;i<n;i++){
      const angle=i/n*TAU;
      const radius=i%4<2?.51:.62;
      vertices.push([clean(Math.cos(angle)*radius),y,clean(Math.sin(angle)*radius)]);
    }
  }
  const bottom=vertices.length,top=vertices.length+1;
  vertices.push([0,-.1,0],[0,.1,0]);
  for(let i=0;i<n;i++){
    const next=(i+1)%n;
    faces.push([bottom,next,i]);
    faces.push([top,n+i,n+next]);
    faces.push([i,next,n+next,n+i]);
  }
  return {vertices,faces};
}
// Ring uses independent 3D torus geometry so the approximate internal opening
// survives Framefield's JSON import as an editable mesh, not a solid sphere.
function ringMesh() {
  const slices=36,tubes=10,vertices=[],faces=[];
  for(let i=0;i<slices;i++){
    const u=i/slices*TAU;
    for(let j=0;j<tubes;j++){
      const v=j/tubes*TAU;
      const rad=.52+.105*Math.cos(v);
      vertices.push([clean(rad*Math.cos(u)),clean(.105*Math.sin(v)),clean(rad*Math.sin(u))]);
    }
  }
  for(let i=0;i<slices;i++)for(let j=0;j<tubes;j++){
    const a=i*tubes+j,b=((i+1)%slices)*tubes+j;
    const c=((i+1)%slices)*tubes+((j+1)%tubes),d=i*tubes+((j+1)%tubes);
    faces.push([a,b,c,d]);
  }
  return {vertices,faces};
}

// Framefield regenerates object ids on import; tagged names survive its
// validated Open JSON → Save JSON workflow as long as the user keeps the prefix.
export function makeTaggedFramefieldName(part) {
  const label='[BP369:'+part.id+']';
  return label+' '+String(part.name||part.id).slice(0,65-label.length-1);
}
export function framefieldPart(part,speed) {
  const kind={gear:'cylinder',ring:'torus',shaft:'cylinder',block:'box',bubble:'sphere'}[part.type];
  const custom = part.type==='gear'?gearMesh(part.teeth):part.type==='ring'?ringMesh():null;
  // Framefield primitive defaults: box half extents .6, cylinder r=.6/y=.7,
  // sphere r=.7. Other shapes use custom mesh, so scale is uniform.
  const scale = part.type==='shaft'
    ? [.25*part.size,part.size,.25*part.size]
    : part.type==='block'
      ? [(.8/1.2)*part.size,(.55/1.2)*part.size,(.65/1.2)*part.size]
      : part.type==='bubble'
        ? [(.58/.7)*part.size,(.58/.7)*part.size,(.58/.7)*part.size]
        : [part.size,part.size,part.size];
  const position=[part.position.x,part.position.y,part.position.z];
  const keyframes = [];
  const count = Math.abs(speed)<1e-9?0:FRAMEFIELD_DURATION;
  for(let frame=0;frame<=count;frame++){
    const t=frame/FRAMEFIELD_FPS;
    const rotation=[part.rotation.x,clean(part.rotation.y+speed*6*t),part.rotation.z];
    keyframes.push({frame,position:[...position],rotation,scale:[...scale]});
  }
  return {id:part.id,type:kind,name:makeTaggedFramefieldName(part),color:colors[part.type],
    visible:true, ...(custom?{geometry:custom}:{}),keyframes};
}

export function makeFramefieldProject(input, {mode='coupled',driverId=null}={}) {
  const doc=validateAssembly(input);
  if(!BRIDGE_MODES.includes(mode))throw Error('Unsupported bridge motion mode.');
  const solved=solvePreviewSpeeds(doc,{mode,driverId});
  const objects=doc.parts.map(part=>framefieldPart(part,solved.speeds[part.id]||0));
  // Matches src/scene.js validateProject in Framefield Studio as of v1.0 candidate.
  // Framefield regenerates object ids at import; names and poses remain.
  return {version:1,name:'BioPhi369 Creative Engineering Bridge',
    fps:FRAMEFIELD_FPS,duration:FRAMEFIELD_DURATION,objects};
}

export function createMotionHandoff(input,{mode='coupled',driverId=null}={}) {
  const doc=validateAssembly(input);
  const solved=solvePreviewSpeeds(doc,{mode,driverId});
  return {
    format:'BioPhi369-Motion-Handoff',version:1,
    provenance:'SIMULATED',verification:'UNVERIFIED',
    motionMode:solved.mode,driverId:solved.driverId,
    durationSeconds:30,framefieldExcerptSeconds:FRAMEFIELD_DURATION/FRAMEFIELD_FPS,
    speedsRPM:solved.speeds,
    eligibleLinks:solved.constraints,
    rejectedLinks:solved.rejected,contradictoryCycles:solved.contradictions,
    sourceDocumentFormat:'BioPhi369-Assembly',
    note:'Motion is a deterministic visual preview. No contact, torque, collision-free motion or physical validity confirmed.'
  };
}

export function handoffInstructions() {
  return [
    'BioPhi369 v0.7 - CREATIVE ENGINEERING BRIDGE',
    '',
    'The original editable BioPhi project is in biophi.assembly.json.',
    'This pack contains two separate target handoffs, NOT automatic cross-site access.',
    '',
    'FRAMEFIELD STUDIO (animated conceptual approximation):',
    '1. Open '+FRAMEFIELD_URL,
    '2. Choose Open JSON and select framefield.scene.json from this ZIP.',
    '3. A 10-second, 24-FPS keyframed scene appears. Use Framefield tools to edit',
    '   shapes, keyframes and render an animation.',
    '4. Gears are approximate solid toothed disks (no through-hole). Ring mesh is',
    '   an approximate torus. Gear coupling represents idealized RPM, not contact.',
    '',
    'PIXELFORGE VR STUDIO (static geometry only):',
    '1. Open '+PIXELFORGE_URL,
    '2. In VR Studio choose a local asset ID permitted by its current controls',
    '   and use Import local GLB geometry with pixelforge.model.glb.',
    '3. The GLB is a rest-pose mesh. No animation, timing, joints or simulation',
    '   is embedded. PixelForge can reject unsupported geometry or materials.',
    '4. Keep the original GLB for future exact-file rebind; local import is not',
    '   automatic publication or license clearance.',
    '',
    'The motion-handoff.json provides independent settings and rejected links.',
    'manifest.json lists byte counts and SHA-256 integrity hashes, NOT source rights.',
    'All files were generated locally. No transfer to third-party services occurred.',
    '',
    'SAFETY: All dimensions are arbitrary scene units. Engineering, material,',
    'collision, load and manufacturing safety are unverified.',
    ''
  ].join('\n');
}
export function sourceAssemblyJSON(input) {
  return exportAssembly(validateAssembly(input));
}
