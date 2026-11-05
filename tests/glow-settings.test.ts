import assert from "node:assert/strict";
import { test } from "node:test";
import { SceneSettings } from "../src/scene-settings.ts";

test("each lighting choice has the requested lamp-glow default", () => {
  const settings = new SceneSettings();
  assert.equal(settings.get("lights"), 20);
  settings.setLighting("dusk"); assert.equal(settings.get("lights"), 300);
  settings.setLighting("lamplit"); assert.equal(settings.get("lights"), 20);
  settings.setLighting("moonlit"); assert.equal(settings.get("lights"), 0);
});

test("manual glow tuning belongs to its lighting choice and persists", () => {
  let value: string | null = null;
  const saved = { getItem: () => value, setItem: (_key: string, next: string) => { value = next; } };
  const settings = new SceneSettings(saved);
  settings.setLighting("lamplit"); settings.set("lights", 70);
  settings.setLighting("dusk"); assert.equal(settings.get("lights"), 300);
  settings.set("lights", 240);
  const restored = new SceneSettings(saved);
  assert.equal(restored.get("lights"), 240);
  restored.setLighting("lamplit"); assert.equal(restored.get("lights"), 70);
  restored.reset(); assert.equal(restored.get("lights"), 20);
  restored.setLighting("dusk"); assert.equal(restored.get("lights"), 300);
});

test("old 150% defaults migrate while an explicitly different old value survives", () => {
  const storage = (value: string) => ({ getItem: () => value, setItem: () => {} });
  assert.equal(new SceneSettings(storage('{"lights":150,"lighting":"lamplit"}')).get("lights"), 20);
  assert.equal(new SceneSettings(storage('{"lights":150,"lighting":"dusk"}')).get("lights"), 300);
  assert.equal(new SceneSettings(storage('{"lights":80,"lighting":"lamplit"}')).get("lights"), 80);
});
