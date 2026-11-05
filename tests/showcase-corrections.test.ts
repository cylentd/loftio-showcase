import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEPTH_PROPS, EFFECTS, FOLIAGE } from '../src/effects-constants.ts';
import { cameraOffset, leafWeight, withinPolygon } from '../src/effects-model.ts';

test('desktop drag travels at least 60 horizontal and 30 vertical pixels without exposing edges', () => {
  const scale = Math.max(1500 / 1920, 920 / 1081) * EFFECTS.overscan;
  const offset = cameraOffset({ x: 1, y: 1 }, 1500, 920, scale);
  assert.ok(offset.x * scale >= 60);
  assert.ok(offset.y * scale >= 30);
  assert.ok(offset.x <= (1920 - 1500 / scale) / 2);
  assert.ok(offset.y <= (1081 - 920 / scale) / 2);
});

test('all six original leaf patches have at least six pixels of tip flex', () => {
  assert.ok(FOLIAGE.length >= 6);
  for (const patch of FOLIAGE) assert.ok(leafWeight(0.5, 0.5) * patch.strength >= 6);
});

test('lamp variation and dust have a visible contrast budget against the bright painting', () => {
  assert.ok(EFFECTS.glowBase * EFFECTS.glowSwing >= 0.15);
  assert.ok(EFFECTS.moteAlpha >= 0.5);
  assert.ok(EFFECTS.moteCount >= 28);
  assert.ok(EFFECTS.moteSize >= 5);
});

test('central lantern and terrarium cover a resident behind the table, but not one in front', () => {
  for (const point of [{ x: 1023, y: 675 }, { x: 937, y: 656 }, { x: 950, y: 740 }]) {
    const overlapping = DEPTH_PROPS.filter(prop => prop.polygons.some(polygon => withinPolygon(point, polygon)));
    assert.ok(overlapping.some(prop => prop.depth > 694));
    assert.ok(overlapping.every(prop => prop.depth < 895));
  }
  assert.ok(DEPTH_PROPS.every(prop => !prop.polygons.some(polygon => withinPolygon({ x: 1200, y: 675 }, polygon))));
});
