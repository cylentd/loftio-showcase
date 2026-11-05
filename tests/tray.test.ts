import assert from "node:assert/strict";
import { test } from "node:test";
import { TrayModel, nearTray } from "../src/tray-model.ts";

const PEEK = 4000;

test("the tray starts tucked and peeks for exactly the peek time on entering", () => {
  const tray = new TrayModel(PEEK);
  assert.equal(tray.isOpen(0), false);
  tray.peek(1000);
  assert.equal(tray.isOpen(1000), true);
  assert.equal(tray.isOpen(1000 + PEEK - 1), true);
  assert.equal(tray.isOpen(1000 + PEEK), false);
  assert.equal(tray.msUntilPeekEnds(1500), PEEK - 500);
  assert.equal(tray.msUntilPeekEnds(1000 + PEEK), null);
});

test("hover near the corner keeps it out past the peek and leaving tucks it", () => {
  const tray = new TrayModel(PEEK);
  tray.peek(0);
  tray.hovering = true;
  assert.equal(tray.isOpen(PEEK + 1), true);
  tray.hovering = false;
  assert.equal(tray.isOpen(PEEK + 1), false);
});

test("keyboard focus and an open settings panel each hold it out", () => {
  const tray = new TrayModel(PEEK);
  tray.focused = true;
  assert.equal(tray.isOpen(0), true);
  tray.focused = false;
  tray.held = true;
  assert.equal(tray.isOpen(0), true);
});

test("a press on the tucked tray only opens it; a press outside tucks it", () => {
  const tray = new TrayModel(PEEK);
  assert.equal(tray.press(0, true), true);
  assert.equal(tray.isOpen(PEEK * 10), true);
  tray.pressOutside();
  assert.equal(tray.isOpen(PEEK * 10), false);
  assert.equal(tray.press(0, false), true, "a mouse press on a tucked tray is consumed too");
  assert.equal(tray.isOpen(PEEK * 10), true);
});

test("a touch on the open tray keeps it out after the peek; a mouse press does not", () => {
  const touch = new TrayModel(PEEK);
  touch.peek(0);
  assert.equal(touch.press(100, true), false, "a press on an open tray reaches its control");
  assert.equal(touch.isOpen(PEEK + 1), true);
  const mouse = new TrayModel(PEEK);
  mouse.peek(0);
  assert.equal(mouse.press(100, false), false);
  assert.equal(mouse.isOpen(PEEK + 1), false);
});

test("a press outside does not cut the entry peek short", () => {
  const tray = new TrayModel(PEEK);
  tray.peek(0);
  tray.pressOutside();
  assert.equal(tray.isOpen(PEEK - 1), true);
});

test("near the tray means within reach of its box, on any side", () => {
  const rect = { left: 100, top: 200, right: 150, bottom: 244 };
  assert.equal(nearTray(125, 220, rect, 48), true);
  assert.equal(nearTray(52, 220, rect, 48), true);
  assert.equal(nearTray(51, 220, rect, 48), false);
  assert.equal(nearTray(125, 152, rect, 48), true);
  assert.equal(nearTray(125, 151, rect, 48), false);
  assert.equal(nearTray(199, 293, rect, 48), false, "a corner beyond reach diagonally");
});
