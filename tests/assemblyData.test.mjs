import test from 'node:test';
import assert from 'node:assert/strict';
import {
  initialAssembly, validateAssembly, newComponent, patchComponent,
  removeComponent, connectComponents, disconnectComponents,
  captureAssembly, applyAssemblyFrame, exportAssembly, parseAssembly,
  MAX_PARTS, MAX_FRAMES
} from '../src/assemblyData.js';

test('New design loads with two distinct, editable gears', () => {
  const doc=validateAssembly(initialAssembly());
  assert.equal(doc.parts.length,2);
  assert.equal(doc.parts[0].type,'gear');
  assert.equal(doc.parts[1].type,'gear');
  assert.equal(doc.links.length,1);
  assert.equal(doc.explode,0);
});

test('Palette supports all five types, transforms and deletion', () => {
  let doc=initialAssembly();
  for(const type of ['gear','ring','shaft','block','bubble']) doc=newComponent(doc,type);
  assert.equal(doc.parts.length,7);
  const id=doc.selected;
  doc=patchComponent(doc,id,{name:'Reactor bubble',position:{x:2.2},rotation:{y:57},size:1.35,rpm:-28,teeth:20});
  const item=doc.parts.find(p=>p.id===id);
  assert.equal(item.name,'Reactor bubble');
  assert.equal(item.position.x,2.2);
  assert.equal(item.position.y,0);
  assert.equal(item.rotation.y,57);
  assert.equal(item.rpm,-28);
  doc=removeComponent(doc,id);
  assert.ok(!doc.parts.some(p=>p.id===id));
});

test('Connections reference only existing endpoints and cannot double-link', () => {
  let doc=initialAssembly();
  assert.throws(()=>connectComponents(doc,'part-1','part-1'),/different/);
  assert.throws(()=>connectComponents(doc,'part-1','nope'),/different/);
  assert.throws(()=>connectComponents(doc,'part-2','part-1'),/already/);
  doc=newComponent(doc,'shaft');
  doc=connectComponents(doc,'part-3','part-1');
  assert.equal(doc.links.length,2);
  doc=disconnectComponents(doc,'part-1','part-3');
  assert.equal(doc.links.length,1);
  doc=removeComponent(doc,'part-1');
  assert.deepEqual(doc.links,[]);
});

test('Keyframes are snapshots; replay restores parts and separation', () => {
  let doc=initialAssembly();
  doc.explode=67;
  doc=captureAssembly(doc,'Before change');
  assert.equal(doc.frames.length,1);
  doc=patchComponent(doc,'part-1',{position:{x:4}});
  doc.explode=0;
  const next=applyAssemblyFrame(doc,0);
  assert.equal(next.parts[0].position.x,-.66);
  assert.equal(next.explode,67);
  assert.equal(next.frames.length,1);
});

test('JSON export/import round-trip and reject poisoned or oversized inputs', () => {
  const serialized=exportAssembly(initialAssembly());
  assert.deepEqual(parseAssembly(serialized),validateAssembly(initialAssembly()));
  const original=JSON.parse(serialized);
  assert.throws(()=>parseAssembly(JSON.stringify({...original,format:'unknown'})),/Unrecognized/);
  assert.throws(()=>validateAssembly({...original,parts:Array(MAX_PARTS+1).fill(original.parts[0])}),/exceeds/);
  assert.throws(()=>validateAssembly({...original,frames:Array(MAX_FRAMES+1).fill({})}),/exceeds/);
  assert.throws(()=>validateAssembly({...original,parts:[{...original.parts[0],size:Infinity}]}),/Invalid component/);
  assert.throws(()=>validateAssembly({...original,parts:[{...original.parts[0],position:{x:9,y:0,z:0}}]}),/Invalid position/);
  assert.throws(()=>validateAssembly({...original,parts:[{...original.parts[0],name:'x'.repeat(100)}]}),/Invalid component name/);
  assert.throws(()=>validateAssembly({...original,links:[{from:'part-1',to:'part-999'}]}),/Invalid connection/);
  assert.throws(()=>parseAssembly('x'.repeat(250001)),/Import too large/);
});

test('Max component and frame limits reject extra additions instead of silently truncating',()=>{
  let doc=initialAssembly();
  while(doc.parts.length<MAX_PARTS)doc=newComponent(doc,'block');
  assert.throws(()=>newComponent(doc,'gear'),/Maximum 24/);
  let small=initialAssembly();
  for(let i=0;i<MAX_FRAMES;i++)small=captureAssembly(small,'pose '+i);
  assert.throws(()=>captureAssembly(small,'another'),/Maximum 12/);
});
