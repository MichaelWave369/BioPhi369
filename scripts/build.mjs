import { existsSync, mkdirSync, copyFileSync, cpSync, rmSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const expected = ['index.html', 'styles.css', 'src/app.js', 'src/scene.js', 'src/brainData.js', 'src/cfdState.js', 'src/cfdEngine.js', 'src/cfdUI.js', 'src/assemblyData.js', 'src/assemblyScene.js', 'src/assemblyUI.js', 'src/realityCheck.js', 'src/digitalTwin.js', 'src/digitalTwinUI.js', 'src/meshInspection.js', 'src/creativeBridge.js', 'src/creativeBridgePack.js', 'src/creativeBridgeUI.js'];
for (const path of expected) {
  if (!existsSync(path)) throw new Error('Missing required asset: ' + path);
}

const html = readFileSync('index.html', 'utf8');
for (const reference of ['./styles.css', './src/app.js', 'three@0.180.0']) {
  if (!html.includes(reference)) throw new Error('Missing HTML reference: ' + reference);
}
if (!html.includes('viewport') || !html.includes('region-list') || !html.includes('cfd-controls') || !html.includes('frame-list') || !html.includes('assembly-panel') || !html.includes('assembly-export-glb') || !html.includes('reality-panel') || !html.includes('reality-findings') || !html.includes('twin-panel') || !html.includes('twin-time') || !html.includes('twin-receipts') || !html.includes('bridge-panel') || !html.includes('bridge-export-pack')) {
  throw new Error('Missing required accessible UI mounting points.');
}

for (const path of ['src/app.js', 'src/scene.js', 'src/brainData.js', 'src/cfdState.js', 'src/cfdEngine.js', 'src/cfdUI.js', 'src/assemblyData.js', 'src/assemblyScene.js', 'src/assemblyUI.js', 'src/realityCheck.js', 'src/digitalTwin.js', 'src/digitalTwinUI.js', 'src/meshInspection.js', 'src/creativeBridge.js', 'src/creativeBridgePack.js', 'src/creativeBridgeUI.js']) {
  if (!readFileSync(path, 'utf8').trim()) throw new Error('Empty script: ' + path);
}

rmSync('dist', { recursive: true, force: true });
mkdirSync('dist/src', { recursive: true });
for (const path of ['index.html', 'styles.css']) copyFileSync(path, join('dist', path));
cpSync('src', 'dist/src', { recursive: true });
console.log('Static site built at dist/ (3D requires pinned CDN module access).');
