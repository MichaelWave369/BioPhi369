import {
  makeFramefieldProject,createMotionHandoff,sourceAssemblyJSON,
  handoffInstructions,FRAMEFIELD_URL,PIXELFORGE_URL
} from './creativeBridge.js';
import { makeBridgePack } from './creativeBridgePack.js';

// Local-file bridge only; never pushes designs to other domains without the
// operator selecting a file in the destination application's own importer.
export function createCreativeBridgeUI({getModel,onExportGLB}) {
  const $=id=>document.getElementById(id);
  const status=$('bridge-status');
  const choices=$('bridge-motion-mode');
  let busy=false;
  const notify=message=>{status.textContent=message;};
  function download(blob,name){
    const url=URL.createObjectURL(blob);
    const link=document.createElement('a');link.href=url;link.download=name;
    document.body.append(link);link.click();link.remove();
    setTimeout(()=>URL.revokeObjectURL(url),8000);
  }
  const buttons=['bridge-export-framefield','bridge-export-pixelforge','bridge-export-pack'].map($);
  async function work(kind) {
    if(busy)return;
    busy=true;
    buttons.forEach(b=>{b.disabled=true;});
    const started=Date.now();
    try {
      const doc=getModel();
      if(!doc.parts.length)throw Error('Add a component before exporting.');
      const mode=choices.value;
      const options={mode};
      if(kind==='framefield') {
        const project=makeFramefieldProject(doc,options);
        const json=JSON.stringify(project);
        if(json.length>3_000_000)throw Error('Framefield file exceeds the 3 MB importer cap.');
        download(new Blob([json],{type:'application/json'}),'BioPhi369-Framefield-v07.json');
        notify('Native Framefield Studio JSON downloaded. Open Framefield Studio → Open JSON. 10-second keyframed concept preview; no verified mechanics.');
      } else if(kind==='pixelforge') {
        const blob=await onExportGLB();
        if(!blob || !blob.size || blob.size>50_000_000)throw Error('PixelForge GLB target permits at most 50 MB.');
        download(blob,'BioPhi369-PixelForge-v07.glb');
        notify('Rest-pose GLB downloaded for PixelForge VR Studio → Import local GLB geometry. No motion or source rights transferred.');
      } else if(kind==='pack') {
        const project=makeFramefieldProject(doc,options);
        const framefieldJSON=JSON.stringify(project);
        if(framefieldJSON.length>3_000_000)throw Error('Framefield JSON would exceed its 3 MB limit.');
        const blob=await onExportGLB();
        if(blob.size>50_000_000)throw Error('GLB exceeds destination import size limit.');
        const glb=new Uint8Array(await blob.arrayBuffer());
        const motionJSON=JSON.stringify(createMotionHandoff(doc,options),null,2);
        const {zip,manifest}=await makeBridgePack({
          assemblyJSON:sourceAssemblyJSON(doc),framefieldJSON,motionJSON,
          glb,readme:handoffInstructions()
        });
        download(zip,'BioPhi369-Creative-Bridge-v07.zip');
        notify('Local bridge pack downloaded: '+manifest.files.length+
          ' hashed payloads, 2 separate target formats and original editable design. SIMULATED / UNVERIFIED, not uploaded.');
      }
    } catch(error) {
      notify('Bridge export failed: '+(error?.message||String(error)));
    } finally {
      busy=false;buttons.forEach(b=>{b.disabled=false;});
    }
  }
  $('bridge-export-framefield').addEventListener('click',()=>work('framefield'));
  $('bridge-export-pixelforge').addEventListener('click',()=>work('pixelforge'));
  $('bridge-export-pack').addEventListener('click',()=>work('pack'));
  $('bridge-open-framefield').href=FRAMEFIELD_URL;
  $('bridge-open-pixelforge').href=PIXELFORGE_URL;
  return { isBusy:()=>busy };
}
