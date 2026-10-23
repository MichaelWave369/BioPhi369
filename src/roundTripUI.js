import {inspectRoundTrip,ROUNDTRIP_MAX_BYTES} from './roundTrip.js';

// Explicit two-phase import: inspect native file -> manually tick whitelisted
// transforms -> write verified rollback -> commit validated design.
export function createRoundTripUI({getModel,commitReview,hasBackup,restoreBackup}) {
  const $=id=>document.getElementById(id);
  const input=$('roundtrip-file'),results=$('roundtrip-diffs');
  const apply=$('roundtrip-apply'),restore=$('roundtrip-restore');
  let review=null,selected=new Set(),busy=false;
  const note=s=>$('roundtrip-status').textContent=s;
  function updateButtons(){
    apply.disabled=busy||!review||review.fatal||selected.size===0;
    restore.disabled=busy||!hasBackup();
    $('roundtrip-selection-count').textContent=selected.size+' component(s) selected';
  }
  function clear(){
    selected.clear();review=null;results.replaceChildren();
    $('roundtrip-summary').textContent='Load a locally saved Framefield Studio scene to preview changes. No file is applied automatically.';
    updateButtons();
  }
  function tag(node,text,className){
    const el=document.createElement(node);
    if(className)el.className=className;
    el.textContent=text;
    return el;
  }
  function render(){
    results.replaceChildren();
    if(!review){updateButtons();return;}
    $('roundtrip-summary').textContent=review.rows.length+' tagged objects matched · '+
      review.actionable+' editable component(s) differ · '+review.problems.length+
      ' unmapped/identity notice(s). No geometry or motion will be overwritten.';
    for(const issue of review.problems)results.append(tag('li','REVIEW: '+issue,'roundtrip-warning'));
    for(const row of review.rows){
      const li=document.createElement('li');
      li.className='roundtrip-row'+(row.blocked?' blocked':'');
      const header=document.createElement('div');header.className='roundtrip-row-head';
      const title=tag('strong',row.name+' · '+row.id);
      header.append(title);
      if(row.changes.length>0&&!row.blocked){
        const label=document.createElement('label');
        const check=document.createElement('input');check.type='checkbox';check.checked=selected.has(row.id);
        check.setAttribute('aria-label','Approve transform changes to '+row.id);
        check.addEventListener('change',()=>{
          if(check.checked)selected.add(row.id);else selected.delete(row.id);
          updateButtons();
        });
        label.append(check,tag('span','Approve these '+row.changes.length+' supported change(s)'));
        header.append(label);
      }else header.append(tag('span',row.blocked?'BLOCKED':'No supported change'));
      li.append(header);
      for(const change of row.changes){
        li.append(tag('p',change.field+': '+JSON.stringify(change.before)+' → '+JSON.stringify(change.after),'roundtrip-delta'));
      }
      for(const warning of row.warnings){
        li.append(tag('p','NOT IMPORTED: '+warning,'roundtrip-warning'));
      }
      results.append(li);
    }
    updateButtons();
  }
  $('roundtrip-open').addEventListener('click',()=>input.click());
  input.addEventListener('change',async()=>{
    const file=input.files?.[0];input.value='';
    if(!file)return;
    clear();
    if(file.size>ROUNDTRIP_MAX_BYTES){
      note('Return refused: Framefield file exceeds 3 MB.');return;
    }
    busy=true;updateButtons();
    try{
      const text=await file.text();
      // Re-read live assembly only after async file load completes.
      review=inspectRoundTrip(getModel(),text);
      render();
      note(review.fatal?'Duplicate identity found. Nothing can be applied.':
        'Preview ready. Tick each supported component change, then Apply. Other data remains untouched.');
    }catch(error){clear();note('Return refused: '+error.message);}
    finally{busy=false;updateButtons();}
  });
  apply.addEventListener('click',()=>{
    if(busy||!review||!selected.size||review.fatal)return;
    try{
      const count=selected.size;
      commitReview(review,[...selected]);
      clear();
      note('Committed '+count+' explicitly approved transform(s), with a verified local rollback. Nothing sent to Framefield.');
    }catch(error){
      note('Apply refused: '+error.message+' Reinspect the exported scene if BioPhi changed.');
      updateButtons();
    }
  });
  restore.addEventListener('click',()=>{
    if(busy)return;
    try {
      restoreBackup();clear();
      note('Restored the pre-round-trip BioPhi assembly from local backup.');
    }catch(error){note('Rollback refused: '+error.message);}
  });
  clear();note('No imported changes pending. Export a NEW v0.8-tagged Framefield scene before editing it.');
  return {resetPreview:clear};
}
