import test from 'node:test';
import assert from 'node:assert/strict';
import { initialAssembly,patchComponent,captureAssembly } from '../src/assemblyData.js';
import { makeFramefieldProject,makeTaggedFramefieldName } from '../src/creativeBridge.js';
import { inspectRoundTrip,applyReviewedRoundTrip,parseFramefieldReturn } from '../src/roundTrip.js';
const copy=x=>structuredClone(x);
function exported(doc=initialAssembly()){
  return makeFramefieldProject(doc,{mode:'independent'});
}
function key(obj){return obj.keyframes.find(k=>k.frame===0);}
test('Target-generated ids may change: stable tagged Framefield names round-trip unmodified',()=>{
  const doc=initialAssembly(),scene=exported(doc);
  assert.match(scene.objects[0].name,/^\[BP369:part-1\] Drive gear$/);
  assert.equal(makeTaggedFramefieldName(doc.parts[1]),'[BP369:part-2] Follower gear');
  scene.objects[0].id='framefield-regenerated-guid';
  scene.objects[1].id='another-generated-guid';
  const review=inspectRoundTrip(doc,JSON.stringify(scene));
  assert.equal(review.actionable,0);
  assert.equal(review.rows.length,2);
  assert.equal(review.fatal,false);
  assert.equal(review.status,'UNVERIFIED');
});

test('Only explicitly selected transform and rename edits apply; frames, links, RPMs and teeth survive',()=>{
  let doc=initialAssembly();
  doc=captureAssembly(doc,'Before animated concept');
  const original=copy(doc);
  const scene=exported(doc);
  key(scene.objects[0]).position=[.55,.75,-.4];
  key(scene.objects[0]).rotation=[0,45,0];
  key(scene.objects[0]).scale=[1,1,1]; // Uniform gear size 1 instead of .8
  scene.objects[0].name='[BP369:part-1] Drive gear edited';
  key(scene.objects[1]).position=[3,0,0]; // Other part must remain untouched
  const review=inspectRoundTrip(doc,scene);
  assert.equal(review.actionable,2);
  assert.equal(review.rows[0].changes.length,6);
  const next=applyReviewedRoundTrip(doc,review,['part-1']);
  assert.deepEqual(next.parts[0].position,{x:.55,y:.75,z:-.4});
  assert.equal(next.parts[0].rotation.y,45);
  assert.equal(next.parts[0].size,1);
  assert.equal(next.parts[0].name,'Drive gear edited');
  assert.deepEqual(next.parts[1],original.parts[1]);
  assert.deepEqual(next.links,original.links);
  assert.deepEqual(next.frames,original.frames);
  assert.equal(next.parts[0].rpm,18);
  assert.equal(next.parts[0].teeth,16);
  assert.deepEqual(doc,original);
});

test('Untyped old v0.7 projects cannot be silently mapped by matching names',()=>{
  const doc=initialAssembly(),scene=exported(doc);
  scene.objects[0].name='Drive gear';
  const review=inspectRoundTrip(doc,scene);
  assert.equal(review.actionable,0);
  assert.ok(review.problems.some(x=>x.includes('Unmapped')));
  assert.throws(()=>applyReviewedRoundTrip(doc,review,['part-1']),/unreviewed/);
});

test('Duplicate tagged identities globally block application even when another part changed',()=>{
  const doc=initialAssembly(),scene=exported(doc);
  scene.objects[1].name=scene.objects[0].name;
  key(scene.objects[0]).position=[.3,0,0];
  const review=inspectRoundTrip(doc,scene);
  assert.equal(review.fatal,true);
  assert.throws(()=>applyReviewedRoundTrip(doc,review,['part-1']),/unsafe/);
});

