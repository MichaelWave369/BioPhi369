// BioPhi369 v0.8. Native Framefield scene JSON -> reviewed BioPhi v1 transform patches.
// Nothing imports editable mesh topology, mechanical proof, or future keyframes.
import { validateAssembly, patchComponent } from './assemblyData.js';
import { framefieldPart, makeTaggedFramefieldName } from './creativeBridge.js';

export const ROUNDTRIP_MAX_BYTES = 3_000_000;
export const ROUNDTRIP_BACKUP_KEY = 'biophi369.roundtrip.rollback.v1';
export const COMPONENT_TAG = /^\[BP369:(part-[1-9][0-9]{0,6})\](?: (.*))?$/;
const TARGET_TYPES = new Set(['box','sphere','pyramid','cylinder','torus']);
const AXES = ['x','y','z'];
const finite = (n,min,max)=>typeof n==='number'&&Number.isFinite(n)&&n>=min&&n<=max;
const close = (a,b)=>Math.abs(a-b)<0.0003;
const equal = (a,b)=>JSON.stringify(a)===JSON.stringify(b);
const round = n=>Math.round(n*1e6)/1e6;
// UI-only selection and exploded-view position may change during inspection.
// Real assembly/content mutations (including links, frames and motors) invalidate the review.
const structuralSnapshot = doc => JSON.stringify({...doc,selected:null,explode:0});

// Native Framefield ids are deliberately *regenerated on import*, so the
// marker in its editable name field is the only supported mapping authority.
export function parseFramefieldReturn(text) {
  if(typeof text!=='string'||text.length>ROUNDTRIP_MAX_BYTES)throw Error('Framefield return must be JSON under 3 MB.');
  let raw;
  try{raw=JSON.parse(text);}catch{throw Error('Invalid Framefield JSON.');}
  if(!raw||typeof raw!=='object'||Array.isArray(raw)||raw.version!==1||
      !Array.isArray(raw.objects)||raw.objects.length>100)
    throw Error('Expected a Framefield Studio version 1 scene with at most 100 objects.');
  const objects=raw.objects.map((obj,index)=>{
    if(!obj||typeof obj!=='object'||Array.isArray(obj)||!TARGET_TYPES.has(obj.type)||
        typeof obj.name!=='string'||obj.name.length>65||
        !Array.isArray(obj.keyframes)||obj.keyframes.length<1||obj.keyframes.length>600)
      throw Error('Invalid Framefield object '+(index+1)+'.');
    // Only rest keyframe is importable, but every pose must be bounded: reject
    // pathological input before showing a plausible-looking review.
    const keys=obj.keyframes.map(key=>{
      if(!key||!Number.isInteger(key.frame)||key.frame<0||key.frame>600)
        throw Error('Invalid frame index in '+obj.name);
      for(const channel of ['position','rotation','scale']){
        if(!Array.isArray(key[channel])||key[channel].length!==3||
           !key[channel].every(n=>finite(n,-10000,10000)))
          throw Error('Invalid '+channel+' in '+obj.name);
      }
      return key;
    });
    if(obj.geometry!==undefined){
      const g=obj.geometry;
      if(!g||!Array.isArray(g.vertices)||!Array.isArray(g.faces)||
         g.vertices.length<3||g.vertices.length>800||g.faces.length<1||g.faces.length>1200||
         !g.vertices.every(v=>Array.isArray(v)&&v.length===3&&v.every(n=>finite(n,-10000,10000)))||
         !g.faces.every(face=>Array.isArray(face)&&face.length>=3&&face.length<=16&&
           face.every(i=>Number.isInteger(i)&&i>=0&&i<g.vertices.length)&&
           new Set(face).size===face.length))
        throw Error('Invalid mesh in '+obj.name);
    }
    return {...obj,keyframes:keys};
  });
  return {objects};
}
function shapeFor(type) {
  return {gear:'cylinder',ring:'torus',shaft:'cylinder',block:'box',bubble:'sphere'}[type];
}
function nativeScaleFactors(part) {
  const original=framefieldPart({...part,size:1},0);
  return original.keyframes[0].scale;
}
function readPatch(part,obj){
  const problems=[];
  if(obj.type!==shapeFor(part.type)){
    problems.push('Target shape type differs from the exported BioPhi component.');
    return {patch:null,changes:[],problems};
  }
  const rest=obj.keyframes.find(k=>k.frame===0);
  if(!rest){
    problems.push('No keyframe at frame 0. BioPhi will not guess a rest pose.');
    return {patch:null,changes:[],problems};
  }
  const patch={},changes=[];
  const converted={position:{},rotation:{}};
  for(let i=0;i<3;i++){
    const axis=AXES[i];
    const p=rest.position[i],r=rest.rotation[i];
    if(!finite(p,-8,8))problems.push('Position '+axis.toUpperCase()+' exceeds BioPhi ±8.');
    else if(!close(p,part.position[axis])){
      converted.position[axis]=round(p);
      changes.push({field:'position.'+axis,before:part.position[axis],after:round(p)});
    }
    if(!finite(r,-360,360))problems.push('Rotation '+axis.toUpperCase()+' exceeds BioPhi ±360°.');
    else if(!close(r,part.rotation[axis])){
      converted.rotation[axis]=round(r);
      changes.push({field:'rotation.'+axis,before:part.rotation[axis],after:round(r)});
    }
  }
  if(Object.keys(converted.position).length)patch.position=converted.position;
  if(Object.keys(converted.rotation).length)patch.rotation=converted.rotation;
  const factors=nativeScaleFactors(part);
  const ratios=rest.scale.map((n,i)=>n/factors[i]);
  if(ratios.some(n=>!finite(n,.2,3))){
    problems.push('Scale falls outside BioPhi 0.2–3 scene units.');
  } else if(Math.max(...ratios)-Math.min(...ratios)>.002){
    problems.push('Nonuniform scale cannot be represented by BioPhi’s single size value.');
  } else if(!close(ratios[0],part.size)){
    patch.size=round(ratios[0]);
    changes.push({field:'size',before:part.size,after:patch.size});
  }
  const expected=framefieldPart(part,0);
  if(!equal(obj.geometry??null,expected.geometry??null))
    problems.push('Target editable mesh topology differs; BioPhi cannot import custom mesh edits.');
  if(Array.isArray(obj.modifiers)&&obj.modifiers.some(x=>x.enabled))
    problems.push('Enabled Framefield modifiers cannot be transferred into BioPhi.');
  if(obj.keyframes.length>1)
    problems.push('Framefield animation curves/keyframes remain in Framefield, not BioPhi.');
  const match=obj.name.match(COMPONENT_TAG);
  if(match){
    const base=makeTaggedFramefieldName(part).replace(COMPONENT_TAG,(_,id,n)=>n??'');
    const candidate=(match[2]??'').trim();
    if(candidate!==base&&candidate.length<=60){
      patch.name=candidate;
      changes.push({field:'name',before:part.name,after:candidate});
    }
  }
  return {patch,changes,problems};
}

