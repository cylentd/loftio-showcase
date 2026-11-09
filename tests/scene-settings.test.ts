import assert from "node:assert/strict";
import { test } from "node:test";
import { SceneSettings } from "../src/scene-settings.ts";

function storage(value: string | null = null) {
  return { getItem: () => value, setItem: (_key: string, next: string) => { value = next; } };
}

test("stronger initial settings remain independent when a slider is adjusted", () => {
  const settings = new SceneSettings();
  assert.deepEqual(settings.values(), { particles: 150, leaves: 150, lights: 20 });
  settings.set("leaves", 250);
  assert.deepEqual(settings.values(), { particles: 150, leaves: 250, lights: 20 });
});

test("zero disables an effect and controls are clamped and quantized", () => {
  const settings = new SceneSettings();
  settings.set("particles", -50);
  settings.set("leaves", 900);
  settings.set("lights", 173);
  assert.deepEqual(settings.values(), { particles: 0, leaves: 300, lights: 170 });
  settings.set("lights", Number.NaN);
  assert.equal(settings.get("lights"), 170);
});

test("saved settings restore recognized numbers without trusting malformed fields", () => {
  const settings = new SceneSettings(storage('{"particles":80,"leaves":900,"lights":"broken","extra":2}'));
  assert.deepEqual(settings.values(), { particles: 80, leaves: 300, lights: 20 });
  assert.deepEqual(new SceneSettings(storage("invalid JSON")).values(), { particles: 150, leaves: 150, lights: 20 });
});

test("changed settings survive reload and reset restores stronger defaults", () => {
  const saved = storage();
  const settings = new SceneSettings(saved);
  settings.set("lights", 0);
  assert.equal(new SceneSettings(saved).get("lights"), 0);
  settings.reset();
  assert.deepEqual(new SceneSettings(saved).values(), { particles: 150, leaves: 150, lights: 20 });
});

test("blocked local storage never prevents live tuning", () => {
  const blocked = { getItem(): never { throw new Error("blocked"); }, setItem(): never { throw new Error("quota"); } };
  const settings = new SceneSettings(blocked);
  settings.set("particles", 300);
  assert.equal(settings.get("particles"), 300);
});

test("Puff's floating letter is off by default and its visibility is saved independently", () => {
  const saved = storage();
  const settings = new SceneSettings(saved);
  assert.equal(settings.showCue, false);
  settings.setCue(true);
  assert.equal(new SceneSettings(saved).showCue, true);
  assert.deepEqual(settings.values(), { particles: 150, leaves: 150, lights: 20 });
});

test("the Music tile's choice defaults to showing the player and survives reload (QA, 2026-11-06)", () => {
  const saved = storage();
  const settings = new SceneSettings(saved);
  assert.equal(settings.showPlayer, true);
  settings.setPlayer(false);
  assert.equal(new SceneSettings(saved).showPlayer, false);
  settings.setPlayer(true);
  assert.equal(new SceneSettings(saved).showPlayer, true);
  assert.deepEqual(settings.values(), { particles: 150, leaves: 150, lights: 20 }, "the choice leaves the effects alone");
});

test("a malformed saved Music choice falls back to showing the player", () => {
  for (const player of ['"no"', "0", "null", "[]"]) {
    assert.equal(new SceneSettings(storage(`{"player":${player}}`)).showPlayer, true, player);
  }
});

test("wander defaults on, favorites default off, and both persist without resetting effects", () => {
  const saved = storage();
  const settings = new SceneSettings(saved);
  assert.equal(settings.wander, true);
  assert.equal(settings.showFavorites, false);
  settings.setWander(false);
  settings.setFavorites(true);
  settings.set("lights", 240);
  const restored = new SceneSettings(saved);
  assert.equal(restored.wander, false);
  assert.equal(restored.showFavorites, true);
  assert.equal(restored.get("lights"), 240);
  restored.reset();
  assert.equal(restored.wander, false);
  assert.equal(restored.showFavorites, true);
});