test('Missing rest frame, wrong primitive and nonuniform scale are blocked',()=>{
  const doc=initialAssembly();
  for(const change of [
    scene=>scene.objects[0].keyframes=scene.objects[0].keyframes.filter(k=>k.frame!==0),
    scene=>scene.objects[0].type='box',
    scene=>key(scene.objects[0]).scale=[.8,1.1,.8],
    scene=>key(scene.objects[0]).position=[99,0,0],
  ]){
    const scene=exported(doc);change(scene);
    const review=inspectRoundTrip(doc,scene);
    assert.equal(review.rows[0].blocked,true);
    assert.equal(review.rows[0].changes.length,0);
  }
});

test('Unsupported custom geometry edits are reported but not imported',()=>{
  const doc=initialAssembly(),scene=exported(doc);
  scene.objects[0].geometry.vertices[0][0]+=0.1;
  key(scene.objects[0]).position=[0,0,0];
  const review=inspectRoundTrip(doc,scene);
  assert.ok(review.rows[0].warnings.some(w=>w.includes('mesh topology')));
  const next=applyReviewedRoundTrip(doc,review,['part-1']);
  assert.equal(next.parts[0].position.x,0);
  assert.equal(next.parts[0].size,doc.parts[0].size);
  assert.equal(next.parts[0].teeth,doc.parts[0].teeth);
});

test('Stale preview and invalid selection fail closed without mutation',()=>{
  const doc=initialAssembly(),scene=exported(doc);
  key(scene.objects[0]).position=[1,0,0];
  const review=inspectRoundTrip(doc,scene);
  const changed=patchComponent(doc,'part-1',{position:{x:2}});
  assert.throws(()=>applyReviewedRoundTrip(changed,review,['part-1']),/changed/);
  assert.throws(()=>applyReviewedRoundTrip(doc,review,[]),/at least one/);
  assert.throws(()=>applyReviewedRoundTrip(doc,review,['part-1','part-1']),/unreviewed/);
  assert.throws(()=>applyReviewedRoundTrip(doc,review,['part-5']),/unreviewed/);
});

test('Selection and presentation-only explode changes do not invalidate an otherwise safe review',()=>{
  const doc=initialAssembly(),scene=exported(doc);
  key(scene.objects[0]).position=[1,0,0];
  const review=inspectRoundTrip(doc,scene);
  const selected=copy(doc);
  selected.selected='part-2';
  selected.explode=25;
  const next=applyReviewedRoundTrip(selected,review,['part-1']);
  assert.equal(next.selected,'part-2');
  assert.equal(next.explode,25);
  assert.equal(next.parts[0].position.x,1);
});

test('Invalid inputs fail before they can produce proposed changes',()=>{
  const doc=initialAssembly(),scene=exported(doc);
  assert.throws(()=>parseFramefieldReturn('{invalid'),/Invalid Framefield/);
  assert.throws(()=>parseFramefieldReturn('{}'),/Expected a Framefield/);
  assert.throws(()=>parseFramefieldReturn(' '.repeat(3_000_001)),/under 3 MB/);
  scene.objects[0].geometry.vertices[0]=[Infinity,0,0];
  assert.throws(()=>inspectRoundTrip(doc,scene),/Invalid mesh/);
});

test('Long component names have stable tag while target max-65 field is respected',()=>{
  let doc=initialAssembly();
  doc=patchComponent(doc,'part-1',{name:'A'.repeat(60)});
  const scene=exported(doc);
  assert.ok(scene.objects[0].name.length<=65);
  const review=inspectRoundTrip(doc,scene);
  assert.equal(review.actionable,0);
});

test('No unsupported deletion/extra parts can be inferred or applied',()=>{
  const doc=initialAssembly(),scene=exported(doc);
  scene.objects.pop();
  scene.objects.push({type:'box',name:'Outside object',keyframes:[{
    frame:0,position:[0,0,0],rotation:[0,0,0],scale:[1,1,1]
  }]});
  const review=inspectRoundTrip(doc,scene);
  assert.ok(review.problems.some(x=>x.includes('absent')));
  assert.ok(review.problems.some(x=>x.includes('Unmapped')));
  assert.equal(review.actionable,0);
});
