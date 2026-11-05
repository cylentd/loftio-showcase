import assert from "node:assert/strict";
import { test } from "node:test";
import { Playlist } from "../src/playlist-model.ts";

const tracks = [{ id: "a" }, { id: "b" }, { id: "c" }] as const;

test("the playlist starts on the first track and next wraps around", () => {
  const playlist = new Playlist(tracks);
  assert.equal(playlist.current.id, "a");
  playlist.next();
  playlist.next();
  assert.equal(playlist.current.id, "c");
  playlist.next();
  assert.equal(playlist.current.id, "a");
});

test("every view hears each change once, and picking the playing track is no change", () => {
  const playlist = new Playlist(tracks);
  const heard: string[] = [];
  playlist.subscribe(() => heard.push(playlist.current.id));
  playlist.subscribe(() => heard.push(`second:${playlist.current.id}`));
  playlist.select("c");
  playlist.select("c");
  playlist.next();
  assert.deepEqual(heard, ["c", "second:c", "a", "second:a"]);
});

test("an unknown track id is ignored", () => {
  const playlist = new Playlist(tracks);
  let changes = 0;
  playlist.subscribe(() => { changes += 1; });
  playlist.select("missing");
  assert.equal(playlist.current.id, "a");
  assert.equal(changes, 0);
});
