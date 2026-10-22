import { validateAssembly, patchComponent } from './assemblyData.js';

// BIOPHI369 v0.4 - transparent geometry heuristics, NOT collision simulation.
// All lengths are arbitrary scene units. Only world-space center distances and
// conservative part proxies are used; no animated swept volume is considered.
const EPS = 1e-8;
const round = n => Math.round(n * 1000) / 1000;
const distance3 = (a,b) => Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
const distanceXZ = (a,b) => Math.hypot(a.x-b.x,a.z-b.z);
const tilt = p => Math.abs(p.rotation.x)>2 || Math.abs(p.rotation.z)>2;

// Rendered primitives are roughly: gear tooth tip radius=.62, ring outer=.625,
// shaft half-length=.7, cube half-diagonal=.587, bubble radius=.58.
// Conservative bounding spheres cannot establish actual collision or clearance.
export function proxyRadius(part) {
  const normalized = { gear:.64, ring:.64, shaft:.74, block:.59, bubble:.60 };
  if (!normalized[part.type]) throw Error('Unknown proxy');
  return normalized[part.type] * part.size;
}
export function nominalGearPitchDistance(a,b) {
  if (a.type !== 'gear' || b.type !== 'gear') throw Error('Pitch approximation requires two gears');
  return .56 * (a.size+b.size);
}
export function externalGearFollowerRPM(driver, follower) {
  if (driver.type !== 'gear' || follower.type !== 'gear') throw Error('Two gears are required');
  // External gears with locked parallel axes. This is a *ratio preview* only.
  return -(driver.rpm * driver.teeth) / follower.teeth;
}

