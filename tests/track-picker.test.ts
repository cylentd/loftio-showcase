import assert from "node:assert/strict";
import { test } from "node:test";
import { TrackPicker, placeTrackList } from "../src/track-picker-model.ts";
import { MUSIC } from "../src/copy.ts";
import { TRACKS } from "../src/soundtrack-data.ts";
import { Playlist } from "../src/playlist-model.ts";

const COUNT = 8;

test("the list starts closed, and opening it puts the cursor on the playing song", () => {
  const picker = new TrackPicker(COUNT);
  assert.equal(picker.open, false);
  picker.show(3);
  assert.equal(picker.open, true);
  assert.equal(picker.active, 3);
  picker.hide();
  assert.equal(picker.open, false);
});

test("the disc toggles the list: a second press closes it", () => {
  const picker = new TrackPicker(COUNT);
  picker.toggle(2);
  assert.equal(picker.open, true);
  assert.equal(picker.active, 2);
  picker.toggle(2);
  assert.equal(picker.open, false);
});

test("arrow keys move the cursor and wrap at both ends; Home and End jump", () => {
  const picker = new TrackPicker(COUNT);
  picker.show(0);
  assert.deepEqual(picker.key("ArrowDown"), { kind: "move" });
  assert.equal(picker.active, 1);
  picker.key("ArrowUp");
  picker.key("ArrowUp");
  assert.equal(picker.active, COUNT - 1, "up from the first song wraps to the last");
  picker.key("ArrowDown");
  assert.equal(picker.active, 0, "down from the last song wraps to the first");
  picker.key("End");
  assert.equal(picker.active, COUNT - 1);
  picker.key("Home");
  assert.equal(picker.active, 0);
});

test("Enter or Space picks the song under the cursor and keeps the list open for more browsing", () => {
  for (const key of ["Enter", " "]) {
    const picker = new TrackPicker(COUNT);
    picker.show(1);
    picker.key("ArrowDown");
    assert.deepEqual(picker.key(key), { kind: "pick", index: 2 });
    assert.equal(picker.open, true);
    assert.equal(picker.active, 2);
  }
});

test("Escape and Tab close the list without picking", () => {
  for (const key of ["Escape", "Tab"]) {
    const picker = new TrackPicker(COUNT);
    picker.show(4);
    picker.key("ArrowDown");
    assert.deepEqual(picker.key(key), { kind: "close" });
    assert.equal(picker.open, false);
  }
});

test("on the closed disc, an arrow opens the list; other keys are left to the button", () => {
  const picker = new TrackPicker(COUNT);
  assert.deepEqual(picker.key("ArrowUp"), { kind: "open" });
  assert.deepEqual(picker.key("ArrowDown"), { kind: "open" });
  assert.deepEqual(picker.key("Enter"), { kind: "none" }, "Enter and Space reach the button's own click");
  assert.deepEqual(picker.key(" "), { kind: "none" });
  assert.deepEqual(picker.key("Escape"), { kind: "none" });
  assert.equal(picker.open, false, "the model opens only through show or toggle");
});

test("a key the list does not use changes nothing", () => {
  const picker = new TrackPicker(COUNT);
  picker.show(5);
  assert.deepEqual(picker.key("a"), { kind: "none" });
  assert.equal(picker.active, 5);
  assert.equal(picker.open, true);
});

test("picking from the list moves the one playlist, so Settings and the title follow it", () => {
  const playlist = new Playlist(TRACKS);
  const picker = new TrackPicker(playlist.all.length);
  let heard = 0;
  playlist.subscribe(() => { heard += 1; });
  picker.show(playlist.all.indexOf(playlist.current));
  picker.key("End");
  const action = picker.key("Enter");
  assert.equal(action.kind, "pick");
  if (action.kind === "pick") playlist.select(playlist.all[action.index]!.id);
  assert.equal(playlist.current.id, TRACKS[TRACKS.length - 1]!.id);
  assert.equal(heard, 1);
});

test("every track has a display name and the disc has its own words", () => {
  for (const track of TRACKS) assert.ok(MUSIC.tracks[track.id], track.id);
  assert.ok(MUSIC.chooseSong.length > 0);
  assert.ok(MUSIC.songList.length > 0);
});

const VIEW = { width: 1500, height: 920 };
const GAP = 8;
const MARGIN = 12;

test("the list sits above the disc, its left edge lined up with the disc's", () => {
  const disc = { left: 1150, top: 800, right: 1190, bottom: 840 };
  const at = placeTrackList(disc, { width: 260, height: 300 }, VIEW, GAP, MARGIN);
  assert.deepEqual(at, { left: 1150, top: 800 - GAP - 300 });
});

test("on a 360 px phone the list is pushed back inside the screen margin", () => {
  const phone = { width: 360, height: 800 };
  const disc = { left: 200, top: 700, right: 240, bottom: 740 };
  const at = placeTrackList(disc, { width: 260, height: 300 }, phone, GAP, MARGIN);
  assert.equal(at.left, phone.width - MARGIN - 260);
  assert.ok(at.left >= MARGIN);
  assert.equal(at.top, 700 - GAP - 300);
});

test("a list wider than the screen starts at the margin rather than off the left edge", () => {
  const disc = { left: 20, top: 700, right: 60, bottom: 740 };
  const at = placeTrackList(disc, { width: 400, height: 300 }, { width: 360, height: 800 }, GAP, MARGIN);
  assert.equal(at.left, MARGIN);
});

test("with no room above, the list opens below the disc, and never above the top margin", () => {
  const disc = { left: 100, top: 100, right: 140, bottom: 140 };
  assert.equal(placeTrackList(disc, { width: 260, height: 300 }, VIEW, GAP, MARGIN).top, 140 + GAP);
  const squeezed = placeTrackList(disc, { width: 260, height: 900 }, VIEW, GAP, MARGIN);
  assert.equal(squeezed.top, MARGIN, "too tall for either side: pinned to the top margin, and CSS scrolls it");
});