export function inspectRoundTrip(assembly,source) {
  const doc=validateAssembly(assembly);
  const target=typeof source==='string'?parseFramefieldReturn(source):parseFramefieldReturn(JSON.stringify(source));
  const seen=new Set(),problems=[],rows=[];
  const lookup=new Map(doc.parts.map(p=>[p.id,p]));
  for(const obj of target.objects){
    const match=obj.name.match(COMPONENT_TAG);
    if(!match){
      problems.push('Unmapped object: '+obj.name.slice(0,65)+'. Only [BP369:part-N] identity tags can be applied.');
      continue;
    }
    const id=match[1];
    if(seen.has(id)){
      problems.push('Duplicate component identity '+id+'; review cannot be applied.');
      continue;
    }
    seen.add(id);
    const part=lookup.get(id);
    if(!part){
      problems.push('No BioPhi component currently matches '+id+'.');
      continue;
    }
    const delta=readPatch(part,obj);
    const blocking=delta.problems.some(p=>/No keyframe|shape type differs|outside BioPhi|exceeds BioPhi|Nonuniform scale/.test(p));
    rows.push({id,name:part.name,sourceName:obj.name,
      changes:blocking?[]:delta.changes,patch:blocking?null:delta.patch,
      warnings:delta.problems,blocked:blocking});
  }
  for(const part of doc.parts){
    if(!seen.has(part.id))problems.push('BioPhi component '+part.id+' absent from returned scene; deletion will not be applied.');
  }
  return {
    source:'Framefield Studio v1',provenance:'INFERRED',status:'UNVERIFIED',
    sourceSnapshot:structuralSnapshot(doc),
    rows,problems,
    fatal:problems.some(message=>message.startsWith('Duplicate component identity')),
    actionable:rows.filter(r=>!r.blocked&&r.changes.length>0).length,
    note:'Position, rotation, uniform size and tagged names only. Unmapped objects, geometry edits, nonuniform scales and animation are never silently imported.'
  };
}
export function applyReviewedRoundTrip(assembly,review,ids){
  const current=validateAssembly(assembly);
  if(!review||review.fatal||structuralSnapshot(current)!==review.sourceSnapshot)
    throw Error('Assembly changed or review is unsafe. Load and inspect the return again.');
  const chosen=new Set(ids);
  if(!chosen.size)throw Error('Choose at least one reviewed component.');
  const allowed=new Map(review.rows.filter(x=>!x.blocked&&x.changes.length).map(x=>[x.id,x]));
  if(chosen.size!==ids.length||[...chosen].some(id=>!allowed.has(id)))
    throw Error('Selection contains an unreviewed or blocked component.');
  let next=current;
  for(const id of chosen){
    next=patchComponent(next,id,allowed.get(id).patch);
  }
  // Links, stored assembly frames, RPMs, gear teeth and selection survive.
  return validateAssembly(next);
}