function makeFinding(code, severity, ids, title, detail) {
  return { code, severity, ids, title, detail };
}
export function analyzeAssembly(input) {
  const doc = validateAssembly(input);
  const findings = [];
  const ratios = [];
  const byId = new Map(doc.parts.map(p=>[p.id,p]));
  const linked = new Set(doc.links.map(l=>[l.from,l.to].sort().join('|')));
  const linkedGearPairs = new Set();
  const key=(a,b)=>[a,b].sort().join('|');

  if (doc.parts.length === 0) {
    findings.push(makeFinding('empty', 'info', [], 'Empty assembly', 'Add components to run approximate spatial checks.'));
  }

  for (const link of doc.links) {
    const a=byId.get(link.from), b=byId.get(link.to);
    if (a.type==='gear' && b.type==='gear') {
      linkedGearPairs.add(key(a.id,b.id));
      const expected=externalGearFollowerRPM(a,b);
      const actual=b.rpm;
      const pitch=nominalGearPitchDistance(a,b);
      const planar=distanceXZ(a.position,b.position);
      const yOffset=Math.abs(a.position.y-b.position.y);
      ratios.push({
        from:a.id,to:b.id,driver:a.name,follower:b.name,
        driverTeeth:a.teeth,followerTeeth:b.teeth,
        ratio:round(a.teeth/b.teeth),expectedRPM:round(expected),assignedRPM:round(actual),
        pitchDistance:round(pitch),centerDistance:round(planar)
      });
      if (tilt(a)||tilt(b)) {
        findings.push(makeFinding('gear-tilt','caution',[a.id,b.id],'Gear axes may not be parallel',
          'One or both components are tilted on X/Z. Preview assumes parallel Y axes.'));
      }
      if (yOffset > Math.max(.09,.09*Math.min(a.size,b.size))) {
        findings.push(makeFinding('gear-plane','caution',[a.id,b.id],'Gear planes appear offset',
          'Y-axis offset '+round(yOffset)+' scene units. A linked visual annotation does not force shared planes.'));
      }
      if (Math.abs(planar-pitch) > Math.max(.11,pitch*.14)) {
        findings.push(makeFinding('gear-spacing','caution',[a.id,b.id],'Nominal gear-center spacing differs',
          'Observed '+round(planar)+' vs nominal ~'+round(pitch)+' scene units. Tooth geometry/module and actual meshing are NOT checked.'));
      }
      const toothDensityA=a.teeth/Math.max(a.size,EPS);
      const toothDensityB=b.teeth/Math.max(b.size,EPS);
      if (Math.abs(toothDensityA-toothDensityB)/Math.max(toothDensityA,toothDensityB)>.16) {
        findings.push(makeFinding('gear-scale','caution',[a.id,b.id],'Tooth count and visual scale may disagree',
          'The primitive sizes are independent of tooth count. A shared tooth module is not guaranteed.'));
      }
      if (Math.abs(a.rpm)>EPS && Math.abs(actual-expected)>Math.max(1,Math.abs(expected)*.05)) {
        findings.push(makeFinding('gear-rpm','caution',[a.id,b.id],'Assigned RPM differs from gear-ratio preview',
          a.name+' at '+a.rpm+' RPM with '+a.teeth+':'+b.teeth+' teeth suggests ~'+round(expected)+' RPM for '+b.name+', not '+actual+'.'));
      }
      if (a.rpm===0 && Math.abs(b.rpm)>EPS) {
        findings.push(makeFinding('gear-drive','info',[a.id,b.id],'Driven gear is stationary in this preview',
          'The declared link does not physically constrain either independent motor value.'));
      }
    } else {
      findings.push(makeFinding('visual-link','info',[a.id,b.id],'Visual link is not a joint',
        a.name+' ↔ '+b.name+' is an annotation; it does not hold components together.'));
    }
  }

  for (let i=0;i<doc.parts.length;i++) {
    for (let j=i+1;j<doc.parts.length;j++) {
      const a=doc.parts[i],b=doc.parts[j];
      const d=distance3(a.position,b.position);
      const threshold=proxyRadius(a)+proxyRadius(b);
      const bothGears=a.type==='gear' && b.type==='gear';
      if (bothGears) {
        // For linked gears, tooth flanks can overlap proxy spheres in a
        // real assembly, so only flag severe center convergence.
        if (d < .58*nominalGearPitchDistance(a,b)) {
          findings.push(makeFinding('deep-gear-overlap','caution',[a.id,b.id],
            'Gear centers appear substantially overlapped',
            'Center distance '+round(d)+' is much less than even a rough gear-pitch separation.'));
        }
      } else if (d < threshold*.9) {
        findings.push(makeFinding('proxy-overlap','caution',[a.id,b.id],
          'Potential bounding-envelope overlap',
          'Center distance '+round(d)+' vs conservative combined proxy radii '+round(threshold)+
          '. This screening may flag false positives; it does NOT prove an actual mesh collision.'));
      }
      if (bothGears && !linkedGearPairs.has(key(a.id,b.id)) && d < nominalGearPitchDistance(a,b)*1.18) {
        findings.push(makeFinding('gear-unlinked','info',[a.id,b.id],'Nearby gears lack a declared link',
          'These gears are nearby, but the application does not infer a drivetrain automatically.'));
      }
      if (linked.has(key(a.id,b.id)) && a.type==='gear' && b.type==='gear' &&
          Math.abs(a.position.y-b.position.y)<.12 && d>nominalGearPitchDistance(a,b)*2.5) {
        findings.push(makeFinding('gear-remote','info',[a.id,b.id],'Linked gear centers are distant',
          'Consider snapping into a nominal side-by-side layout before evaluating ratio previews.'));
      }
    }
  }
  return {
    model:'heuristic-v1',
    checkedParts:doc.parts.length,
    checkedPairs:doc.parts.length*(doc.parts.length-1)/2,
    cautionCount:findings.filter(x=>x.severity==='caution').length,
    findings,ratios,
    disclaimer:'Screening only: arbitrary units, fixed rest-pose center proxies, no rotated mesh intersections, contact, tolerances, swept-volume or physical performance verification.'
  };
}

export const SNAP_ACTIONS = ['x','y','z','beside','gear-pitch'];
export function snapAssembly(input, selectedId, targetId, action) {
  const doc=validateAssembly(input);
  const selected=doc.parts.find(p=>p.id===selectedId);
  const target=doc.parts.find(p=>p.id===targetId);
  if (!selected || !target || selected.id===target.id) throw Error('Select two different components.');
  if (!SNAP_ACTIONS.includes(action)) throw Error('Unknown snap action.');
  const position={...selected.position};
  const rotation={...selected.rotation};
  if (['x','y','z'].includes(action)) position[action]=target.position[action];
  if (action==='beside') {
    position.x=target.position.x+proxyRadius(selected)+proxyRadius(target)+.1;
    position.y=target.position.y;
    position.z=target.position.z;
  }
  if (action==='gear-pitch') {
    if (selected.type!=='gear'||target.type!=='gear') throw Error('Pitch snap needs two gears.');
    if (tilt(target)) throw Error('Reset target gear X/Z tilt before pitch snap.');
    position.x=target.position.x+nominalGearPitchDistance(selected,target);
    position.y=target.position.y;
    position.z=target.position.z;
    rotation.x=0;rotation.z=0;
  }
  for (const axis of ['x','y','z']) if (position[axis]<-8 || position[axis]>8)
    throw Error('Snap exceeds scene limits; move the target closer to the origin.');
  return patchComponent(doc,selectedId,{position,rotation});
}
