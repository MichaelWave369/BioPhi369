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
