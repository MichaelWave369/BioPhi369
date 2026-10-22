import {
  ASSEMBLY_KEY, MAX_PARTS, MAX_FRAMES, MAX_FILE_BYTES, initialAssembly,
  validateAssembly, newComponent, patchComponent, removeComponent,
  connectComponents, disconnectComponents, captureAssembly, applyAssemblyFrame,
  exportAssembly, parseAssembly
} from './assemblyData.js';
import { analyzeAssembly, snapAssembly } from './realityCheck.js';

// A local-first, human-directed editor. No AI mind-reading or hardware actuation.
export function createAssemblyUI({ onChange, onSelect, onExplode, onExportGLB }) {
  const $ = (id) => document.getElementById(id);
  const panel = $('assembly-panel');
  let doc = initialAssembly();
  let timer = null;
  let playing = false;
  let activeFrame = -1;
  let active = false;
  const status = (message) => { $('assembly-status').textContent = message; };
  const copy = (value) => JSON.parse(JSON.stringify(value));

  function save() {
    try { localStorage.setItem(ASSEMBLY_KEY,exportAssembly(doc)); return true; }
    catch { status('Browser storage unavailable. Use Export JSON to keep this design.'); return false; }
  }
  function load() {
    try {
      const raw = localStorage.getItem(ASSEMBLY_KEY);
      if (raw) { doc = parseAssembly(raw); status('Restored your locally saved assembly.'); }
    } catch { doc = initialAssembly(); status('Saved design could not be validated. Loaded the example assembly.'); }
  }
  function changed(message, rebuild = true) {
    doc = validateAssembly(doc);
    save();
    render();
    if (rebuild) onChange(copy(doc));
    if (message) status(message);
  }
  function stop() {
    if (timer !== null) clearTimeout(timer);
    timer = null;
    playing = false;
    activeFrame = -1;
    renderFrames();
  }
  function requireSelected() {
    return doc.parts.find(part => part.id === doc.selected) ?? null;
  }
  function select(id) {
    if (!doc.parts.some(part => part.id === id)) return;
    doc.selected = id;
    save(); render();
    onSelect(id);
  }

  function renderList() {
    const list=$('assembly-list');
    list.replaceChildren();
    for (const part of doc.parts) {
      const button=document.createElement('button');
      button.type='button';
      button.className='assembly-part'+(part.id===doc.selected?' active':'');
      button.setAttribute('aria-pressed',String(part.id===doc.selected));
      const icon=document.createElement('span');
      icon.className='assembly-part-icon';
      icon.textContent=({gear:'⚙',ring:'◎',shaft:'┃',block:'▣',bubble:'◌'})[part.type];
      const label=document.createElement('span');
      label.textContent=part.name || part.type;
      const type=document.createElement('small');
      type.textContent=part.type.toUpperCase()+' · '+part.id;
      button.append(icon,label,type);
      button.addEventListener('click',()=>select(part.id));
      list.append(button);
    }
    $('assembly-count').textContent=doc.parts.length+' / '+MAX_PARTS;
    panel.querySelectorAll('[data-shape]').forEach(b=>{b.disabled=doc.parts.length>=MAX_PARTS;});
  }

  function renderInspector() {
    const current=requireSelected();
    $('assembly-inspector').querySelectorAll('input').forEach(input=>{input.disabled=!current;});
    $('assembly-name').value=current?.name??'';
    panel.querySelectorAll('[data-assembly-field]').forEach(input=>{
      const path=input.dataset.assemblyField.split('.');
      const val=current && (path.length===2?current[path[0]][path[1]]:current[path[0]]);
      input.value=val??'';
    });
    $('teeth-control').hidden=current?.type!=='gear';
    $('assembly-duplicate').disabled=!current||doc.parts.length>=MAX_PARTS;
    $('assembly-delete').disabled=!current;
  }

  function renderLinks() {
    const select=$('assembly-link-target');
    select.replaceChildren();
    const current=requireSelected();
    const candidates=doc.parts.filter(part=>part.id!==doc.selected);
    for(const part of candidates){
      const option=document.createElement('option');
      option.value=part.id;
      option.textContent=part.name;
      select.append(option);
    }
    select.disabled=!current||candidates.length===0;
    $('assembly-connect').disabled=select.disabled;
    const list=$('assembly-links');list.replaceChildren();
    for(const link of doc.links){
      const li=document.createElement('li');
      const a=doc.parts.find(p=>p.id===link.from);
      const b=doc.parts.find(p=>p.id===link.to);
      const text=document.createElement('span');
      text.textContent=(a?.name??link.from)+' ↔ '+(b?.name??link.to);
      const remove=document.createElement('button');
      remove.type='button';remove.textContent='×';
      remove.setAttribute('aria-label','Remove connection '+text.textContent);
      remove.addEventListener('click',()=>{
        stop();
        doc=disconnectComponents(doc,link.from,link.to);
        changed('Removed visual connection.');
      });
      li.append(text,remove);list.append(li);
    }
  }

  function renderFrames(){
    const list=$('assembly-frames');list.replaceChildren();
    for(const [index,frame] of doc.frames.entries()){
      const li=document.createElement('li');
      li.className='frame-row'+(index===activeFrame?' playing':'');
      const button=document.createElement('button');
      button.className='frame-select';button.type='button';
      button.textContent=String(index+1).padStart(2,'0')+' · '+frame.label;
      const desc=document.createElement('small');
      desc.textContent=frame.parts.length+' components / '+frame.explode+'% exploded';
      button.append(desc);
      button.addEventListener('click',()=>{
        stop();doc=applyAssemblyFrame(doc,index);changed('Applied frame '+(index+1)+'.');
      });
      const del=document.createElement('button');
      del.type='button';del.className='frame-delete';del.textContent='×';
      del.disabled=playing;
      del.setAttribute('aria-label','Delete assembly frame '+(index+1));
      del.addEventListener('click',()=>{
        stop();doc.frames.splice(index,1);changed('Removed assembly keyframe.',false);
      });
      li.append(button,del);list.append(li);
    }
    $('assembly-play').disabled=doc.frames.length===0||playing;
    $('assembly-stop').disabled=!playing;
    $('assembly-capture').disabled=doc.frames.length>=MAX_FRAMES||playing;
    $('assembly-clear-frames').disabled=doc.frames.length===0||playing;
  }


  function renderReality() {
    const selected=requireSelected();
    const target=$('reality-target');
    const keep=target.value;
    target.replaceChildren();
    const alternatives=doc.parts.filter(p=>p.id!==doc.selected);
    for(const part of alternatives) {
      const option=document.createElement('option');
      option.value=part.id;
      option.textContent=part.name || part.id;
      target.append(option);
    }
    if(alternatives.some(p=>p.id===keep)) target.value=keep;
    target.disabled=!selected || alternatives.length===0;
    panel.querySelectorAll('[data-snap]').forEach(button=>{
      button.disabled=target.disabled || (button.dataset.snap==='gear-pitch' && (
        selected?.type!=='gear' || doc.parts.find(p=>p.id===target.value)?.type!=='gear'));
    });

    const analysis=analyzeAssembly(doc);
    const summary=$('reality-summary');
    summary.classList.toggle('has-warnings',analysis.cautionCount>0);
    summary.textContent=analysis.checkedParts+' components · '+analysis.checkedPairs+' pairs screened · '+
      analysis.cautionCount+' caution'+(analysis.cautionCount===1?'':'s')+
      '. '+(analysis.cautionCount?'Review the findings below.':'No flags from these limited checks; NOT a safety clearance.');

    const ratios=$('reality-ratios');ratios.replaceChildren();
    if(!analysis.ratios.length){
      const p=document.createElement('p');p.className='reality-detail';
      p.textContent='Link two gears to display a provisional external-gear ratio.';
      ratios.append(p);
    }
    for(const ratio of analysis.ratios) {
      const card=document.createElement('div');card.className='reality-ratio-card';
      const label=document.createElement('strong');
      label.textContent=ratio.driver+' → '+ratio.follower;
      const stat=document.createElement('span');
      stat.textContent=ratio.driverTeeth+':'+ratio.followerTeeth+' teeth · ratio '+
        ratio.ratio+' · preview '+ratio.expectedRPM+' RPM · assigned '+ratio.assignedRPM+' RPM';
      const action=document.createElement('button');
      action.type='button';action.className='action secondary';
      action.textContent='Apply '+ratio.expectedRPM+' RPM';
      action.disabled=playing || Math.abs(ratio.expectedRPM)>120;
      action.title='Apply this suggested speed only. No gear train solver or mesh constraint is applied.';
      action.addEventListener('click',()=>{
        try {
          stop();
          doc=patchComponent(doc,ratio.to,{rpm:ratio.expectedRPM});
          changed('Assigned nominal follower RPM. This remains an independent visual motor setting.');
        } catch(error) { status(error.message); }
      });
      card.append(label,stat,action);ratios.append(card);
    }
    const findings=$('reality-findings');findings.replaceChildren();
    if(!analysis.findings.length) {
      const li=document.createElement('li');
      li.className='reality-clear';
      li.textContent='No heuristic findings at this rest pose. The design remains unverified.';
      findings.append(li);
    }
    for(const finding of analysis.findings) {
      const li=document.createElement('li');
      li.className='reality-finding '+(finding.severity==='caution'?'caution':'info');
      const label=document.createElement('span');
      label.className='reality-severity';
      label.textContent=finding.severity==='caution'?'CHECK':'INFO';
      const detail=document.createElement('div');
      const title=document.createElement('strong');title.textContent=finding.title;
      const desc=document.createElement('p');desc.textContent=finding.detail;
      detail.append(title,desc);
      li.append(label,detail);
      if(finding.ids.length>0){
        const jump=document.createElement('button');
        jump.type='button';jump.textContent='Select';
        jump.setAttribute('aria-label','Select component associated with '+finding.title);
        jump.addEventListener('click',()=>select(finding.ids[0]));
        li.append(jump);
      }
      findings.append(li);
    }
  }

  function render(){
    renderList();renderInspector();renderLinks();renderFrames();renderReality();
  }

  function setExplode(value) {
    const n=Number(value);
    const valueInt=Number.isFinite(n)?Math.round(Math.max(0,Math.min(100,n))):0;
    doc.explode=valueInt;
    save();onExplode(valueInt/100);
  }

  function playback(index) {
    if(!active||!playing){stop();return;}
    if(index>=doc.frames.length){stop();status('Animation complete. Last keyframe remains displayed.');return;}
    const current=doc.frames[index];
    doc=applyAssemblyFrame(doc,index);
    activeFrame=index;
    save();render();onChange(copy(doc));
    status('Playing assembly '+(index+1)+' / '+doc.frames.length+': '+current.label);
    timer=setTimeout(()=>playback(index+1),1450);
  }

  function download(blob,name){
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),5000);
  }

  panel.querySelectorAll('[data-snap]').forEach(button=>{
    button.addEventListener('click',()=>{
      if(!doc.selected || !$('reality-target').value)return;
      try {
        stop();
        const targetId=$('reality-target').value;
        const targetLabel=doc.parts.find(p=>p.id===targetId)?.name || targetId;
        doc=snapAssembly(doc,doc.selected,targetId,button.dataset.snap);
        changed('Snapped '+button.dataset.snap+' relative to '+targetLabel+'. Review the updated screening results.');
      } catch(error) { status('Snap refused: '+error.message); }
    });
  });
  $('reality-target').addEventListener('change',()=>{
    panel.querySelectorAll('[data-snap]').forEach(button=>{
      const current=requireSelected();
      const target=doc.parts.find(p=>p.id===$('reality-target').value);
      button.disabled=!current || !target ||
        (button.dataset.snap==='gear-pitch' && (current.type!=='gear'||target.type!=='gear'));
    });
  });

  panel.querySelectorAll('[data-shape]').forEach(button=>{
    button.addEventListener('click',()=>{
      stop();
      try{doc=newComponent(doc,button.dataset.shape);changed('Added '+button.dataset.shape+'.');}
      catch(error){status(error.message);}
    });
  });
  $('assembly-duplicate').addEventListener('click',()=>{
    const original=requireSelected();if(!original)return;
    try{
      stop();
      doc=newComponent(doc,original.type);
      const x=Math.max(-8,Math.min(8,original.position.x+0.48));
      doc=patchComponent(doc,doc.selected,{
        name:(original.name+' copy').slice(0,60),size:original.size,rpm:original.rpm,teeth:original.teeth,
        position:{...original.position,x},rotation:original.rotation
      });
      changed('Duplicated '+original.name+'.');
    }catch(error){status(error.message);}
  });
  $('assembly-delete').addEventListener('click',()=>{
    if(!doc.selected)return;
    stop();doc=removeComponent(doc,doc.selected);changed('Component removed.');
  });
  $('assembly-name').addEventListener('change',(event)=>{
    if(!doc.selected)return;
    try{stop();doc=patchComponent(doc,doc.selected,{name:event.target.value});changed('Part name updated.');}
    catch(error){renderInspector();status(error.message);}
  });
  panel.querySelectorAll('[data-assembly-field]').forEach(input=>{
    input.addEventListener('change',()=>{
      if(!doc.selected)return;
      const key=input.dataset.assemblyField;
      const num=Number(input.value);
      if(input.value.trim()===''||!Number.isFinite(num)){renderInspector();status('Enter a finite numeric value.');return;}
      const path=key.split('.');
      const patch=path.length===2?{[path[0]]:{[path[1]]:num}}:{[path[0]]:num};
      try{stop();doc=patchComponent(doc,doc.selected,patch);changed('Updated '+key+'.');}
      catch(error){renderInspector();status(error.message);}
    });
  });
  $('assembly-connect').addEventListener('click',()=>{
    try{stop();doc=connectComponents(doc,doc.selected,$('assembly-link-target').value);changed('Added visual connection.');}
    catch(error){status(error.message);}
  });
  $('assembly-capture').addEventListener('click',()=>{
    try{stop();doc=captureAssembly(doc,$('assembly-frame-label').value);
      $('assembly-frame-label').value='';changed('Captured assembly keyframe.',false);}
    catch(error){status(error.message);}
  });
  $('assembly-play').addEventListener('click',()=>{
    if(!doc.frames.length||playing)return;
    playing=true;playback(0);
  });
  $('assembly-stop').addEventListener('click',()=>{stop();status('Animation paused.');});
  $('assembly-clear-frames').addEventListener('click',()=>{
    stop();doc.frames=[];changed('Deleted keyframes. Current assembly preserved.',false);
  });
  $('assembly-export-json').addEventListener('click',()=>{
    try{download(new Blob([exportAssembly(doc)],{type:'application/json'}),'BioPhi369-Assembly-v03.json');
      status('Downloaded an editable assembly JSON document.');}
    catch(error){status(error.message);}
  });
  $('assembly-import').addEventListener('click',()=>$('assembly-import-file').click());
  $('assembly-import-file').addEventListener('change',async(event)=>{
    const file=event.target.files?.[0];event.target.value='';
    if(!file)return;
    if(file.size>MAX_FILE_BYTES){status('Import refused: exceeds 250 KB.');return;}
    try{const parsed=parseAssembly(await file.text());
      stop();doc=parsed;changed('Imported validated assembly. Existing local design replaced.');}
    catch(error){status('Import refused: '+error.message);}
  });
  $('assembly-export-glb').addEventListener('click',async()=>{
    const button=$('assembly-export-glb');
    button.disabled=true;button.textContent='Exporting…';
    try{const blob=await onExportGLB();
      download(blob,'BioPhi369-Assembly-v03.glb');
      status('Exported mesh rest pose as binary glTF/GLB. Validate scale and mechanics in your 3D editor.');}
    catch(error){status('GLB export failed: '+error.message);}
    finally{button.disabled=false;button.textContent='Export .GLB';}
  });

  load();render();
  return {
    getModel:()=>copy(doc),
    onSceneSelect:id=>select(id),
    setExplode,
    setActive(value) {
      active=Boolean(value);
      panel.hidden=!active;
      if(!active&&playing)stop();
    },
    stop
  };
}
