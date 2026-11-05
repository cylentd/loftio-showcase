import assert from "node:assert/strict";
import { test } from "node:test";
import { seatAvailable, seatDrop } from "../src/seat-occupancy.ts";
import { defaultLampGlow } from "../src/lamp-glow.ts";
import { postcardLayout } from "../src/postcard-layout.ts";
import { POSTCARD_RENDER as PRINT } from "../src/postcard-data.ts";

const CHAIR = { x: 300, y: 698 };

test("a seated or incoming resident reserves the sitting spot, not the whole floor", () => {
  assert.equal(seatAvailable({ x: 320, y: 700 }, [CHAIR]), false);
  assert.equal(seatAvailable({ x: 535, y: 680 }, [CHAIR]), true);
  assert.equal(seatAvailable({ x: 800, y: 900 }, [{ x: 800, y: 900 }]), true);
  assert.equal(seatAvailable({ x: 510, y: 345 }, [{ x: 600, y: 350 }]), false);
});

test("an occupied seat rejects a drop without displacing its occupant or inventing markers", () => {
  const origin = { x: 1200, y: 900 };
  assert.deepEqual(seatDrop(CHAIR, origin, [CHAIR]), { position: origin, blocked: true });
  assert.deepEqual(seatDrop(CHAIR, origin, []), { position: CHAIR, blocked: false });
});

test("lamp glow defaults to 20% lamplit, 300% dusk and zero moonlit", () => {
  assert.equal(defaultLampGlow(0), 20);
  assert.equal(defaultLampGlow(0.5), 300);
  assert.equal(defaultLampGlow(1), 0);
  assert.equal(defaultLampGlow(0.25), 160);
  assert.equal(defaultLampGlow(0.75), 150);
});

test("desktop postcard type and stamp scale with the captured scene", () => {
  const standard = postcardLayout(1080, 660);
  const double = postcardLayout(2160, 1320);
  assert.equal(double.scale, standard.scale * 2);
  assert.equal(double.fontSize * double.scale, standard.fontSize * standard.scale * 2);
  assert.ok(standard.fontSize / standard.width >= 0.055);
  assert.ok(PRINT.stampWidth / standard.width >= 0.14);
  assert.ok(PRINT.border / standard.width >= 0.05);
});

test("portrait postcards reserve stamp space below even three caption lines", () => {
  const layout = postcardLayout(360, 800, 3);
  assert.equal(layout.compact, true);
  const captionBottom = PRINT.titleInset + 3 * layout.fontSize * PRINT.captionLeading + PRINT.bylineGap + PRINT.smallFont;
  const stampTop = PRINT.border + layout.footer - PRINT.stampInset - PRINT.stampHeight;
  assert.ok(stampTop >= captionBottom + PRINT.bylineGap);
});
