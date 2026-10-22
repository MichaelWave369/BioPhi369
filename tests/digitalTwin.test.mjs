import test from 'node:test';
import assert from 'node:assert/strict';
import { initialAssembly,patchComponent,newComponent,connectComponents } from '../src/assemblyData.js';
import {
  MOTION_MAX_SECONDS,inspectCoupling,solvePreviewSpeeds,
  sampleMotion,makeRealityReceipt
} from '../src/digitalTwin.js';
import { snapAssembly } from '../src/realityCheck.js';

function readyGears(){
  let doc=initialAssembly();
  doc=patchComponent(doc,'part-2',{size:.8,rpm:-18});
  doc=snapAssembly(doc,'part-2','part-1','gear-pitch');
  return doc;
}

test('Coupled preview refuses default misaligned gears instead of silently coupling',()=>{
  const doc=initialAssembly();
  const result=solvePreviewSpeeds(doc,{mode:'coupled',driverId:'part-1'});
  assert.equal(result.constraints.length,0);
  assert.ok(result.rejected.length>0);
  assert.equal(result.speeds['part-2'],0);
});

test('Pitch-aligned, matching-size external gears preview signed follower RPM',()=>{
  const doc=readyGears();
  const result=solvePreviewSpeeds(doc,{mode:'coupled',driverId:'part-1'});
  assert.equal(result.constraints.length,1);
  assert.equal(result.rejected.length,0);
  assert.equal(result.speeds['part-1'],18);
  assert.equal(result.speeds['part-2'],-18);
  const t=sampleMotion(doc,{mode:'coupled',driverId:'part-1',time:5});
  assert.ok(Math.abs(t.angles['part-1']-3*Math.PI)<1e-8);
  assert.ok(Math.abs(t.angles['part-2']+3*Math.PI)<1e-8);
});

test('Independent mode retains all individual speeds and rest pose at t=0',()=>{
  const doc=readyGears();
  const result=sampleMotion(doc,{mode:'independent',time:0});
  assert.equal(result.speeds['part-1'],18);
  assert.equal(result.speeds['part-2'],-18);
  assert.equal(result.angles['part-1'],0);
  assert.equal(result.constraints.length,0);
});

test('Graph coupling supports chains with tooth-count ratios',()=>{
  let doc=readyGears();
  doc=newComponent(doc,'gear');
  doc=patchComponent(doc,'part-3',{
    teeth:32,size:1.6,rpm:0,
    position:{x:doc.parts[1].position.x+1.344,y:0,z:0}
  });
  doc=connectComponents(doc,'part-2','part-3');
  const result=solvePreviewSpeeds(doc,{mode:'coupled',driverId:'part-1'});
  assert.equal(result.constraints.length,2);
  assert.equal(result.rejected.length,0);
  assert.equal(result.speeds['part-3'],9);
});

test('Contradictory odd gear cycle returns independent speeds (fail closed)',()=>{
  // Visual gear graph cycles are nonsensical for external gears even when
  // edges individually pass geometric heuristics.
  const doc=readyGears();
  doc.parts[0].position={x:0,y:0,z:0};
  doc.parts[1].position={x:.896,y:0,z:0};
  doc.parts.push({...structuredClone(doc.parts[1]),id:'part-3',name:'third',position:{x:.448,y:0,z:.776}});
  doc.serial=4;doc.links.push({from:'part-1',to:'part-3'},{from:'part-2',to:'part-3'});
  // Pair distances ~0.896, matching nominal 0.896 for equal-size gears.
  const result=solvePreviewSpeeds(doc,{mode:'coupled',driverId:'part-1'});
  assert.equal(result.constraints.length,3);
  assert.ok(result.contradictions.length>0);
  assert.equal(result.speeds['part-2'],doc.parts[1].rpm);
});

test('Refuse invalid motion mode and timeline times',()=>{
  const doc=initialAssembly();
  assert.throws(()=>solvePreviewSpeeds(doc,{mode:'unsafe'}),/Unknown motion mode/);
  for(const t of [-.1,30.001,NaN,Infinity])assert.throws(
    ()=>sampleMotion(doc,{mode:'coupled',time:t}),/between 0 and 30/);
  assert.equal(MOTION_MAX_SECONDS,30);
});

test('Ineligible geometry and nongear constraints stay blocked',()=>{
  let doc=readyGears();
  doc=patchComponent(doc,'part-2',{rotation:{x:30}});
  assert.ok(inspectCoupling(doc,doc.links[0]).messages.some(x=>x.includes('parallel')));
  doc=patchComponent(doc,'part-2',{rotation:{x:0},position:{y:1.5}});
  assert.ok(inspectCoupling(doc,doc.links[0]).messages.some(x=>x.includes('planes')));
  doc=newComponent(doc,'block');
  doc=connectComponents(doc,'part-1','part-3');
  const result=solvePreviewSpeeds(doc,{mode:'coupled'});
  assert.ok(result.rejected.length>=2);
});

test('Evidence receipts separate model-derived preview from verified physics',()=>{
  const receipt=makeRealityReceipt(readyGears(),{mode:'coupled',driverId:'part-1'},{cautionCount:2});
  assert.equal(receipt.provenance,'SIMULATED');
  assert.equal(receipt.status,'UNVERIFIED');
  assert.equal(receipt.cautionCount,2);
  assert.equal(receipt.eligibleGearLinks,1);
  assert.match(receipt.notes,/No collision-free motion/);
});
