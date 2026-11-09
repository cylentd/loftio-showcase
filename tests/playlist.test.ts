import assert from "node:assert/strict";
import { test } from "node:test";
import { START_TRACK, START_TRACK_CHANCE, TRACKS } from "../src/soundtrack-data.ts";
import { openingTrack } from "../src/playlist-model.ts";
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

test("the favored opening song is Lanterns in the Rain, at a 30% chance", () => {
  assert.equal(TRACKS.find(track => track.id === START_TRACK)?.file, "Lanterns_in_the_Rain.mp3");
  assert.equal(START_TRACK_CHANCE, 0.3);
});

test("the opening song is the favored one below its chance, else one of the others in equal shares", () => {
  const ids = TRACKS.map(track => track.id);
  const others = ids.filter(id => id !== START_TRACK);
  assert.equal(openingTrack(ids, START_TRACK, 0.3, 0), START_TRACK);
  assert.equal(openingTrack(ids, START_TRACK, 0.3, 0.2999), START_TRACK);
  assert.equal(openingTrack(ids, START_TRACK, 0.3, 0.3), others[0]);
  assert.equal(openingTrack(ids, START_TRACK, 0.3, 0.9999), others.at(-1));
  // Sweep the roll evenly: each other song gets the same share of the remaining 70%.
  const counts = new Map<string, number>();
  const steps = 7000;
  for (let i = 0; i < steps; i++) { const id = openingTrack(ids, START_TRACK, 0.3, i / steps); counts.set(id, (counts.get(id) ?? 0) + 1); }
  assert.equal(counts.get(START_TRACK), 2100);
  for (const id of others) assert.equal(counts.get(id), 700);
});

test("the two midnight songs have distinct, recognizable display names", () => {
  assert.equal(MUSIC.tracks.aisles, "Midnight Aisles");
  assert.equal(MUSIC.tracks.treehouse, "Treehouse After Dark");
  assert.equal(MUSIC.tracks.hideaway, "The Lamp-Lit Hideaway");
});
