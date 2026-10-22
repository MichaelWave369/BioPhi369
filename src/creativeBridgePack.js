// Minimal bounded ZIP32 STORE pack, original implementation.
// No third-party code, executable import, decompression or network upload.
const encoder=new TextEncoder();
const TABLE=Uint32Array.from({length:256},(_,n)=>{
  let c=n;
  for(let j=0;j<8;j++)c=(c&1)?(0xedb88320^(c>>>1)):(c>>>1);
  return c>>>0;
});
export function crc32(data) {
  let crc=0xffffffff;
  for(const byte of data)crc=TABLE[(crc^byte)&255]^(crc>>>8);
  return (crc^0xffffffff)>>>0;
}
const u16=(dv,o,n)=>dv.setUint16(o,n,true);
const u32=(dv,o,n)=>dv.setUint32(o,n,true);
const toBytes=value=>{
  if(value instanceof Uint8Array)return value;
  if(value instanceof ArrayBuffer)return new Uint8Array(value);
  if(typeof value==='string')return encoder.encode(value);
  throw Error('Unsupported ZIP payload type');
};
export const BRIDGE_FILES = [
  'manifest.json','biophi.assembly.json','framefield.scene.json',
  'motion-handoff.json','pixelforge.model.glb','README.txt'
];
export const PACK_MAX_BYTES=14_000_000;
export function makeBridgeZip(files) {
  if(!Array.isArray(files)||files.length!==BRIDGE_FILES.length ||
    !files.every((f,i)=>f&&f.name===BRIDGE_FILES[i]))throw Error('Invalid bridge file manifest order');
  const parts=[],directory=[];
  let position=0,centralSize=0;
  for(const item of files){
    const data=toBytes(item.data),name=encoder.encode(item.name);
    if(data.length>PACK_MAX_BYTES||position+data.length>PACK_MAX_BYTES)
      throw Error('Bridge pack exceeds 14 MB safety limit');
    const local=new Uint8Array(30+name.length),view=new DataView(local.buffer);
    u32(view,0,0x04034b50);u16(view,4,20);u16(view,6,0x0800);
    u16(view,8,0);u16(view,10,0);u16(view,12,0);
    u32(view,14,crc32(data));u32(view,18,data.length);u32(view,22,data.length);
    u16(view,26,name.length);u16(view,28,0);local.set(name,30);
    parts.push(local,data);
    const central=new Uint8Array(46+name.length),v=new DataView(central.buffer);
    u32(v,0,0x02014b50);u16(v,4,20);u16(v,6,20);u16(v,8,0x0800);
    u16(v,10,0);u16(v,12,0);u16(v,14,0);
    u32(v,16,crc32(data));u32(v,20,data.length);u32(v,24,data.length);
    u16(v,28,name.length);u16(v,30,0);u16(v,32,0);
    u16(v,34,0);u16(v,36,0);u32(v,38,0);
    u32(v,42,position);central.set(name,46);
    directory.push(central);
    position+=local.length+data.length;centralSize+=central.length;
  }
  const footer=new Uint8Array(22),v=new DataView(footer.buffer);
  u32(v,0,0x06054b50);u16(v,4,0);u16(v,6,0);
  u16(v,8,files.length);u16(v,10,files.length);
  u32(v,12,centralSize);u32(v,16,position);u16(v,20,0);
  return new Blob([...parts,...directory,footer],{type:'application/zip'});
}
export async function sha256(bytes) {
  const data=toBytes(bytes);
  const digest=await crypto.subtle.digest('SHA-256',data);
  return [...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('');
}
export async function makeBridgePack({
  assemblyJSON,framefieldJSON,motionJSON,glb,readme
}){
  const payloads=[
    {name:'biophi.assembly.json',data:toBytes(assemblyJSON)},
    {name:'framefield.scene.json',data:toBytes(framefieldJSON)},
    {name:'motion-handoff.json',data:toBytes(motionJSON)},
    {name:'pixelforge.model.glb',data:toBytes(glb)},
    {name:'README.txt',data:toBytes(readme)}
  ];
  if(payloads.some(x=>x.data.byteLength===0))throw Error('Bridge pack cannot contain empty data');
  if(payloads[3].data.byteLength<20 ||
    String.fromCharCode(...payloads[3].data.slice(0,4))!=='glTF')
    throw Error('Exported GLB does not contain a glTF binary header');
  const manifest={
    format:'BioPhi369-Creative-Bridge',version:1,
    provenance:'SIMULATED',verification:'UNVERIFIED',
    createdAt:new Date().toISOString(),
    generatedLocally:true,rights:'Operator must verify source rights and target usage',
    files:await Promise.all(payloads.map(async entry=>({
      name:entry.name,bytes:entry.data.byteLength,sha256:await sha256(entry.data)
    }))),
    targets:[
      {name:'FramefieldStudio',file:'framefield.scene.json',kind:'Native v1 JSON',motion:'10s 24fps idealized keyframes',status:'conceptual'},
      {name:'PixelForge VR Studio',file:'pixelforge.model.glb',kind:'glTF 2.0 binary',motion:'static rest geometry only',status:'operator-import required'}
    ],
    noSafetyCertification:true
  };
  const ordered=[
    {name:'manifest.json',data:JSON.stringify(manifest,null,2)},...payloads
  ];
  const zip=makeBridgeZip(ordered);
  return {zip,manifest};
}
