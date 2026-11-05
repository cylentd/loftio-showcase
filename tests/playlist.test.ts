import assert from "node:assert/strict";
import { test } from "node:test";
import { TRACKS } from "../src/soundtrack-data.ts";
import { MUSIC } from "../src/copy.ts";

test("playlist includes all eight requested songs with matching picker labels", () => {
  assert.deepEqual(TRACKS.map(track => track.file), [
    "Paper_Cranes_and_Coffee.mp3",
    "Slow_Afternoon_Light.mp3",
    "The_Quiet_Save_Point.mp3",
    "Lanterns_in_the_Rain.mp3",
    "Tea_and_Tiny_Books.mp3",
    "Midnight_Aisles.mp3",
    "Midnight_in_the_Treehouse.mp3",
    "The_Lamp_Lit_Hideaway.mp3",
  ]);
  assert.equal(new Set(TRACKS.map(track => track.id)).size, TRACKS.length);
  assert.deepEqual(Object.keys(MUSIC.tracks), TRACKS.map(track => track.id));
});

test("the two midnight songs have distinct, recognizable display names", () => {
  assert.equal(MUSIC.tracks.aisles, "Midnight Aisles");
  assert.equal(MUSIC.tracks.treehouse, "Treehouse After Dark");
  assert.equal(MUSIC.tracks.hideaway, "The Lamp-Lit Hideaway");
});
