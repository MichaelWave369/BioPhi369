import {
  CFD_DEFAULTS, CFD_PRESETS, CFD_STORAGE_KEY, MAX_FRAMES, MAX_IMPORT_BYTES,
  normalizeCFDSettings, makeFrame, parseCFDRecording, encodeCFDRecording
} from './cfdState.js';

// Browser-only keyframe notebook. It stores user-entered settings locally,
// never records camera, audio, thoughts, or neural/biometric measurements.
export function createCFDUI({ onChange, onMode }) {
  const $ = (selector) => document.querySelector(selector);
  const panel = $('#cfd-controls');
  const sliders = ['density', 'twist', 'depth', 'spin'];
  const frameList = $('#frame-list');
  const status = $('#cfd-status');
  const playButton = $('#play-frames');
  const stopButton = $('#stop-frames');
  const clearButton = $('#clear-frames');
  const exportButton = $('#export-frames');
  const captureButton = $('#capture-frame');
  const importInput = $('#import-frames');
  const labelInput = $('#frame-label');
  let settings = { ...CFD_DEFAULTS };
  let frames = [];
  let timer = null;
  let activeFrame = -1;
  let playing = false;
  let isActive = false;
  let storageAvailable = false;

  const report = (text) => { status.textContent = text; };

  function save() {
    try {
      localStorage.setItem(CFD_STORAGE_KEY, encodeCFDRecording(frames));
      storageAvailable = true;
      return true;
    } catch (error) {
      storageAvailable = false;
      report('Browser storage is unavailable. Export your recording JSON to keep it.');
      return false;
    }
  }

  function load() {
    try {
      const value = localStorage.getItem(CFD_STORAGE_KEY);
      if (value) {
        const parsed = parseCFDRecording(JSON.parse(value));
        frames = parsed.frames;
        storageAvailable = true;
        report('Restored ' + frames.length + ' browser-saved keyframe(s).');
      } else storageAvailable = true;
    } catch (error) {
      frames = [];
      report('Saved recording could not be read; no old frames were imported.');
    }
  }

  function renderControls() {
    $('#cfd-view').value = settings.view;
    $('#cfd-pattern').value = settings.pattern;
    for (const key of sliders) {
      $('#cfd-' + key).value = String(settings[key]);
      $('#cfd-' + key + '-value').textContent = String(settings[key]);
    }
  }

  function setSettings(input, { notify = true } = {}) {
    settings = normalizeCFDSettings(input);
    renderControls();
    if (notify) onChange({ ...settings });
  }

  function sync(partial) {
    setSettings({ ...settings, ...partial }, { notify: false });
  }

  function stop() {
    if (timer !== null) clearTimeout(timer);
    timer = null;
    playing = false;
    activeFrame = -1;
    renderFrames();
  }

  function renderFrames() {
    frameList.replaceChildren();
    frames.forEach((frame, index) => {
      const item = document.createElement('li');
      item.className = 'frame-row' + (index === activeFrame ? ' playing' : '');
      const select = document.createElement('button');
      select.type = 'button';
      select.className = 'frame-select';
      select.textContent = String(index + 1).padStart(2, '0') + ' · ' + frame.label;
      const summary = document.createElement('small');
      summary.textContent = frame.settings.view + ' / ' + frame.settings.pattern + ' / ' +
        frame.settings.explode + '% separated';
      select.appendChild(summary);
      select.addEventListener('click', () => {
        stop();
        applyFrame(index);
        renderFrames();
      });
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'frame-delete';
      remove.textContent = '×';
      remove.setAttribute('aria-label', 'Delete frame ' + (index + 1) + ': ' + frame.label);
      remove.disabled = playing;
      remove.addEventListener('click', () => {
        stop();
        frames.splice(index, 1);
        save();
        renderFrames();
        report('Deleted keyframe ' + (index + 1) + '.');
      });
      item.append(select, remove);
      frameList.appendChild(item);
    });
    $('#frame-count').textContent = frames.length + ' / ' + MAX_FRAMES + ' FRAMES';
    playButton.disabled = frames.length === 0 || playing;
    stopButton.disabled = !playing;
    clearButton.disabled = frames.length === 0 || playing;
    exportButton.disabled = frames.length === 0;
    captureButton.disabled = frames.length >= MAX_FRAMES || playing;
  }

  function applyFrame(index) {
    const frame = frames[index];
    if (!frame) return;
    onMode();
    setSettings(frame.settings);
    activeFrame = index;
    report('Frame ' + (index + 1) + ' of ' + frames.length + ': ' + frame.label);
  }

  function step(index) {
    if (!playing || !isActive) { stop(); return; }
    if (index >= frames.length) {
      stop();
      report('Playback complete: visited ' + frames.length + ' keyframe(s).');
      return;
    }
    applyFrame(index);
    renderFrames();
    timer = setTimeout(() => step(index + 1), 1500);
  }

  function play() {
    if (playing || frames.length === 0) return;
    playing = true;
    step(0);
  }

  for (const [selector, key] of [['#cfd-view','view'], ['#cfd-pattern','pattern']]) {
    $(selector).addEventListener('change', (event) => { stop(); setSettings({ ...settings, [key]: event.target.value }); });
  }
  for (const key of sliders) {
    $('#cfd-' + key).addEventListener('input', (event) => {
      stop();
      setSettings({ ...settings, [key]: Number(event.target.value) });
    });
  }
  panel.querySelectorAll('[data-preset]').forEach((button) => {
    button.addEventListener('click', () => {
      const preset = CFD_PRESETS[button.dataset.preset];
      if (!preset) return;
      stop();
      setSettings(preset);
      report('Loaded preset: ' + button.dataset.preset + '.');
    });
  });
  captureButton.addEventListener('click', () => {
    if (frames.length >= MAX_FRAMES) {
      report('24 frames is the maximum. Export or delete frames first.');
      return;
    }
    stop();
    frames.push(makeFrame(settings, labelInput.value));
    labelInput.value = '';
    const saved = save();
    renderFrames();
    if (saved) report('Captured frame ' + frames.length + '. Stored locally in this browser.');
  });
  playButton.addEventListener('click', play);
  stopButton.addEventListener('click', () => { stop(); report('Playback stopped.'); });
  clearButton.addEventListener('click', () => {
    stop();
    frames = [];
    save();
    renderFrames();
    report('Cleared all local keyframes. Exported files are unaffected.');
  });
  exportButton.addEventListener('click', () => {
    try {
      const blob = new Blob([encodeCFDRecording(frames)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'BioPhi369-CFD-v02.json';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      report('Exported ' + frames.length + ' keyframe(s) as JSON.');
    } catch (error) {
      report('Could not export this file. Try again in a browser with downloads enabled.');
    }
  });
  $('#import-frames-button').addEventListener('click', () => importInput.click());
  importInput.addEventListener('change', async () => {
    const file = importInput.files?.[0];
    importInput.value = '';
    if (!file) return;
    if (file.size > MAX_IMPORT_BYTES) { report('Import rejected: file exceeds 100 KB.'); return; }
    try {
      const imported = parseCFDRecording(JSON.parse(await file.text()));
      stop();
      // Import intentionally replaces rather than silently combining recordings.
      frames = imported.frames;
      const saved = save();
      renderFrames();
      report('Imported ' + frames.length + ' validated keyframe(s).' + (!saved ? ' Export to preserve them.' : ''));
    } catch (error) {
      report('Import refused: ' + (error instanceof Error ? error.message : 'Invalid file'));
    }
  });

  load();
  renderControls();
  renderFrames();

  return {
    getSettings: () => ({ ...settings }),
    sync,
    setActive(value) {
      isActive = Boolean(value);
      panel.hidden = !isActive;
      if (!isActive && playing) stop();
    },
    stop
  };
}
