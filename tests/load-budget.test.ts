import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import { test } from "node:test";

const src = new URL("../src/", import.meta.url);
const RESIDENTS = ["sprout", "hoodie", "puff", "chomper", "slime", "burger"];
// The PNGs were 476-659 KB each (3.5 MB together), all fetched before the room shows. WebP at q88 lands near 60-100 KB.
const RESIDENT_MAX_KB = 150;

test("each resident ships as a WebP small enough for a phone's first load", () => {
  for (const name of RESIDENTS) {
    const file = new URL(`art/crew/${name}.webp`, src);
    assert.ok(existsSync(file), `${name}.webp exists`);
    const kb = statSync(file).size / 1024;
    assert.ok(kb <= RESIDENT_MAX_KB, `${name}.webp is ${kb.toFixed(0)} KB, budget ${RESIDENT_MAX_KB}`);
  }
});

test("the cast loads the WebP residents, not the full-size PNGs", () => {
  const cast = readFileSync(new URL("cast.ts", src), "utf8");
  for (const name of RESIDENTS) assert.match(cast, new RegExp(`from "\\./art/crew/${name}\\.webp"`));
  assert.doesNotMatch(cast, /\.png"/);
});
