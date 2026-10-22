import { normalizeCFDSettings, generateCFDPositions } from './cfdState.js';

// Procedural CFD visualizer; purely symbolic, not an anatomical reconstruction.
export function createCFDLayer(THREE, parent, trackGeometry, trackMaterial) {
  const fieldRoot = new THREE.Group();
  parent.add(fieldRoot);
  const fieldGeometry = trackGeometry(new THREE.BufferGeometry());
  const capacity = 2400;
  const buffer = new Float32Array(capacity * 3);
  fieldGeometry.setAttribute('position', new THREE.BufferAttribute(buffer, 3).setUsage(THREE.DynamicDrawUsage));
  fieldGeometry.setDrawRange(0, 1400);
  const fieldMaterial = trackMaterial(new THREE.PointsMaterial({
    color: '#83d8ce', size: .022, transparent: true, opacity: .68,
    depthWrite: false, sizeAttenuation: true
  }));
  const points = new THREE.Points(fieldGeometry, fieldMaterial);
  fieldRoot.add(points);

  const softwareRoot = new THREE.Group();
  parent.add(softwareRoot);
  const nodes = [];
  const coords = [
    [-1.03,.86,-.35], [.28,.95,.35], [-.65,-.25,.25],
    [.94,-.3,-.19], [0,-1.04,.3], [1.3,.7,-.3]
  ];
  const colors = ['#8dc8e7','#bda2ef','#77ddc9','#f4be81','#acddbb','#9dbfe7'];
  const cardGeometry = trackGeometry(new THREE.BoxGeometry(.67,.34,.15));
  const frameGeometry = trackGeometry(new THREE.BoxGeometry(.76,.44,.09));
  coords.forEach((coord,i) => {
    const node = new THREE.Group();
    const frame = new THREE.Mesh(frameGeometry, trackMaterial(new THREE.MeshBasicMaterial({
      color: colors[i], transparent: true, opacity: .2, wireframe: true, depthWrite: false
    })));
    const card = new THREE.Mesh(cardGeometry, trackMaterial(new THREE.MeshStandardMaterial({
      color: colors[i], emissive: colors[i], emissiveIntensity: .22,
      metalness: .17, roughness: .42, transparent: true, opacity: .84
    })));
    node.add(frame,card);
    node.position.set(...coord);
    softwareRoot.add(node);
    nodes.push({ node, base: new THREE.Vector3(...coord), index: i });
  });

  const softwareEdges = [[0,1],[0,2],[1,3],[2,3],[2,4],[3,4],[1,5],[5,3]];
  const linkPositions = new Float32Array(softwareEdges.length * 6);
  const linkGeometry = trackGeometry(new THREE.BufferGeometry());
  linkGeometry.setAttribute('position', new THREE.BufferAttribute(linkPositions, 3).setUsage(THREE.DynamicDrawUsage));
  const lineMaterial = trackMaterial(new THREE.LineBasicMaterial({
    color: '#a8d1da', transparent: true, opacity: .43, depthWrite: false
  }));
  softwareRoot.add(new THREE.LineSegments(linkGeometry,lineMaterial));

  let settings = normalizeCFDSettings();
  let explode = settings.explode / 100;
  const draft = new THREE.Vector3();

  function placeSoftware() {
    nodes.forEach(({ node, base, index }) => {
      draft.copy(base).normalize();
      node.position.copy(base).addScaledVector(draft, explode * .95);
      node.rotation.y = explode * Math.sin(index * .92) * .5;
      node.rotation.z = explode * Math.cos(index) * .24;
    });
    softwareEdges.forEach(([a,b],i) => {
      const from = nodes[a].node.position;
      const to = nodes[b].node.position;
      linkPositions.set([from.x,from.y,from.z,to.x,to.y,to.z],i*6);
    });
    linkGeometry.attributes.position.needsUpdate = true;
    linkGeometry.computeBoundingSphere();
  }

  function setSettings(next) {
    settings = normalizeCFDSettings(next);
    const coords = generateCFDPositions(settings);
    buffer.set(coords);
    fieldGeometry.setDrawRange(0,settings.density);
    fieldGeometry.attributes.position.needsUpdate = true;
    fieldGeometry.computeBoundingSphere();
    fieldRoot.scale.z = .8 + settings.depth / 145;
    fieldMaterial.opacity = settings.view === 'software' ? .37 : .64;
    softwareRoot.visible = settings.view === 'software';
    setExplode(settings.explode / 100);
  }
  function setExplode(value) {
    const num = Number(value);
    explode = Number.isFinite(num) ? Math.max(0,Math.min(1,num)) : 0;
    const k = 1 + explode * .48;
    fieldRoot.scale.set(k,k,.8+settings.depth / 145);
    placeSoftware();
  }
  function tick(delta,motion) {
    if (!motion) return;
    const rate = settings.spin / 100;
    fieldRoot.rotation.y += delta * (.03 + rate * .34);
    fieldRoot.rotation.z += delta * rate * .04;
    if (softwareRoot.visible) softwareRoot.rotation.y += delta * rate * .13;
  }

  setSettings(settings);
  return { setSettings, setExplode, tick };
}
