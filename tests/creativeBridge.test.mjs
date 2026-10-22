import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { initialAssembly, newComponent, patchComponent } from '../src/assemblyData.js';
import { snapAssembly } from '../src/realityCheck.js';
import {
  FRAMEFIELD_FPS, FRAMEFIELD_DURATION, BRIDGE_MODES, framefieldPart,
  makeFramefieldProject, createMotionHandoff,sourceAssemblyJSON,
  handoffInstructions, FRAMEFIELD_URL, PIXELFORGE_URL
} from '../src/creativeBridge.js';
import { crc32,makeBridgeZip,makeBridgePack,BRIDGE_FILES,PACK_MAX_BYTES } from '../src/creativeBridgePack.js';

const clone=x=>structuredClone(x);
const ready=()=>{
  let doc=initialAssembly();
  doc=patchComponent(doc,'part-2',{size:.8});
  doc=snapAssembly(doc,'part-2','part-1','gear-pitch');
  return doc;
};
function checkFramefieldProject(project){
  // Mirrors actual Framefield v1 public src/scene.js import schema limits.
  assert.equal(project.version,1);
  assert.ok([12,24,30,60].includes(project.fps));
  assert.ok(Number.isInteger(project.duration)&&project.duration>=12&&project.duration<=600);
  assert.ok(Array.isArray(project.objects)&&project.objects.length<=100);
  for(const o of project.objects){
    assert.ok(['box','sphere','pyramid','cylinder','torus'].includes(o.type));
    assert.match(o.color,/^#[0-9a-f]{6}$/i);
    assert.ok(o.keyframes.length>0&&o.keyframes.length<=600);
    assert.ok(o.name.length<=65);
    for(const k of o.keyframes){
      assert.ok(Number.isInteger(k.frame)&&k.frame>=0&&k.frame<=project.duration);
      for(const axis of ['position','rotation','scale']){
        assert.equal(k[axis].length,3);
        assert.ok(k[axis].every(n=>Number.isFinite(n)&&Math.abs(n)<=10000));
      }
    }
    if(o.geometry){
      const g=o.geometry;
      assert.ok(g.vertices.length>=3&&g.vertices.length<=800);
      assert.ok(g.faces.length>=1&&g.faces.length<=1200);
      assert.ok(g.vertices.every(v=>v.length===3&&v.every(Number.isFinite)));
      assert.ok(g.faces.every(face=>face.length>=3&&face.length<=16&&
        face.every(i=>Number.isInteger(i)&&i>=0&&i<g.vertices.length)&&
        new Set(face).size===face.length));
    }
  }
}
function readZipNames(blob) {
  return blob.arrayBuffer().then(bytes=>{
    const b=new Uint8Array(bytes),v=new DataView(bytes),names=[];
    let offset=0;
    while(offset<b.length){
      const sig=v.getUint32(offset,true);
      if(sig===0x02014b50||sig===0x06054b50)break;
      assert.equal(sig,0x04034b50);
      const size=v.getUint32(offset+18,true),nlen=v.getUint16(offset+26,true);
      const extras=v.getUint16(offset+28,true);
      const name=new TextDecoder().decode(b.slice(offset+30,offset+30+nlen));
      const data=b.slice(offset+30+nlen+extras,offset+30+nlen+extras+size);
      assert.equal(crc32(data),v.getUint32(offset+14,true));
      names.push({name,data});
      offset+=30+nlen+extras+size;
    }
    return names;
  });
}

test('Framefield native scene export has the actual v1 schema and 24fps 10s bounds',()=>{
  const project=makeFramefieldProject(initialAssembly());
  checkFramefieldProject(project);
  assert.equal(project.fps,FRAMEFIELD_FPS);
  assert.equal(project.duration,FRAMEFIELD_DURATION);
  assert.equal(project.objects.length,2);
  assert.equal(project.objects[0].type,'cylinder');
  assert.equal(project.objects[0].geometry.faces.length,16*4*3);
  assert.equal(project.objects[1].keyframes.length,1,'ineligible follower stays stationary in coupled preview');
});

test('Eligible external gears animate opposite rotation without manufacturing claims',()=>{
  const project=makeFramefieldProject(ready(),{mode:'coupled',driverId:'part-1'});
  checkFramefieldProject(project);
  assert.equal(project.objects[0].keyframes.length,241);
  assert.equal(project.objects[1].keyframes.length,241);
  assert.equal(project.objects[0].keyframes.at(-1).rotation[1],1080);
  assert.equal(project.objects[1].keyframes.at(-1).rotation[1],-1080);
  const handoff=createMotionHandoff(ready(),{mode:'coupled',driverId:'part-1'});
  assert.equal(handoff.provenance,'SIMULATED');
  assert.equal(handoff.verification,'UNVERIFIED');
  assert.equal(handoff.eligibleLinks.length,1);
  assert.equal(handoff.speedsRPM['part-2'],-18);
});

test('Independent RPM mode preserves user-assigned speeds and source unchanged',()=>{
  const doc=initialAssembly(),before=JSON.stringify(doc);
  const project=makeFramefieldProject(doc,{mode:'independent'});
  checkFramefieldProject(project);
  assert.equal(project.objects[1].keyframes.at(-1).rotation[1],-1200);
  assert.equal(JSON.stringify(doc),before);
  assert.deepEqual(BRIDGE_MODES,['coupled','independent']);
  assert.throws(()=>makeFramefieldProject(doc,{mode:'unsafe'}),/Unsupported bridge/);
});

test('All five shapes have target-native primitives or valid custom geometry',()=>{
  let doc=initialAssembly();
  for(const type of ['ring','shaft','block','bubble'])doc=newComponent(doc,type);
  doc=patchComponent(doc,'part-1',{teeth:40});
  const project=makeFramefieldProject(doc,{mode:'independent'});
  checkFramefieldProject(project);
  assert.deepEqual(project.objects.map(x=>x.type),[
    'cylinder','cylinder','torus','cylinder','box','sphere'
  ]);
  assert.ok(project.objects[2].geometry.vertices.length<=800);
  assert.ok(project.objects[0].geometry.faces.length<=1200);
});

test('Max 24 moving gears produces a Framefield project under 3MB importer cap',()=>{
  let doc=initialAssembly();
  doc=patchComponent(doc,'part-2',{rpm:120});
  while(doc.parts.length<24){
    doc=newComponent(doc,'gear');
    doc=patchComponent(doc,doc.selected,{rpm:120});
  }
  const project=makeFramefieldProject(doc,{mode:'independent'});
  checkFramefieldProject(project);
  assert.ok(JSON.stringify(project).length<3_000_000,'Framefield importer rejects files over 3 MB');
});

test('Original BioPhi source and plain-language target instructions survive handoff',()=>{
  const raw=JSON.parse(sourceAssemblyJSON(initialAssembly()));
  assert.equal(raw.format,'BioPhi369-Assembly');
  assert.equal(raw.version,1);
  const guide=handoffInstructions();
  assert.match(guide,/FRAMEFIELD STUDIO/);
  assert.match(guide,/PIXELFORGE VR STUDIO/);
  assert.ok(guide.includes(FRAMEFIELD_URL));
  assert.ok(guide.includes(PIXELFORGE_URL));
  assert.match(guide,/not.*automatic|No transfer|not.*certified/i);
});

test('ZIP CRC and fixed filenames are deterministic and bounded',async()=>{
  assert.equal(crc32(new TextEncoder().encode('123456789')),0xcbf43926);
  const files=BRIDGE_FILES.map(name=>({name,data:'hi'}));
  const blob=makeBridgeZip(files);
  const entries=await readZipNames(blob);
  assert.deepEqual(entries.map(x=>x.name),BRIDGE_FILES);
  assert.throws(()=>makeBridgeZip([{name:'../evil',data:'hi'}]),/manifest order/);
  assert.throws(()=>makeBridgeZip(BRIDGE_FILES.map(name=>({name,data:new Uint8Array(PACK_MAX_BYTES)}))),/exceeds/);
});

test('Bridge ZIP manifest cryptographically hashes actual bytes, not fictitious receipts',async()=>{
  if(!globalThis.crypto)globalThis.crypto=webcrypto;
  const glb=new Uint8Array(32);
  glb.set([103,108,84,70],0); // "glTF"
  new DataView(glb.buffer).setUint32(4,2,true);
  const framefieldJSON=JSON.stringify(makeFramefieldProject(initialAssembly()));
  const pack=await makeBridgePack({
    assemblyJSON:sourceAssemblyJSON(initialAssembly()),
    framefieldJSON,
    motionJSON:JSON.stringify(createMotionHandoff(initialAssembly())),
    glb,readme:handoffInstructions()
  });
  assert.equal(pack.manifest.files.length,5);
  assert.equal(pack.manifest.provenance,'SIMULATED');
  assert.equal(pack.manifest.verification,'UNVERIFIED');
  const files=await readZipNames(pack.zip);
  assert.deepEqual(files.map(x=>x.name),BRIDGE_FILES);
  for(const receipt of pack.manifest.files){
    const match=files.find(x=>x.name===receipt.name);
    const actual=await webcrypto.subtle.digest('SHA-256',match.data);
    const actualHex=Buffer.from(actual).toString('hex');
    assert.equal(actualHex,receipt.sha256);
    assert.equal(match.data.length,receipt.bytes);
  }
  await assert.rejects(()=>makeBridgePack({
    assemblyJSON:'{}',framefieldJSON:'{}',motionJSON:'{}',
    glb:new Uint8Array([0,0,0]),readme:'help'
  }),/glTF binary header/);
});
