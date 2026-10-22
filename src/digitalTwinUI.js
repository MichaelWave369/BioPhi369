import { solvePreviewSpeeds, sampleMotion, makeRealityReceipt, MOTION_MAX_SECONDS } from './digitalTwin.js';
import { analyzeAssembly } from './realityCheck.js';

const LEDGER_KEY='biophi369.reality-ledger.v1';
const LIMIT=60;
const deepCopy=x=>JSON.parse(JSON.stringify(x));

// Local, consent-driven findings. No claims of empirical hardware validation.
// Renderer controls never rewrite stored assembly meshes, poses, or keyframes.
export function createDigitalTwinUI({getModel,onTimeline,onMeshScan}) {
  const $=id=>document.getElementById(id);
  const panel=$('twin-panel');
  let model=getModel(),mode='coupled',driverId=null,time=0,speed=1;
  let playing=false,lastTick=0,loopId=null,active=false,receipts=[];
  let analysis=null,preview=null,meshResult=null;
  const status=text=>{$('twin-motion-status').textContent=text;};
  const notify=text=>{$('twin-mesh-results').textContent=text;};
  const save=()=>{
    try{localStorage.setItem(LEDGER_KEY,JSON.stringify(receipts));return true;}
    catch {return false;}
  };
  const load=()=>{
    try{
      const input=JSON.parse(localStorage.getItem(LEDGER_KEY)||'[]');
      if(Array.isArray(input))receipts=input.slice(-LIMIT).filter(x=>x&&typeof x==='object'&&
        typeof x.recordedAt==='string'&&typeof x.model==='string'&&
        ['SIMULATED','INFERRED'].includes(x.provenance));
    }catch { receipts=[]; }
  };
  function motionOptions(){return {mode,driverId,time};}
  function updatePose(){onTimeline(motionOptions());}
  function renderTime(){
    $('twin-time').value=String(time);
    $('twin-time-value').textContent=time.toFixed(2)+' / 30.00 s';
    $('twin-speed-value').textContent=speed.toFixed(2)+'×';
  }
  function stop(){
    playing=false;
    if(loopId!==null)cancelAnimationFrame(loopId);
    loopId=null;
    $('twin-play').disabled=!active||!model.parts.length;
    $('twin-pause').disabled=true;
  }
  function loop(now){
    if(!playing||!active){stop();return;}
    const dt=Math.max(0,Math.min(.15,(now-lastTick)/1000));
    lastTick=now;
    time=Math.min(MOTION_MAX_SECONDS,Math.round((time+dt*speed)*100)/100);
    renderTime();updatePose();
    if(time>=MOTION_MAX_SECONDS){stop();return;}
    loopId=requestAnimationFrame(loop);
  }
  function renderDriver(){
    const select=$('twin-driver'),old=driverId;
    select.replaceChildren();
    const gears=model.parts.filter(p=>p.type==='gear');
    for(const part of gears){
      const option=document.createElement('option');
      option.value=part.id;option.textContent=part.name+' ('+part.rpm+' RPM)';
      select.append(option);
    }
    driverId=gears.some(p=>p.id===old)?old:(gears[0]?.id??null);
    select.value=driverId??'';
    select.disabled=gears.length===0;
  }
  function renderMotion(){
    analysis=analyzeAssembly(model);
    preview=solvePreviewSpeeds(model,{mode,driverId});
    const eligible=preview.constraints.length,refused=preview.rejected.length,loops=preview.contradictions.length;
    status((mode==='coupled'?'Coupled preview':'Independent RPM preview')+': '+eligible+
      ' eligible link(s), '+refused+' rejected, '+loops+' contradictory cycle(s). '+
      analysis.cautionCount+' caution(s) in Reality Check. No certified kinematics.');
    const list=$('twin-motion-findings');
    list.replaceChildren();
    function add(text,type='info'){
      const li=document.createElement('li');
      li.className=type;li.textContent=text;list.append(li);
    }
    if(mode==='coupled'){
      if(!eligible)add('No eligible linked gear pairs. Use nominal pitch snapping first, then inspect size, plane, tilt and tooth counts.');
      if(preview.driverId)add('Drive '+(model.parts.find(p=>p.id===preview.driverId)?.name||preview.driverId)+
        '. Linked preview RPMs: '+Object.entries(preview.speeds).filter(([id])=>model.parts.some(p=>p.id===id&&p.type==='gear'))
        .map(([id,rpm])=>(model.parts.find(p=>p.id===id)?.name||id)+' '+(Math.round(rpm*100)/100)+' RPM').join(' · '));
      for(const item of preview.rejected) add(item.from+' ↔ '+item.to+': '+item.messages.join(' '),'caution');
      for(const item of preview.contradictions) add(item.message,'caution');
    }else add('Each primitive uses its own user-assigned RPM. An annotation does not couple it to others.');
    add('Model assumptions: parallel Y-axis external gears, visual pitch approximation, no phase/tooth contact, no force or torque.');
    if(meshResult)add('Most recent mesh scan: '+meshResult.crossings.length+' surface crossing(s), '+
      meshResult.inconclusive.length+' inconclusive bounded pairs. Static rest pose only.');
  }
  function renderLedger(){
    const list=$('twin-receipts');list.replaceChildren();
    for(const item of receipts.slice().reverse()){
      const li=document.createElement('li');
      const title=document.createElement('strong');
      title.textContent=item.provenance+' · '+item.model+' · '+new Date(item.recordedAt).toLocaleString();
      const p=document.createElement('p');
      p.textContent='UNVERIFIED · '+(item.components??'?')+' components · '+
        (item.cautionCount??'?')+' heuristic cautions · '+(item.eligibleGearLinks??'?')+
        ' constrained-looking links · '+(item.rejectedLinks??'?')+' rejected';
      li.append(title,p);list.append(li);
    }
    if(!receipts.length){
      const li=document.createElement('li');li.textContent='No receipts yet. Record a model-derived snapshot to begin an auditable history.';list.append(li);
    }
  }
  function renderAll(){
    renderDriver();renderMotion();renderTime();renderLedger();
    updatePose();
  }
  function exportFile(content,name){
    const url=URL.createObjectURL(new Blob([content],{type:'application/json'}));
    const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),4000);
  }
  $('twin-mode').addEventListener('change',event=>{
    stop();mode=event.target.value;time=0;renderMotion();renderTime();updatePose();
  });
  $('twin-driver').addEventListener('change',event=>{
    stop();driverId=event.target.value;time=0;renderMotion();renderTime();updatePose();
  });
  $('twin-speed').addEventListener('input',event=>{
    speed=Math.min(2,Math.max(.25,Number(event.target.value)||1));renderTime();
  });
  $('twin-time').addEventListener('input',event=>{
    stop();time=Math.min(30,Math.max(0,Number(event.target.value)||0));renderTime();updatePose();
  });
  $('twin-play').addEventListener('click',()=>{
    if(playing||!active||!model.parts.length)return;
    if(time>=MOTION_MAX_SECONDS)time=0;
    playing=true;lastTick=performance.now();
    $('twin-play').disabled=true;$('twin-pause').disabled=false;
    loopId=requestAnimationFrame(loop);
  });
  $('twin-pause').addEventListener('click',stop);
  $('twin-reset').addEventListener('click',()=>{stop();time=0;renderTime();updatePose();});
  $('twin-mesh-scan').addEventListener('click',()=>{
    stop();
    try{
      const result=onMeshScan();
      meshResult=result;
      notify('Mesh surface scan at assembled rest pose: '+result.candidatePairs+' candidate broad-phase pairs, '+
        result.crossings.length+' detected surface crossing(s), '+result.inconclusive.length+
        ' inconclusive overlapping bounding-box pair(s), '+result.comparisons+' triangle tests.'+
        (result.budgetExhausted?' Budget exceeded: some pairs were untested.':'')+
        ' NOT a clearance certificate. '+result.disclaimer);
      renderMotion();
    }catch(err){notify('Mesh scan unavailable: '+err.message);}
  });
  $('twin-receipt').addEventListener('click',()=>{
    try{
      const receipt=makeRealityReceipt(model,{mode,driverId},analysis);
      if(meshResult)receipt.meshSurfaceScan={
        method:meshResult.method,crossings:meshResult.crossings.length,
        inconclusive:meshResult.inconclusive.length,budgetExhausted:meshResult.budgetExhausted
      };
      receipts.push(receipt);
      receipts=receipts.slice(-LIMIT);
      const saved=save();renderLedger();
      notify('Added a SIMULATED / UNVERIFIED receipt.'+(saved?' Saved in local browser storage.':' Browser storage unavailable: export receipts now.'));
    }catch(err){notify('Receipt failed: '+err.message);}
  });
  $('twin-export-ledger').addEventListener('click',()=>{
    exportFile(JSON.stringify({format:'BioPhi369-Reality-Ledger',version:1,receipts},null,2),
      'BioPhi369-reality-ledger-v05.json');
    notify('Exported local provenance receipts. No cloud upload was made.');
  });
  $('twin-clear-ledger').addEventListener('click',()=>{
    receipts=[];save();renderLedger();notify('Cleared browser-local receipts. Previously exported files remain unchanged.');
  });

  load();renderLedger();renderTime();
  return {
    setModel(value) {
      model=value;
      meshResult=null;stop();time=0;renderAll();
    },
    setActive(value) {
      active=Boolean(value);
      if(!active)stop();
      else {renderAll();$('twin-play').disabled=!model.parts.length;}
    },
    stop
  };
}
