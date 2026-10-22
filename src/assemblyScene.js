import { validateAssembly } from './assemblyData.js';

// Visual kinematics, not validated mechanics. No collision, torque, materials,
// load, inertia, tooth-contact geometry or engineering safety predictions.
export function createAssemblyScene(THREE, scene) {
  const root = new THREE.Group();
  root.visible = false;
  scene.add(root);
  let model = null, selected = null, explode = 0, elapsed = 0;
  const objects = new Map(), selectable = [];
  let linksObject = null;

  function gearGeometry(teeth) {
    const shape = new THREE.Shape();
    const steps = teeth * 4;
    for (let i = 0; i < steps; i++) {
      const angle = (i / steps) * Math.PI * 2;
      const radius = i % 4 < 2 ? .51 : .62;
      const x = Math.cos(angle) * radius, y = Math.sin(angle) * radius;
      if (i === 0) shape.moveTo(x,y); else shape.lineTo(x,y);
    }
    shape.closePath();
    const hole = new THREE.Path();
    hole.absarc(0,0,.13,0,Math.PI*2,true);
    shape.holes.push(hole);
    const geo = new THREE.ExtrudeGeometry(shape,{depth:.2,steps:1,bevelEnabled:false,curveSegments:30});
    geo.translate(0,0,-.1);
    geo.rotateX(-Math.PI/2);
    geo.computeVertexNormals();
    return geo;
  }
  function geometryFor(part) {
    if (part.type==='gear') return gearGeometry(part.teeth);
    if (part.type==='ring') return new THREE.TorusGeometry(.52,.105,12,80).rotateX(Math.PI/2);
    if (part.type==='shaft') return new THREE.CylinderGeometry(.15,.15,1.4,24);
    if (part.type==='bubble') return new THREE.SphereGeometry(.58,28,18);
    return new THREE.BoxGeometry(.8,.55,.65);
  }
  const colors = {gear:'#e6bf81',ring:'#8cb5f0',shaft:'#93dfc7',block:'#b7a9ed',bubble:'#83cadd'};

  function clear() {
    for (const {mesh} of objects.values()) {
      mesh.geometry.dispose();
      mesh.material.dispose();
    }
    if (linksObject) { linksObject.geometry.dispose(); linksObject.material.dispose(); }
    objects.clear();
    selectable.length = 0;
    linksObject = null;
    while (root.children.length) root.remove(root.children[0]);
  }

  function build(doc) {
    model = validateAssembly(doc);
    selected = model.selected;
    explode = model.explode / 100;
    elapsed = 0;
    clear();
    model.parts.forEach((part,index) => {
      const holder = new THREE.Group();
      holder.name = part.name;
      holder.userData.partId = part.id;
      const mat = new THREE.MeshStandardMaterial({
        color:colors[part.type],metalness:.19,roughness:.42,
        transparent:true,opacity:part.type==='bubble'?.46:.94,
        wireframe:part.type==='bubble'
      });
      const mesh = new THREE.Mesh(geometryFor(part),mat);
      mesh.userData.partId = part.id;
      mesh.name = part.name;
      holder.add(mesh);
      root.add(holder);
      selectable.push(mesh);
      objects.set(part.id,{holder,mesh,index,part});
    });
    const lineBuffer = new Float32Array(model.links.length*6);
    const lineGeometry = new THREE.BufferGeometry();
    lineGeometry.setAttribute('position',new THREE.BufferAttribute(lineBuffer,3).setUsage(THREE.DynamicDrawUsage));
    const lineMaterial = new THREE.LineBasicMaterial({color:'#80dbc6',transparent:true,opacity:.6});
    linksObject = new THREE.LineSegments(lineGeometry,lineMaterial);
    root.add(linksObject);
    layout();
    setSelected(selected);
  }

  function layout() {
    if (!model) return;
    model.parts.forEach((part,index) => {
      const entry = objects.get(part.id);
      if (!entry) return;
      const base = new THREE.Vector3(part.position.x,part.position.y,part.position.z);
      const direction = base.clone();
      if (direction.length()<0.15) direction.set(Math.cos(index*2.4),.35*Math.sin(index+1),Math.sin(index*2.4));
      direction.normalize();
      base.addScaledVector(direction,explode*1.8);
      entry.holder.position.copy(base);
      entry.holder.rotation.set(
        THREE.MathUtils.degToRad(part.rotation.x),
        THREE.MathUtils.degToRad(part.rotation.y)+elapsed*part.rpm*Math.PI*2/60,
        THREE.MathUtils.degToRad(part.rotation.z)
      );
      entry.holder.scale.setScalar(part.size);
    });
    if (linksObject) {
      const attribute = linksObject.geometry.attributes.position;
      model.links.forEach((link,index)=>{
        const a=objects.get(link.from)?.holder.position,b=objects.get(link.to)?.holder.position;
        if (!a||!b) return;
        attribute.setXYZ(index*2,a.x,a.y,a.z);
        attribute.setXYZ(index*2+1,b.x,b.y,b.z);
      });
      attribute.needsUpdate=true;
      linksObject.geometry.computeBoundingSphere();
    }
  }

  function setSelected(id) {
    selected = objects.has(id)?id:null;
    objects.forEach(({mesh},key)=>{
      mesh.material.emissive = new THREE.Color(key===selected?'#376f68':'#080f19');
      mesh.material.emissiveIntensity=key===selected?.48:.12;
    });
  }
  function setExplode(value) {
    explode=Number.isFinite(Number(value))?Math.max(0,Math.min(1,Number(value))):0;
    layout();
  }
  function tick(delta,motion) {
    if (!model||!root.visible||!motion) return;
    elapsed += Math.min(.05,Math.max(0,delta));
    // This is independent spin per part, not an engaged-gear solver.
    layout();
  }
  function pick(raycaster) {
    const result=raycaster.intersectObjects(selectable,false)[0];
    return result?.object?.userData?.partId??null;
  }
  function exportRoot() {
    const group = new THREE.Group();
    group.name='BioPhi369_Assembly_v0_3';
    if (!model) return group;
    for (const part of model.parts) {
      const current=objects.get(part.id);
      if (!current)continue;
      const entry=new THREE.Mesh(current.mesh.geometry,current.mesh.material);
      entry.name=part.name||part.id;
      entry.position.set(part.position.x,part.position.y,part.position.z);
      entry.rotation.set(
        THREE.MathUtils.degToRad(part.rotation.x),
        THREE.MathUtils.degToRad(part.rotation.y),
        THREE.MathUtils.degToRad(part.rotation.z)
      );
      entry.scale.setScalar(part.size);
      group.add(entry);
    }
    return group;
  }
  async function exportGLB() {
    if (!model?.parts.length)throw Error('Add a component before exporting a GLB.');
    const { GLTFExporter } = await import('three/addons/exporters/GLTFExporter.js');
    const exporter = new GLTFExporter();
    const binary = await exporter.parseAsync(exportRoot(), {binary:true,onlyVisible:true});
    if (!(binary instanceof ArrayBuffer)) throw Error('Binary GLB export failed.');
    return new Blob([binary],{type:'model/gltf-binary'});
  }
  function dispose() { clear(); root.removeFromParent(); }

  return { root, build, setSelected, setExplode, tick, pick, exportGLB, dispose };
}
