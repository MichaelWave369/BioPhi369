import { regions, byId, modes } from './brainData.js';

const $ = (selector) => document.querySelector(selector);
const regionList = $('#region-list');
const fallback = $('#stage-fallback');
const modelModes = Array.from(document.querySelectorAll('[data-mode]'));
const explodeSlider = $('#explode');
const motionButton = $('#motion');
const resetButton = $('#reset');
const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');

const state = { selected: 'cortex', mode: 'anatomy', explode: 0, motion: !motionPreference.matches };
let atlas = null;

function setText(selector, value) {
  const target = $(selector);
  if (target) target.textContent = value;
}

function showRegion(id) {
  const region = byId[id];
  if (!region) return;
  state.selected = id;
  setText('#detail-name', region.name);
  setText('#detail-short', region.short);
  setText('#detail-category', region.category.toUpperCase());
  setText('#detail-description', region.description);
  setText('#detail-computer', region.computer);
  setText('#detail-analogy', region.analogy);
  setText('#detail-boundary', region.boundary);
  setText('#detail-count', String(regions.indexOf(region) + 1).padStart(2, '0') + ' / ' + regions.length);
  const icon = $('#detail-icon');
  if (icon) icon.style.color = region.color;
  regionList.querySelectorAll('button[data-region]').forEach((button) => {
    const active = button.dataset.region === id;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  atlas?.setSelected(id);
}

function showMode(mode) {
  if (!modes[mode]) return;
  state.mode = mode;
  modelModes.forEach((button) => {
    const active = button.dataset.mode === mode;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  setText('#mode-number', mode === 'anatomy' ? '01' : mode === 'analogy' ? '02' : '03');
  setText('#mode-heading', modes[mode].heading);
  setText('#mode-description', modes[mode].description);
  setText('#stage-mode', mode === 'cfd' ? 'CFD / MENTAL ROTATION' : mode === 'analogy' ? 'ANALOGY / METAPHOR' : 'ANATOMY / SCHEMATIC');
  atlas?.setMode(mode);
}

function setExplode(value) {
  const number = Number(value);
  state.explode = Number.isFinite(number) ? Math.max(0, Math.min(100, number)) : 0;
  explodeSlider.value = String(state.explode);
  setText('#explode-value', String(state.explode).padStart(2, '0') + '% EXPLODED');
  atlas?.setExplode(state.explode / 100);
}

function setMotion(value) {
  state.motion = Boolean(value);
  motionButton.textContent = state.motion ? 'Pause motion' : 'Resume motion';
  motionButton.setAttribute('aria-pressed', String(state.motion));
  atlas?.setMotion(state.motion);
}

function buildRegions() {
  const fragment = document.createDocumentFragment();
  for (const region of regions) {
    const button = document.createElement('button');
    button.className = 'region-button';
    button.type = 'button';
    button.dataset.region = region.id;
    button.style.setProperty('--region-color', region.color);
    const dot = document.createElement('span');
    dot.className = 'region-dot';
    dot.setAttribute('aria-hidden', 'true');
    const content = document.createElement('span');
    const title = document.createElement('strong');
    title.textContent = region.name;
    const subtitle = document.createElement('small');
    subtitle.textContent = region.short;
    content.append(title, subtitle);
    button.append(dot, content);
    button.addEventListener('click', () => showRegion(region.id));
    fragment.appendChild(button);
  }
  regionList.replaceChildren(fragment);
}

buildRegions();
showRegion(state.selected);
showMode(state.mode);
setExplode(0);
setMotion(state.motion);
motionButton.disabled = true;
resetButton.disabled = true;

modelModes.forEach((button) => button.addEventListener('click', () => showMode(button.dataset.mode)));
explodeSlider.addEventListener('input', (event) => setExplode(event.target.value));
motionButton.addEventListener('click', () => setMotion(!state.motion));
resetButton.addEventListener('click', () => { setExplode(0); atlas?.reset(); });

async function boot() {
  try {
    const module = await import('./scene.js');
    atlas = module.createAtlas($('#viewport'), showRegion);
    atlas.setSelected(state.selected);
    atlas.setMode(state.mode);
    atlas.setExplode(state.explode / 100);
    atlas.setMotion(state.motion);
    fallback.classList.add('hidden');
    motionButton.disabled = false;
    resetButton.disabled = false;
  } catch (error) {
    console.error('BioPhi369 3D unavailable:', error);
    fallback.textContent = '3D view unavailable in this browser or network. The anatomical explanations and computer comparisons remain usable.';
    fallback.classList.remove('hidden');
    setText('#stage-mode', 'TEXT MODE / 3D UNAVAILABLE');
  }
}
boot();
window.addEventListener('pagehide', () => atlas?.dispose(), { once: true });
