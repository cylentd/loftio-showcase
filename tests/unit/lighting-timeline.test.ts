import assert from "node:assert/strict";
import { test } from "node:test";
import { LightingTimeline } from "../../src/lighting-timeline.ts";
import { SceneSettings } from "../../src/scene-settings.ts";

test("Still freezes the cycle without catching up when movement resumes", () => {
  const timeline = new LightingTimeline();
  timeline.update(70000, "cycle", false);
  assert.equal(timeline.blend, 0.5);
  timeline.update(60000, "cycle", true);
  assert.equal(timeline.blend, 0.5);
  assert.equal(timeline.elapsed, 70000);
  timeline.update(1000, "cycle", false);
  assert.equal(timeline.elapsed, 71000);
});

test("manual phases remain selectable while frozen and do not animate", () => {
  const timeline = new LightingTimeline();
  assert.equal(timeline.update(0, "moonlit", true), 1);
  assert.equal(timeline.update(0, "dusk", true), 0.5);
  assert.equal(timeline.update(0, "lamplit", true), 0);
});

test("manual lighting eases to its phase then stays fixed", () => {
  const timeline = new LightingTimeline();
  assert.equal(timeline.update(0, "moonlit", false), 0);
  assert.ok(timeline.update(900, "moonlit", false) > 0);
  assert.equal(timeline.update(900, "moonlit", false), 1);
  assert.equal(timeline.update(100000, "moonlit", false), 1);
});

test("lighting choices restore without accepting unknown stored values", () => {
  assert.equal(new SceneSettings({ getItem: () => '{"lighting":"moonlit"}', setItem: () => {} }).lighting, "moonlit");
  assert.equal(new SceneSettings({ getItem: () => '{"lighting":"bad"}', setItem: () => {} }).lighting, "cycle");
});
