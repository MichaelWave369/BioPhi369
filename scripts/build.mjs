import { existsSync, mkdirSync, copyFileSync, cpSync, rmSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const expected = ['index.html', 'styles.css', 'src/app.js', 'src/scene.js', 'src/brainData.js'];
for (const path of expected) {
  if (!existsSync(path)) throw new Error('Missing required asset: ' + path);
}

const html = readFileSync('index.html', 'utf8');
for (const reference of ['./styles.css', './src/app.js', 'three@0.180.0']) {
  if (!html.includes(reference)) throw new Error('Missing HTML reference: ' + reference);
}
if (!html.includes('viewport') || !html.includes('region-list')) {
  throw new Error('Missing required accessible UI mounting points.');
}

for (const path of ['src/app.js', 'src/scene.js', 'src/brainData.js']) {
  if (!readFileSync(path, 'utf8').trim()) throw new Error('Empty script: ' + path);
}

rmSync('dist', { recursive: true, force: true });
mkdirSync('dist/src', { recursive: true });
for (const path of ['index.html', 'styles.css']) copyFileSync(path, join('dist', path));
cpSync('src', 'dist/src', { recursive: true });
console.log('Static site built at dist/ (3D requires pinned CDN module access).');
