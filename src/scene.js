import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { regions, links } from './brainData.js';
import { createCFDLayer } from './cfdEngine.js';
import { createAssemblyScene } from './assemblyScene.js';
import { normalizeCFDSettings } from './cfdState.js';

export function createAtlas(viewport, onSelect, onSelectAssembly = () => {}) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(41, 1, 0.1, 70);
  camera.position.set(3.5, 2.1, 4.7);
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.8));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  viewport.appendChild(renderer.domElement);
  const orbit = new OrbitControls(camera, renderer.domElement);
  orbit.enableDamping = true;
  orbit.dampingFactor = 0.075;
  orbit.minDistance = 2.6;
  orbit.maxDistance = 10;
  orbit.target.set(0, -0.06, 0);
  orbit.update();

  scene.add(new THREE.AmbientLight('#c2eaff', 1.4));
  const key = new THREE.DirectionalLight('#c1e7fb', 2.4);
  key.position.set(2, 3, 4);
  scene.add(key);
  const fill = new THREE.PointLight('#74d3c3', 15, 12);
  fill.position.set(-3, 0.5, -2);
  scene.add(fill);

  const brain = new THREE.Group();
  const orbitals = new THREE.Group();
  const workshop = new THREE.Group();
  scene.add(brain, orbitals, workshop);

  const geometryResources = [];
  const materials = [];
  function trackGeometry(geometry) { geometryResources.push(geometry); return geometry; }
  function trackMaterial(material) { materials.push(material); return material; }
  function surfaceGeometry() {
    const geometry = trackGeometry(new THREE.SphereGeometry(1, 66, 48));
    const attr = geometry.attributes.position;
    for (let i = 0; i < attr.count; i += 1) {
      const x = attr.getX(i), y = attr.getY(i), z = attr.getZ(i);
      const w = 1 + 0.024 * Math.sin(20 * Math.atan2(z, x) + 3 * y) *
        Math.sin(15 * Math.acos(Math.max(-1, Math.min(1, y)))) + 0.012 * Math.sin(35 * y + 7 * x);
      attr.setXYZ(i, x * w, y * w, z * w);
    }
    geometry.computeVertexNormals();
    return geometry;
  }

  const shellGeometry = surfaceGeometry();
  const leftMaterial = trackMaterial(new THREE.MeshPhysicalMaterial({
    color: '#96b9d6', transparent: true, opacity: 0.18, roughness: 0.56,
    metalness: 0.06, depthWrite: false, side: THREE.DoubleSide
  }));
  const rightMaterial = leftMaterial.clone();
  trackMaterial(rightMaterial);
  rightMaterial.color.set('#b9a9dc');
  const shellData = [];
  for (const sign of [-1, 1]) {
    const shell = new THREE.Mesh(shellGeometry, sign < 0 ? leftMaterial : rightMaterial);
    shell.position.set(sign * 0.5, 0.19, 0);
    shell.scale.set(0.62, 0.72, 1.07);
    shell.renderOrder = 8;
    brain.add(shell);
    shellData.push({ shell, sign });
  }

  const markers = new Map();
  const targets = [];
  for (let i = 0; i < regions.length; i += 1) {
    const r = regions[i];
    const root = new THREE.Group();
    const material = trackMaterial(new THREE.MeshStandardMaterial({
      color: r.color, emissive: r.color, emissiveIntensity: 0.43,
      metalness: 0.15, roughness: 0.3, transparent: true, opacity: 0.96
    }));
    const sphere = new THREE.Mesh(trackGeometry(new THREE.IcosahedronGeometry(r.radius, 2)), material);
    sphere.userData.regionId = r.id;
    sphere.renderOrder = 2;
    root.add(sphere);
    const ringMaterial = trackMaterial(new THREE.MeshBasicMaterial({
      color: r.color, transparent: true, opacity: 0.29, depthWrite: false
    }));
    const ring = new THREE.Mesh(trackGeometry(new THREE.TorusGeometry(r.radius * 1.63, 0.009, 8, 48)), ringMaterial);
    ring.rotation.x = Math.PI * 0.28;
    root.add(ring);
    const needle = new THREE.Mesh(trackGeometry(new THREE.TorusGeometry(r.radius * 1.28, 0.005, 6, 36)), ringMaterial);
    needle.rotation.y = Math.PI / 2;
    root.add(needle);
    root.position.fromArray(r.position);
    brain.add(root);
    targets.push(sphere);
    markers.set(r.id, { root, sphere, ring, needle, material, ringMaterial, base: new THREE.Vector3(...r.position), index: i });
  }

  const linkGeometry = trackGeometry(new THREE.BufferGeometry());
  const linkBuffer = new Float32Array(links.length * 6);
  linkGeometry.setAttribute('position', new THREE.BufferAttribute(linkBuffer, 3).setUsage(THREE.DynamicDrawUsage));
  const linkMaterial = trackMaterial(new THREE.LineBasicMaterial({
    color: '#75b8bd', transparent: true, opacity: 0.22, depthWrite: false
  }));
  const linkLines = new THREE.LineSegments(linkGeometry, linkMaterial);
  brain.add(linkLines);

  const floorRingMaterial = trackMaterial(new THREE.MeshBasicMaterial({
    color: '#6b9aab', transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false
  }));
  for (let i = 0; i < 3; i += 1) {
    const ring = new THREE.Mesh(trackGeometry(new THREE.TorusGeometry(1.58 + i * 0.36, 0.004, 6, 128)), floorRingMaterial);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = -1.36;
    orbitals.add(ring);
  }
  const orbitRing = new THREE.Mesh(trackGeometry(new THREE.TorusGeometry(1.6, 0.006, 8, 132)), floorRingMaterial);
  orbitRing.rotation.set(0.35, 0.2, Math.PI / 3);
  orbitals.add(orbitRing);

  // Deterministically generated decorative stars (not observed neural events).
  const stars = new Float32Array(240 * 3);
  for (let i = 0; i < 240; i += 1) {
    const u = Math.sin(i * 127.1) * 43758.5453;
    const v = Math.sin(i * 311.7) * 23758.1234;
    const w = Math.sin(i * 419.2) * 12753.5678;
    stars[i * 3] = (u - Math.floor(u) - 0.5) * 11;
    stars[i * 3 + 1] = (v - Math.floor(v) - 0.5) * 7;
    stars[i * 3 + 2] = (w - Math.floor(w) - 0.5) * 9;
  }
  const starGeometry = trackGeometry(new THREE.BufferGeometry());
  starGeometry.setAttribute('position', new THREE.BufferAttribute(stars, 3));
  const starMaterial = trackMaterial(new THREE.PointsMaterial({
    color: '#afc9dc', size: 0.016, transparent: true, opacity: 0.53, depthWrite: false
  }));
  orbitals.add(new THREE.Points(starGeometry, starMaterial));

  // CFD is a metaphorical visual-spatial workspace, not a literal model of thought.
  const cageMaterial = trackMaterial(new THREE.MeshStandardMaterial({
    color: '#7fded2', emissive: '#31766e', emissiveIntensity: 0.5,
    transparent: true, opacity: 0.26, metalness: 0.35, roughness: 0.26, wireframe: true
  }));
  const coreMaterial = trackMaterial(new THREE.MeshStandardMaterial({
    color: '#e5d3a6', emissive: '#a7793b', emissiveIntensity: 0.55, metalness: 0.3, roughness: 0.25,
    transparent: true, opacity: 0.83
  }));
  const cfdBase = new THREE.Group();
  workshop.add(cfdBase);
  cfdBase.add(new THREE.Mesh(trackGeometry(new THREE.IcosahedronGeometry(0.48, 2)), cageMaterial));
  cfdBase.add(new THREE.Mesh(trackGeometry(new THREE.IcosahedronGeometry(0.22, 1)), coreMaterial));
  for (let i = 0; i < 3; i += 1) {
    const ringMaterial = trackMaterial(new THREE.MeshBasicMaterial({
      color: i === 0 ? '#77e7d6' : i === 1 ? '#a3bdf4' : '#e1b984',
      transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false
    }));
    const torus = new THREE.Mesh(trackGeometry(new THREE.TorusGeometry(0.9 + 0.14 * i, 0.012, 12, 96)), ringMaterial);
    torus.rotation.set(i * 0.7, i * 0.6, i * 0.9);
    cfdBase.add(torus);
  }
  const cfdParts = [];
  for (let i = 0; i < 8; i += 1) {
    const pivot = new THREE.Group();
    const box = new THREE.Mesh(trackGeometry(new THREE.BoxGeometry(0.29, 0.29, 0.29)), cageMaterial);
    box.rotation.set(i * 0.24, i * 0.38, i * 0.16);
    pivot.add(box);
    cfdBase.add(pivot);
    cfdParts.push(pivot);
  }
  workshop.visible = false;
  const assembly = createAssemblyScene(THREE, scene);
  const cfdLayer = createCFDLayer(THREE, workshop, trackGeometry, trackMaterial);
  let hemisphereView = 'both';
  let cfdSettings = normalizeCFDSettings();

  let selected = 'cortex';
  let mode = 'anatomy';
  let explode = 0;
  let motion = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let disposed = false;
  const clock = new THREE.Clock();
  const scratch = new THREE.Vector3();

  function layout() {
    shellData.forEach(({ shell, sign }) => {
      shell.position.x = sign * (0.5 + explode * 0.88);
      shell.position.y = 0.19;
      shell.material.opacity = (hemisphereView !== 'both' && (hemisphereView === 'left' ? sign > 0 : sign < 0)) ? 0.035 : (mode === 'analogy' ? 0.12 : 0.18);
    });
    markers.forEach(({ root, base, index }) => {
      const outward = scratch.copy(base);
      if (outward.length() < 0.18) outward.set(Math.cos(index * 1.7), Math.sin(index * 2.1), Math.cos(index));
      outward.normalize();
      root.position.copy(base).addScaledVector(outward, explode * 0.92);
    });
    links.forEach(([from, to], i) => {
      const a = markers.get(from).root.position, b = markers.get(to).root.position;
      linkBuffer.set([a.x, a.y, a.z, b.x, b.y, b.z], i * 6);
    });
    linkGeometry.attributes.position.needsUpdate = true;
    linkGeometry.computeBoundingSphere();
    cfdLayer.setExplode(explode);
    assembly.setExplode(explode);
    cfdParts.forEach((part, i) => {
      const angle = (i / cfdParts.length) * Math.PI * 2;
      const orbit = 0.75 + explode * 1.13;
      part.position.set(Math.cos(angle) * orbit, Math.sin(angle * 1.5) * (0.48 + explode * 0.6), Math.sin(angle) * orbit);
    });
  }

  function setSelected(id) {
    if (!markers.has(id)) return;
    selected = id;
    markers.forEach(({ sphere, ring, needle, material, ringMaterial }, key) => {
      const isActive = key === selected;
      sphere.scale.setScalar(isActive ? 1.3 : 1);
      ring.scale.setScalar(isActive ? 1.16 : 1);
      needle.scale.setScalar(isActive ? 1.15 : 1);
      material.emissiveIntensity = isActive ? 1.05 : 0.38;
      ringMaterial.opacity = isActive ? 0.82 : 0.3;
    });
  }

  function setMode(value) {
    if (!['anatomy', 'analogy', 'cfd', 'builder'].includes(value)) return;
    mode = value;
    brain.visible = mode === 'anatomy' || mode === 'analogy';
    workshop.visible = mode === 'cfd';
    assembly.root.visible = mode === 'builder';
    cfdBase.visible = cfdSettings.view === 'hardware';
    orbitRing.visible = mode !== 'cfd';
    layout();
  }

  function setExplode(value) {
    const next = Number(value);
    explode = Number.isFinite(next) ? Math.max(0, Math.min(1, next)) : 0;
    layout();
  }

  function setMotion(value) { motion = Boolean(value); }
  function setAssembly(model) { assembly.build(model); }
  function setAssemblySelection(id) { assembly.setSelected(id); }
  function exportAssemblyGLB() { return assembly.exportGLB(); }

  function setHemisphere(value) {
    hemisphereView = ['left','right','both'].includes(value) ? value : 'both';
    layout();
  }

  function setCFDSettings(input) {
    cfdSettings = normalizeCFDSettings(input);
    cfdLayer.setSettings(cfdSettings);
    cfdBase.visible = cfdSettings.view === 'hardware';
    setHemisphere(cfdSettings.hemisphere);
  }

  function reset() {
    camera.position.set(3.5, 2.1, 4.7);
    orbit.target.set(0, -0.06, 0);
    orbit.reset();
    orbit.update();
  }

  const ray = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let pointerDown = null;
  const canvas = renderer.domElement;
  function down(event) { pointerDown = { x: event.clientX, y: event.clientY }; }
  function up(event) {
    if (!pointerDown || mode === 'cfd' || Math.hypot(event.clientX - pointerDown.x, event.clientY - pointerDown.y) > 7) {
      pointerDown = null; return;
    }
    pointerDown = null;
    const box = canvas.getBoundingClientRect();
    if (box.width <= 0 || box.height <= 0) return;
    pointer.set((event.clientX - box.left) / box.width * 2 - 1, -(event.clientY - box.top) / box.height * 2 + 1);
    ray.setFromCamera(pointer, camera);
    if (mode === 'builder') {
      const id = assembly.pick(ray);
      if (id) onSelectAssembly(id);
      return;
    }
    const hit = ray.intersectObjects(targets, false)[0];
    if (hit?.object?.userData?.regionId) onSelect(hit.object.userData.regionId);
  }
  canvas.addEventListener('pointerdown', down);
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', () => { pointerDown = null; });

  function resize() {
    const width = Math.max(1, viewport.clientWidth), height = Math.max(1, viewport.clientHeight);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
  }
  const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
  if (observer) observer.observe(viewport);
  else window.addEventListener('resize', resize);
  resize();
  layout();
  setSelected(selected);

  function render() {
    if (disposed) return;
    const delta = Math.min(0.05, clock.getDelta());
    if (motion) {
      if (mode === 'builder') assembly.tick(delta, motion);
      if (mode === 'cfd') {
        cfdBase.rotation.y += delta * (0.03 + (cfdSettings.spin / 100) * 0.42);
        cfdBase.rotation.x += delta * (cfdSettings.spin / 100) * 0.08;
        cfdLayer.tick(delta, motion);
      } else {
        brain.rotation.y += delta * 0.11;
        orbitals.rotation.y -= delta * 0.013;
      }
      const elapsed = clock.elapsedTime;
      markers.forEach(({ ring, needle }, id) => {
        ring.rotation.z = elapsed * (id === selected ? 0.34 : 0.12);
        needle.rotation.y = elapsed * 0.17;
      });
    }
    orbit.update();
    renderer.render(scene, camera);
  }
  renderer.setAnimationLoop(render);

  function dispose() {
    disposed = true;
    renderer.setAnimationLoop(null);
    observer?.disconnect();
    if (!observer) window.removeEventListener('resize', resize);
    canvas.removeEventListener('pointerdown', down);
    canvas.removeEventListener('pointerup', up);
    orbit.dispose();
    assembly.dispose();
    geometryResources.forEach((resource) => resource.dispose());
    materials.forEach((material) => material.dispose());
    renderer.dispose();
    canvas.remove();
  }

  return { setSelected, setMode, setExplode, setMotion, setHemisphere, setCFDSettings, setAssembly, setAssemblySelection, exportAssemblyGLB, reset, dispose, get motion() { return motion; } };
}
