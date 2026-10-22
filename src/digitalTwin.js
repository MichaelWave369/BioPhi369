// BioPhi369 v0.5: kinematic visual preview, not a physical drivetrain solver.
// A link only becomes a preview coupling when the assembly satisfies simple
// rest-pose assumptions. This never asserts proper teeth contact or torque.
import { validateAssembly } from './assemblyData.js';
import { nominalGearPitchDistance } from './realityCheck.js';

export const MOTION_MAX_SECONDS = 30;
export const MOTION_MODES = ['independent', 'coupled'];
const EPS = 1e-7;
const clamp=(value,lo,hi)=>Math.min(hi,Math.max(lo,value));
const pairKey=(a,b)=>[a,b].sort().join('|');
const delta=(a,b)=>Math.hypot(a.position.x-b.position.x,a.position.z-b.position.z);
const tipped=(part)=>Math.abs(part.rotation.x)>2||Math.abs(part.rotation.z)>2;

export function inspectCoupling(input, link) {
  const doc=validateAssembly(input);
  const a=doc.parts.find(p=>p.id===link.from);
  const b=doc.parts.find(p=>p.id===link.to);
  if(!a||!b)throw Error('Missing coupling endpoint');
  const messages=[];
  if(a.type!=='gear'||b.type!=='gear')messages.push('Only two gears can be preview-coupled.');
  if(a.type==='gear'&&b.type==='gear'){
    if(tipped(a)||tipped(b))messages.push('Gear axes must be roughly parallel to world Y.');
    if(Math.abs(a.position.y-b.position.y)>.11)messages.push('Gear Y planes are too far apart for this preview.');
    const pitch=nominalGearPitchDistance(a,b);
    if(Math.abs(delta(a,b)-pitch)>Math.max(.11,pitch*.14))messages.push('Gear centers differ from nominal visual pitch spacing.');
    const densityA=a.teeth/a.size,densityB=b.teeth/b.size;
    if(Math.abs(densityA-densityB)/Math.max(densityA,densityB)>.16)messages.push('Relative tooth count and primitive size are inconsistent.');
  }
  return {from:a.id,to:b.id,eligible:messages.length===0,messages};
}

// BFS establishes rotational speed for parts reachable from the driver.
// The first cycle path cannot silently override a contradictory ratio.
export function solvePreviewSpeeds(input,{mode='coupled',driverId=null}={}) {
  const doc=validateAssembly(input);
  if(!MOTION_MODES.includes(mode))throw Error('Unknown motion mode');
  const speeds=Object.fromEntries(doc.parts.map(p=>[p.id,mode==='independent'?p.rpm:0]));
  const rejected=[];
  const contradictions=[];
  const constraints=[];
  if(mode==='independent')return {speeds,rejected,constraints,contradictions,driverId:null,mode};

  for(const link of doc.links){
    const inspection=inspectCoupling(doc,link);
    if(inspection.eligible)constraints.push({from:link.from,to:link.to});
    else rejected.push(inspection);
  }
  const byId=new Map(doc.parts.map(p=>[p.id,p]));
  const preferred=byId.get(driverId);
  const chosen=preferred?.type==='gear'?preferred:
    doc.parts.find(p=>p.type==='gear'&&Math.abs(p.rpm)>EPS)||
    doc.parts.find(p=>p.type==='gear');
  if(!chosen)return {speeds,rejected,constraints,contradictions,driverId:null,mode};

  const neighbors=new Map(doc.parts.map(p=>[p.id,[]]));
  for(const edge of constraints){
    neighbors.get(edge.from).push(edge.to);
    neighbors.get(edge.to).push(edge.from);
  }
  const assigned=new Set([chosen.id]);
  speeds[chosen.id]=chosen.rpm;
  const queue=[chosen.id];
  for(let k=0;k<queue.length;k++){
    const current=queue[k];
    const gear=byId.get(current);
    for(const next of neighbors.get(current)){
      const follower=byId.get(next);
      const proposed=-speeds[current]*gear.teeth/follower.teeth;
      if(!assigned.has(next)){
        speeds[next]=proposed;
        assigned.add(next);
        queue.push(next);
      } else if(Math.abs(speeds[next]-proposed)>Math.max(EPS,Math.abs(proposed)*.001)){
        const key=pairKey(current,next);
        if(!contradictions.some(x=>x.key===key)){
          contradictions.push({key,from:current,to:next,
            message:'Connected gear cycle requests contradictory directions or ratios. Physical coupling cannot be inferred.'});
        }
      }
    }
  }
  if(contradictions.length){
    // Fail closed for inconsistent loop; return independent RPMs rather than
    // pretending the coupled graph is mechanically valid.
    for(const part of doc.parts)speeds[part.id]=part.rpm;
  }
  return {speeds,rejected,constraints,contradictions,driverId:chosen.id,mode};
}

export function sampleMotion(input,options={}) {
  const doc=validateAssembly(input);
  const time=Number(options.time);
  if(!Number.isFinite(time)||time<0||time>MOTION_MAX_SECONDS)throw Error('Timeline time must be between 0 and 30 seconds');
  const solved=solvePreviewSpeeds(doc,options);
  const angles={};
  for(const part of doc.parts){
    // THREE scene adds these rotations to rest pose, expressed in radians.
    angles[part.id]=time*(solved.speeds[part.id]||0)*Math.PI/30;
  }
  return {...solved,time,angles};
}

export function makeRealityReceipt(input,options={},inspection={}) {
  const doc=validateAssembly(input);
  const solved=sampleMotion(doc,{...options,time:0});
  const cautions=Number.isInteger(inspection.cautionCount)?inspection.cautionCount:null;
  return {
    source:'BioPhi369 Reality Check Lab',
    provenance:'SIMULATED',
    status:'UNVERIFIED',
    model:'kinematic-preview-v1',
    recordedAt:new Date().toISOString(),
    components:doc.parts.length,
    links:doc.links.length,
    cautionCount:cautions,
    driverId:solved.driverId,
    mode:solved.mode,
    eligibleGearLinks:solved.constraints.length,
    rejectedLinks:solved.rejected.length,
    contradictoryCycles:solved.contradictions.length,
    notes:'All readings are model-derived. No collision-free motion, tooth contact, force, torque, tolerances or manufacturability certified.'
  };
}
