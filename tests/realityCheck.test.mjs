import test from 'node:test';
import assert from 'node:assert/strict';
import { initialAssembly, newComponent, patchComponent, connectComponents } from '../src/assemblyData.js';
import {
  analyzeAssembly, snapAssembly, proxyRadius,
  externalGearFollowerRPM, nominalGearPitchDistance
} from '../src/realityCheck.js';

const duplicate = value => JSON.parse(JSON.stringify(value));

test('Linked gear preview derives external ratio from tooth counts, with signed RPM',()=>{
  const doc=initialAssembly();
  const driver=doc.parts[0],follower=doc.parts[1];
  assert.equal(externalGearFollowerRPM(driver,follower),-18);
  assert.equal(nominalGearPitchDistance(driver,follower),.56*(.8+.72));
  const check=analyzeAssembly(doc);
  assert.equal(check.ratios.length,1);
  assert.equal(check.ratios[0].expectedRPM,-18);
  assert.ok(check.findings.some(f=>f.code==='gear-rpm'));
  assert.ok(check.findings.some(f=>f.code==='gear-spacing'));
  assert.equal(check.checkedPairs,1);
});

test('No linked gears produces no ratio assertions and empty assembly is not called safe',()=>{
  const doc=initialAssembly();
  doc.parts=[];doc.links=[];doc.selected=null;
  const check=analyzeAssembly(doc);
  assert.deepEqual(check.ratios,[]);
  assert.ok(check.findings.some(f=>f.code==='empty'));
  assert.match(check.disclaimer,/NOT|no rotated mesh/i);
});

test('Pitch snap aligns two gears in approximate plane but does not assert mesh verification',()=>{
  const doc=initialAssembly();
  const original=duplicate(doc);
  const snapped=snapAssembly(doc,'part-2','part-1','gear-pitch');
  const check=analyzeAssembly(snapped);
  const ratio=check.ratios[0];
  assert.equal(ratio.centerDistance,ratio.pitchDistance);
  assert.equal(snapped.parts[1].position.y,snapped.parts[0].position.y);
  assert.ok(!check.findings.some(f=>f.code==='gear-spacing'));
  assert.equal(doc.parts[1].position.x,original.parts[1].position.x,'Snap must not modify input');
  assert.ok(check.findings.some(f=>f.code==='gear-rpm'),'Independent RPM remains a warning');
});

test('Snap actions can align each world axis or place envelopes beside one another',()=>{
  let doc=newComponent(initialAssembly(),'block');
  doc=patchComponent(doc,'part-3',{position:{x:2.4,y:3.1,z:-3}});
  doc=snapAssembly(doc,'part-3','part-1','y');
  assert.equal(doc.parts[2].position.y,0);
  doc=snapAssembly(doc,'part-3','part-1','z');
  assert.equal(doc.parts[2].position.z,0);
  doc=snapAssembly(doc,'part-3','part-1','x');
  assert.equal(doc.parts[2].position.x,-.66);
  doc=snapAssembly(doc,'part-3','part-1','beside');
  assert.equal(doc.parts[2].position.y,0);
  assert.equal(doc.parts[2].position.z,0);
  assert.ok(doc.parts[2].position.x>doc.parts[0].position.x);
  assert.ok(proxyRadius(doc.parts[2])>0);
});

test('Overlap screen catches very close non-geared primitives but remains conservative',()=>{
  let doc=initialAssembly();
  doc=newComponent(doc,'block');
  doc=newComponent(doc,'bubble');
  doc=patchComponent(doc,'part-3',{position:{x:3,y:1,z:1}});
  doc=patchComponent(doc,'part-4',{position:{x:3.02,y:1.02,z:1.02}});
  const check=analyzeAssembly(doc);
  const found=check.findings.find(f=>f.code==='proxy-overlap'&&
    f.ids.includes('part-3')&&f.ids.includes('part-4'));
  assert.ok(found);
  assert.match(found.detail,/false positives|does NOT prove/);
  assert.equal(check.checkedPairs,6);
});

test('Warnings detect out-of-plane gear axes and mismatched tooth-size relationship',()=>{
  let doc=initialAssembly();
  doc=patchComponent(doc,'part-2',{rotation:{x:22},position:{y:1.7},teeth:32});
  doc=connectComponents(newComponent(doc,'gear'),'part-2','part-3');
  const check=analyzeAssembly(doc);
  assert.ok(check.findings.some(f=>f.code==='gear-tilt'));
  assert.ok(check.findings.some(f=>f.code==='gear-plane'));
  assert.ok(check.findings.some(f=>f.code==='gear-scale'));
  assert.ok(check.ratios.length>=2);
});

test('Invalid actions and bounds reject instead of silently mutating',()=>{
  const doc=initialAssembly();
  assert.throws(()=>snapAssembly(doc,'part-1','part-1','y'),/different/);
  assert.throws(()=>snapAssembly(doc,'part-1','part-2','diagonal'),/Unknown snap/);
  let withBlock=newComponent(doc,'block');
  assert.throws(()=>snapAssembly(withBlock,'part-3','part-1','gear-pitch'),/two gears/);
  withBlock=patchComponent(withBlock,'part-1',{position:{x:8}});
  assert.throws(()=>snapAssembly(withBlock,'part-3','part-1','beside'),/exceeds scene limits/);
  withBlock=patchComponent(withBlock,'part-1',{rotation:{x:24}});
  assert.throws(()=>snapAssembly(withBlock,'part-2','part-1','gear-pitch'),/Reset target gear/);
});

test('Analysis deterministic, nonmutating and bounded to existing 24-part limit',()=>{
  let doc=initialAssembly();
  while(doc.parts.length<24) doc=newComponent(doc,'block');
  const frozen=JSON.stringify(doc);
  const a=analyzeAssembly(doc);
  const b=analyzeAssembly(doc);
  assert.deepEqual(a,b);
  assert.equal(a.checkedPairs,276);
  assert.equal(JSON.stringify(doc),frozen);
  assert.ok(a.findings.every(f=>['info','caution'].includes(f.severity)));
});
