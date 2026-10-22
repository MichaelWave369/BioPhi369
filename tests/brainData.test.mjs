import test from 'node:test';
import assert from 'node:assert/strict';
import { regions, modes, links, byId } from '../src/brainData.js';

test('Ten unique named structures have valid positions, biology, analogies and boundaries', () => {
  assert.equal(regions.length, 10);
  const ids = new Set(regions.map((item) => item.id));
  assert.equal(ids.size, regions.length);
  for (const item of regions) {
    assert.match(item.id, /^[a-z]+$/);
    assert.ok(item.name.length >= 6);
    assert.ok(item.description.length >= 60);
    assert.ok(item.analogy.length >= 30);
    assert.ok(item.boundary.length >= 30);
    assert.equal(item.position.length, 3);
    assert.ok(item.position.every(Number.isFinite));
    assert.ok(item.radius > 0);
    assert.match(item.color, /^#[0-9a-f]{6}$/i);
    assert.equal(byId[item.id], item);
  }
});

test('Scientific firewall rejects left/right CPU/GPU and pineal-is-RAM myths', () => {
  assert.match(byId.cortex.boundary, /No hemisphere is exclusively/);
  assert.match(byId.pineal.description, /melatonin/i);
  assert.match(byId.pineal.boundary, /memory store/i);
  assert.match(byId.parietal.description, /working memory/i);
  assert.match(byId.visual.boundary, /no literal pixel buffer/i);
});

test('Conceptual mode inventory and all diagram links refer to valid objects', () => {
  assert.deepEqual(Object.keys(modes), ['anatomy', 'analogy', 'cfd']);
  for (const mode of Object.values(modes)) {
    assert.ok(mode.heading.length > 6);
    assert.ok(mode.description.length > 30);
  }
  for (const [left, right] of links) {
    assert.ok(byId[left], left);
    assert.ok(byId[right], right);
    assert.notEqual(left, right);
  }
});
