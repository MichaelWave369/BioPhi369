/**
 * BioPhi369 Acceptance Gauntlet v0.6
 *
 * Uses an isolated Chromium browser and the actual static build. No mock Three.js:
 * the atlas must initialize and 3D GLB export must produce a valid binary header.
 * Run by CI; install Playwright only within the ephemeral runner.
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const base = process.env.BIOPHI_BASE_URL || 'http://127.0.0.1:4173/';
const browser = await chromium.launch({ headless:true, args:['--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader'] });
const context = await browser.newContext({ viewport:{width:1440,height:900}, acceptDownloads:true, reducedMotion:'reduce' });
const page = await context.newPage();
const browserErrors = [];
page.on('pageerror',error=>browserErrors.push(error.message));
const checks = [];
const step=async (name,fn)=>{
  await fn();
  checks.push({name,result:'PASS'});
  console.log('PASS '+name);
};
async function waitText(locator,expression,ms=15000){
  await locator.waitFor({state:'visible',timeout:ms});
  const start=Date.now();
  let latest='';
  // Status messages can follow async browser file reads. Waiting merely for
  // a visible element races the update and produces false CI failures.
  while(Date.now()-start<ms){
    latest=(await locator.textContent())||'';
    if(expression.test(latest))return latest;
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  assert.match(latest,expression);
}
async function triggerRange(selector,value){
  await page.locator(selector).evaluate((input,next)=>{
    input.value=String(next);
    input.dispatchEvent(new Event('input',{bubbles:true}));
  },value);
}
try {
  await step('Home loads and initializes a real WebGL atlas',async()=>{
    await page.goto(base,{waitUntil:'domcontentloaded'});
    await page.locator('#stage-fallback').waitFor({state:'hidden',timeout:30000});
    assert.equal(await page.locator('#viewport canvas').count(),1);
    assert.match(await page.title(),/BioPhi369/);
  });

  await step('All four modes preserve navigation and content',async()=>{
    for(const mode of ['anatomy','analogy','cfd','builder']){
      await page.locator('[data-mode="'+mode+'"]').click();
      assert.equal(await page.locator('[data-mode="'+mode+'"]').getAttribute('aria-pressed'),'true');
      await page.locator('#viewport canvas').waitFor();
    }
    assert.equal(await page.locator('#assembly-panel').isVisible(),true);
    assert.equal(await page.locator('#twin-panel').isVisible(),true);
    assert.equal(await page.locator('.assembly-part').count(),2);
  });

  await step('Invalid import fails without replacing stored design',async()=>{
    const invalid={name:'poison.json',mimeType:'application/json',buffer:Buffer.from('{"format":"BioPhi369-Assembly","version":1,"parts":[{"id":"not-valid"}]}')};
    await page.locator('#assembly-import-file').setInputFiles(invalid);
    await waitText(page.locator('#assembly-status'),/Import refused:/);
    assert.equal(await page.locator('.assembly-part').count(),2);
  });

  await step('Aligning actual gear scene makes one link eligible for a preview',async()=>{
    await page.locator('.assembly-part').filter({hasText:'Follower gear'}).click();
    const size=page.locator('[data-assembly-field="size"]');
    await size.fill('0.8');
    await size.press('Tab');
    await page.locator('#reality-target').selectOption('part-1');
    await page.locator('[data-snap="gear-pitch"]').click();
    await waitText(page.locator('#assembly-status'),/Snapped gear-pitch/);
    const twin=page.locator('#twin-motion-status');
    await waitText(twin,/1 eligible link\(s\)/);
    assert.match((await page.locator('#twin-motion-findings').textContent())||'',/Drive|RPM/);
  });

  await step('Scrubbing is deterministic, bounded and does not edit component inputs',async()=>{
    const size=await page.locator('[data-assembly-field="size"]').inputValue();
    await triggerRange('#twin-time',5);
    await waitText(page.locator('#twin-time-value'),/5\.00 \/ 30\.00 s/);
    await triggerRange('#twin-time',30);
    await waitText(page.locator('#twin-time-value'),/30\.00 \/ 30\.00 s/);
    await page.locator('#twin-reset').click();
    await waitText(page.locator('#twin-time-value'),/0\.00 \/ 30\.00 s/);
    assert.equal(await page.locator('[data-assembly-field="size"]').inputValue(),size);
  });

  await step('Timeline playback advances and pause retains a stopped time',async()=>{
    await page.locator('#twin-play').click();
    await page.waitForTimeout(600);
    await page.locator('#twin-pause').click();
    const label=await page.locator('#twin-time-value').textContent();
    const seconds=Number(label?.split(' ')[0]);
    assert.ok(seconds>0&&seconds<30,'Expected bounded timeline movement; observed '+label);
  });

  await step('Static mesh check reports scope and uncertainty',async()=>{
    await page.locator('#twin-mesh-scan').click();
    await waitText(page.locator('#twin-mesh-results'),/candidate broad-phase pairs/i,45000);
    assert.match((await page.locator('#twin-mesh-results').textContent())||'',/NOT a clearance certificate/);
  });

  await step('SIMULATED reality receipt writes and clears locally',async()=>{
    await page.locator('#twin-receipt').click();
    await waitText(page.locator('#twin-receipts'),/SIMULATED.*UNVERIFIED/s);
    const download=page.waitForEvent('download');
    await page.locator('#twin-export-ledger').click();
    const file=await download;
    assert.match(file.suggestedFilename(),/reality-ledger.*\.json$/);
    const parsed=JSON.parse(await readFile(await file.path(),'utf8'));
    assert.equal(parsed.format,'BioPhi369-Reality-Ledger');
    assert.equal(parsed.receipts.at(-1).provenance,'SIMULATED');
    assert.equal(parsed.receipts.at(-1).status,'UNVERIFIED');
    await page.locator('#twin-clear-ledger').click();
    await waitText(page.locator('#twin-receipts'),/No receipts yet/);
  });

  await step('Portable assembly JSON retains valid schema',async()=>{
    const download=page.waitForEvent('download');
    await page.locator('#assembly-export-json').click();
    const file=await download;
    const parsed=JSON.parse(await readFile(await file.path(),'utf8'));
    assert.equal(parsed.version,1);
    assert.equal(parsed.format,'BioPhi369-Assembly');
    assert.equal(parsed.parts.length,2);
  });

  await step('GLB exporter downloads a valid glTF binary header',async()=>{
    const download=page.waitForEvent('download',{timeout:45000});
    await page.locator('#assembly-export-glb').click();
    const file=await download;
    const bytes=await readFile(await file.path());
    assert.equal(bytes.subarray(0,4).toString('utf8'),'glTF');
    assert.equal(bytes.readUInt32LE(4),2);
    assert.ok(bytes.length>20);
  });

  await step('Native Framefield Studio export contains editable 24fps animation',async()=>{
    assert.match(await page.locator('#bridge-open-framefield').getAttribute('href'),/FramefieldStudio\/$/);
    const promise=page.waitForEvent('download');
    await page.locator('#bridge-export-framefield').click();
    const file=await promise;
    assert.match(file.suggestedFilename(),/Framefield.*\.json$/);
    const data=JSON.parse(await readFile(await file.path(),'utf8'));
    assert.equal(data.version,1);
    assert.equal(data.fps,24);
    assert.equal(data.duration,240);
    assert.equal(data.objects.length,2);
    assert.ok(data.objects[0].geometry.vertices.length>4);
    assert.equal(data.objects[0].keyframes.length,241);
    if(process.env.BIOPHI_TEST_TARGETS==='1'){
      const {validateProject}=await import('../.external/framefield/src/scene.js');
      const imported=validateProject(data);
      assert.equal(imported.objects.length,2);
      assert.equal(imported.objects[0].keyframes.length,241);
      assert.ok(imported.objects[0].geometry.faces.length>100);
      console.log('PASS Actual Framefield Studio native validateProject importer');
    }
  });

  await step('PixelForge-specific GLB export is a valid static glTF binary',async()=>{
    assert.match(await page.locator('#bridge-open-pixelforge').getAttribute('href'),/parallax-pixelforge\/vr-studio\/$/);
    const promise=page.waitForEvent('download');
    await page.locator('#bridge-export-pixelforge').click();
    const file=await promise;
    const bytes=await readFile(await file.path());
    assert.equal(bytes.subarray(0,4).toString(),'glTF');
    assert.equal(bytes.readUInt32LE(4),2);
    if(process.env.BIOPHI_TEST_TARGETS==='1'){
      const {decodeGlbMesh}=await import('../.external/pixelforge/vr-studio/glb-mesh.js');
      const binary=bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);
      const result=decodeGlbMesh(binary);
      assert.ok(result.meshCount>=1);
      assert.equal(result.status,'STATIC_GEOMETRY_PREVIEW_ONLY');
      console.log('PASS Actual PixelForge VR Studio static GLB decoder');
    }
  });

  await step('Bridge ZIP contains manifest, scene, GLB, source and SHA-256 receipts',async()=>{
    const promise=page.waitForEvent('download');
    await page.locator('#bridge-export-pack').click();
    const file=await promise;
    assert.match(file.suggestedFilename(),/Creative-Bridge.*\.zip$/);
    const bytes=await readFile(await file.path());
    assert.equal(bytes.readUInt32LE(0),0x04034b50);
    const entries=new Map();let offset=0;
    while(offset+30<=bytes.length && bytes.readUInt32LE(offset)===0x04034b50){
      const size=bytes.readUInt32LE(offset+18);
      const nameBytes=bytes.readUInt16LE(offset+26);
      const extra=bytes.readUInt16LE(offset+28);
      const name=bytes.subarray(offset+30,offset+30+nameBytes).toString('utf8');
      const start=offset+30+nameBytes+extra;
      entries.set(name,bytes.subarray(start,start+size));
      offset=start+size;
    }
    assert.deepEqual([...entries.keys()],[
      'manifest.json','biophi.assembly.json','framefield.scene.json',
      'motion-handoff.json','pixelforge.model.glb','README.txt'
    ]);
    const manifest=JSON.parse(entries.get('manifest.json').toString('utf8'));
    assert.equal(manifest.provenance,'SIMULATED');
    assert.equal(manifest.noSafetyCertification,true);
    for(const receipt of manifest.files){
      const {createHash}=await import('node:crypto');
      const data=entries.get(receipt.name);
      assert.equal(data.length,receipt.bytes);
      assert.equal(createHash('sha256').update(data).digest('hex'),receipt.sha256);
    }
    assert.equal(entries.get('pixelforge.model.glb').subarray(0,4).toString(),'glTF');
    assert.equal(JSON.parse(entries.get('framefield.scene.json').toString()).fps,24);
    assert.equal(JSON.parse(entries.get('biophi.assembly.json').toString()).format,'BioPhi369-Assembly');
  });

  await step('Returned Framefield JSON previews changes without mutating BioPhi',async()=>{
    const promise=page.waitForEvent('download');
    await page.locator('#bridge-export-framefield').click();
    const download=await promise;
    const scene=JSON.parse(await readFile(await download.path(),'utf8'));
    assert.match(scene.objects[0].name,/^\\[BP369:part-1\\]/);
    // Mimic Framefield Studio recreating UUIDs, retaining the name tag.
    scene.objects.forEach((obj,index)=>obj.id='generated-in-framefield-'+index);
    const rest=scene.objects[0].keyframes.find(k=>k.frame===0);
    rest.position[0]=1.25;
    scene.objects[0].name='[BP369:part-1] Edited drive';
    const typed=Buffer.from(JSON.stringify(scene));
    await page.locator('#roundtrip-file').setInputFiles({name:'edited.framefield.json',mimeType:'application/json',buffer:typed});
    await waitText(page.locator('#roundtrip-summary'),/2 tagged objects matched.*1 editable component/);
    assert.equal(await page.locator('#roundtrip-apply').isDisabled(),true);
    await page.locator('.assembly-part').filter({hasText:'Drive gear'}).click();
    assert.notEqual(await page.locator('[data-assembly-field="position.x"]').inputValue(),'1.25');
    assert.equal(await page.locator('#roundtrip-diffs input[type="checkbox"]').count(),1);
    await page.locator('#roundtrip-diffs input[type="checkbox"]').check();
    assert.equal(await page.locator('#roundtrip-apply').isDisabled(),false);
  });

  await step('Approved Framefield changes apply selectively and rollback restores original',async()=>{
    const originalX=await page.locator('[data-assembly-field="position.x"]').inputValue();
    await page.locator('#roundtrip-apply').click();
    await waitText(page.locator('#roundtrip-status'),/Committed 1 explicitly approved/);
    assert.equal(await page.locator('[data-assembly-field="position.x"]').inputValue(),'1.25');
    assert.equal(await page.locator('#roundtrip-restore').isDisabled(),false);
    await page.locator('#roundtrip-restore').click();
    await waitText(page.locator('#roundtrip-status'),/Restored the pre-round-trip/);
    assert.equal(await page.locator('[data-assembly-field="position.x"]').inputValue(),originalX);
  });

  await step('Untagged legacy Framefield scenes cannot auto-apply edits',async()=>{
    const promise=page.waitForEvent('download');
    await page.locator('#bridge-export-framefield').click();
    const download=await promise;
    const scene=JSON.parse(await readFile(await download.path(),'utf8'));
    scene.objects[0].name='Drive gear';
    scene.objects[0].keyframes[0].position[0]=2;
    const typed=Buffer.from(JSON.stringify(scene));
    await page.locator('#roundtrip-file').setInputFiles({name:'legacy.json',mimeType:'application/json',buffer:typed});
    await waitText(page.locator('#roundtrip-summary'),/unmapped\/identity notice/);
    assert.equal(await page.locator('#roundtrip-apply').isDisabled(),true);
    assert.notEqual(await page.locator('[data-assembly-field="position.x"]').inputValue(),'2');
  });

  await step('Narrow viewport has no page-level horizontal overflow',async()=>{
    await page.setViewportSize({width:390,height:844});
    await page.waitForTimeout(100);
    const widths=await page.evaluate(()=>({viewport:innerWidth,document:document.documentElement.scrollWidth}));
    if(widths.document>widths.viewport+3){
      const offenders=await page.evaluate(()=>{
        return [...document.querySelectorAll('body *')]
          .map(el=>({selector:el.tagName.toLowerCase()+(el.id?'#'+el.id:'')+
              (typeof el.className==='string'&&el.className?'.'+el.className.trim().split(/\\s+/).join('.'):''),
            left:Math.round(el.getBoundingClientRect().left),
            right:Math.round(el.getBoundingClientRect().right)}))
          .filter(item=>item.right>innerWidth+4&&item.left>=0)
          .sort((a,b)=>b.right-a.right).slice(0,12);
      });
      console.error('Mobile horizontal overflow elements:',JSON.stringify(offenders));
    }
    assert.ok(widths.document<=widths.viewport+3,JSON.stringify(widths));
  });

  await step('Anatomy and CFD remain reachable after engineering inspection',async()=>{
    await page.locator('[data-mode="cfd"]').click();
    assert.equal(await page.locator('#cfd-controls').isVisible(),true);
    await page.locator('[data-mode="anatomy"]').click();
    assert.equal(await page.locator('#assembly-panel').isVisible(),false);
    assert.equal(await page.locator('#region-list').isVisible(),true);
  });

  await step('Browser reports no uncaught JavaScript exceptions',async()=>{
    assert.deepEqual(browserErrors,[]);
  });

  console.log(JSON.stringify({status:'PASS',checks,base},null,2));
} catch(error){
  console.error('FAIL BIOPHI369 ACCEPTANCE GAUNTLET: '+(error.stack||error.message));
  console.error(JSON.stringify({checks,browserErrors},null,2));
  await page.screenshot({path:'browser-acceptance-failure.png',fullPage:true}).catch(()=>{});
  process.exitCode=1;
} finally {
  await browser.close();
}
