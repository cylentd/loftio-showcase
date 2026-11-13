import assert from "node:assert/strict";
import { test } from "node:test";
import { TrayModel, nearTray } from "../../src/tray-model.ts";
import { TRAY } from "../../src/copy.ts";

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

test("visible player controls act on the first press even while the tray is tucked", () => {
  for (const touch of [false, true]) {
    const tray = new TrayModel(PEEK);
    assert.equal(tray.isOpen(0), false);
    assert.equal(tray.press(0, touch, true), false, "the first player press must not be swallowed");
    assert.equal(tray.isOpen(1), true, "the tray remains accessible on touch");
    tray.pressOutside();
    assert.equal(tray.isOpen(1), false);
  }
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

test("the Music tile shows the player at first, and each press hides or shows it", () => {
  const tray = new TrayModel(PEEK);
  assert.equal(tray.musicShown, true);
  assert.equal(tray.toggleMusic(), false);
  assert.equal(tray.musicShown, false);
  assert.equal(tray.toggleMusic(), true);
  assert.equal(tray.musicShown, true);
});

test("hiding the player leaves the tray out, and a tucked tray keeps the choice", () => {
  const tray = new TrayModel(PEEK);
  tray.peek(0);
  tray.toggleMusic();
  assert.equal(tray.isOpen(1), true, "pressing Music does not tuck the tray");
  assert.equal(tray.isOpen(PEEK), false);
  tray.peek(PEEK);
  assert.equal(tray.musicShown, false, "the player stays hidden the next time the tray comes out");
});

test("tucked, the board shows the player row alone; open, the tiles under it", () => {
  const tray = new TrayModel(PEEK);
  assert.deepEqual(tray.rows(0), { player: true, tiles: "none" });
  tray.peek(0);
  assert.deepEqual(tray.rows(1), { player: true, tiles: "all" });
});

test("with Music off, a tucked board is a slim bar holding only Settings (QA, 2026-11-06)", () => {
  const tray = new TrayModel(PEEK);
  tray.toggleMusic();
  assert.deepEqual(tray.rows(0), { player: false, tiles: "settings" });
  tray.hovering = true;
  assert.deepEqual(tray.rows(0), { player: false, tiles: "all" });
});

test("the tray starts with the saved Music choice", () => {
  assert.equal(new TrayModel(PEEK, false).musicShown, false);
  assert.equal(new TrayModel(PEEK, true).musicShown, true);
});

test("mobile actions stay open after idle and outside presses, with Music on or off", () => {
  const tray = new TrayModel(PEEK);
  tray.alwaysOpen = true;
  tray.pressOutside();
  assert.deepEqual(tray.rows(PEEK), { player: true, tiles: "all" });
  assert.equal(tray.press(PEEK, true), false, "visible mobile actions respond on the first tap");
  tray.toggleMusic();
  tray.pressOutside();
  assert.deepEqual(tray.rows(PEEK), { player: false, tiles: "all" });
  tray.alwaysOpen = false;
  assert.deepEqual(tray.rows(PEEK), { player: false, tiles: "settings" });
});

test("each dock tile's accessible name contains its visible label", () => {
  for (const [tile, { label, name }] of Object.entries(TRAY)) {
    assert.ok(name.toLowerCase().includes(label.toLowerCase()), `${tile}: "${name}" lacks "${label}"`);
  }
  assert.deepEqual(Object.values(TRAY).map(tile => tile.label), ["Music", "Postcard", "Settings"]);
});
