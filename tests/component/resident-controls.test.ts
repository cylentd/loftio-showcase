import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import type { Resident } from "../../src/resident.ts";
import { NAMES, RESIDENT_CONTROLS as COPY } from "../../src/copy.ts";
import { PLACEMENT } from "../../src/resident-movement-data.ts";
import { installResidentControls } from "../../src/resident-controls.ts";

// Component layer: the real module and its real settings/tactile imports, with a hand-made DOM, resident and runtime.

const POINTER = 1;
const PRESS_AT = 100;
const START = { x: 1000, y: 800 }; // open ground floor: key steps and drops are not clamped
const restores: Array<() => void> = [];
afterEach(() => { while (restores.length) restores.pop()!(); });

class Surface extends EventTarget {
  dataset: Record<string, string> = {};
  attributes = new Map<string, string>();
  captures = new Set<number>();
  classList = { add() {} };
  style = { setProperty() {} };
  namespaceURI = "svg";
  append() {} replaceChildren() {}
  setAttribute(name: string, value: string) { this.attributes.set(name, value); }
  getAttribute(name: string) { return this.attributes.get(name) ?? null; }
  setPointerCapture(id: number) { this.captures.add(id); }
  hasPointerCapture(id: number) { return this.captures.has(id); }
  releasePointerCapture(id: number) { this.captures.delete(id); }
}

function makeResident(id: string) {
  const calls = { pickUp: [] as unknown[][], putDown: [] as unknown[][] };
  return { cast: { id, interest: { x: 0, y: 0 } }, pos: { ...START }, lift: 0, falling: false, held: false, calls,
    touch() {}, update() {}, pull() {}, fall() {},
    pickUp(...args: unknown[]) { calls.pickUp.push(args); this.held = true; },
    putDown(...args: unknown[]) { calls.putDown.push(args); this.held = false; } };
}

function fixture(ids = ["puff"]) {
  const win = new EventTarget();
  const document = Object.assign(new EventTarget(), { hidden: false, createElement: () => new Surface(),
    createElementNS: () => new Surface(), getElementById: () => new Surface() });
  const saved = { document: Reflect.get(globalThis, "document"), addEventListener: Reflect.get(globalThis, "addEventListener") };
  Reflect.set(globalThis, "document", document);
  Reflect.set(globalThis, "addEventListener", win.addEventListener.bind(win));
  restores.push(() => { Reflect.set(globalThis, "document", saved.document); Reflect.set(globalThis, "addEventListener", saved.addEventListener); });
  const residents = ids.map(makeResident);
  const buttons = new Map(ids.map((id) => [id, new Surface()]));
  const play = { releaseResult: null as string | null, keyResult: null as string | null,
    catch: () => false, release() { return this.releaseResult; }, key() { return this.keyResult; },
    sample() {}, carryTop: () => 0, reset() {} };
  const runtime = { clock: 0, update() {}, play, look: { scale: 1, left: 0, x: 0, y: 0, offsetY: 0, frozen: true, still: false } };
  const announced: string[] = [];
  const overlay = { residentButton: (id: string) => buttons.get(id)!, announce: (text: string) => { announced.push(text); }, arrive() {} };
  const settings = { wander: true, subscribe() {}, setWander() {} };
  const controls = installResidentControls({ residents, cast: { x: 0, y: 0 } } as never, runtime as never, overlay as never, settings as never);
  const drops: unknown[] = [];
  controls.onDrop = (resident) => { drops.push(resident); };
  return { controls, resident: residents[0]!, residents, button: buttons.get(ids[0]!)!, buttons, play, announced, drops, document };
}
type Fixture = ReturnType<typeof fixture>;

function pointer(target: EventTarget, type: string, over: Record<string, unknown> = {}) {
  const event = new Event(type, { cancelable: true });
  Object.assign(event, { pointerId: POINTER, isPrimary: true, button: 0, pointerType: "mouse", clientX: PRESS_AT, clientY: PRESS_AT, ...over });
  target.dispatchEvent(event);
  return event;
}
const press = (fx: Fixture, over = {}) => pointer(fx.button, "pointerdown", over);
const moveBy = (fx: Fixture, distance: number) => pointer(fx.button, "pointermove", { clientX: PRESS_AT + distance });
const release = (fx: Fixture) => pointer(fx.button, "pointerup");
const carry = (fx: Fixture) => { press(fx); moveBy(fx, PLACEMENT.threshold); };
function key(target: EventTarget, name: string, over: Record<string, unknown> = {}) {
  const event = new Event("keydown", { cancelable: true });
  Object.assign(event, { key: name, repeat: false, shiftKey: false, ...over });
  target.dispatchEvent(event);
  return event;
}
function click(fx: Fixture) {
  const event = new Event("click", { cancelable: true });
  Object.assign(event, { detail: 1 });
  fx.button.dispatchEvent(event);
  return event;
}
const label = NAMES["puff"]!;

test("P16 play taking a pressed resident does not cause a second pick-up on drag", () => {
  const fx = fixture();
  press(fx);
  fx.resident.pickUp();
  moveBy(fx, PLACEMENT.threshold);
  assert.deepEqual(fx.resident.calls.pickUp, [[]]);
  assert.equal(fx.button.getAttribute("aria-pressed"), "false");
  assert.deepEqual(fx.announced, []);
  release(fx);
  assert.equal(fx.resident.calls.putDown.length, 1);
  assert.deepEqual(fx.drops, [fx.resident]);
});

test("P16 Escape after play takes a pressed resident restores and puts it down", () => {
  const fx = fixture();
  press(fx);
  fx.resident.pickUp();
  fx.resident.pos.x += PLACEMENT.keyStep;
  key(fx.document, "Escape");
  assert.deepEqual(fx.resident.pos, START);
  assert.deepEqual(fx.resident.calls.putDown, [[false, false, 0]]);
  assert.equal(fx.button.hasPointerCapture(POINTER), false);
  assert.equal(fx.announced.at(-1), `${label} ${COPY.cancelled}`);
});

// Owner ruling 2026-11-11: a resident that play frees from the hand stays free; the next drag does not re-pick it.
test("P17 a carried resident freed by play is not picked up again on the next move", () => {
  const fx = fixture();
  carry(fx);
  fx.resident.putDown(true, false, 0);
  moveBy(fx, PLACEMENT.threshold * 2);
  assert.deepEqual(fx.resident.calls.pickUp, [[false]]);
  assert.equal(fx.resident.held, false);
  assert.equal(fx.button.getAttribute("aria-pressed"), "false");
  assert.equal(fx.button.dataset["held"], undefined);
  assert.equal(fx.button.hasPointerCapture(POINTER), false);
});

test("P17 after play frees a carried resident, the release does nothing and a new press starts a fresh grip", () => {
  const fx = fixture();
  carry(fx);
  fx.resident.putDown(true, false, 0);
  moveBy(fx, PLACEMENT.threshold * 2); release(fx);
  assert.equal(fx.resident.calls.putDown.length, 1);
  assert.deepEqual(fx.drops, []);
  carry(fx);
  assert.deepEqual(fx.resident.calls.pickUp, [[false], [false]]);
});

for (const source of ["play", "fall"] as const) {
  test(`P18 a pointer catches from ${source} immediately and Escape places it back`, () => {
    const fx = fixture();
    if (source === "play") fx.play.catch = () => true;
    else fx.resident.falling = true;
    press(fx);
    assert.deepEqual(fx.resident.calls.pickUp, [[true]]);
    assert.equal(fx.button.getAttribute("aria-pressed"), "true");
    key(fx.document, "Escape");
    assert.deepEqual(fx.resident.pos, START);
    assert.deepEqual(fx.resident.calls.putDown, [[true, false, 0]]);
    assert.equal(fx.button.hasPointerCapture(POINTER), false);
  });
}

test("P1 a primary press on a free resident captures the pointer and picks nothing up", () => {
  const fx = fixture();
  press(fx);
  assert.equal(fx.resident.calls.pickUp.length, 0);
  assert.equal(fx.button.getAttribute("aria-pressed"), "false");
  assert.equal(fx.button.hasPointerCapture(POINTER), true);
  assert.equal(fx.button.dataset["input"], "pointer");
});

test("P2 a move past the drag threshold picks the resident up once and announces it", () => {
  const fx = fixture();
  press(fx); moveBy(fx, PLACEMENT.threshold); moveBy(fx, PLACEMENT.threshold * 2);
  assert.deepEqual(fx.resident.calls.pickUp, [[false]]);
  assert.equal(fx.button.getAttribute("aria-pressed"), "true");
  assert.equal(fx.button.dataset["held"], "true");
  assert.deepEqual(fx.announced, [`${label} ${COPY.picked}`]);
});

test("P3 a move under the drag threshold picks nothing up", () => {
  const fx = fixture();
  press(fx); moveBy(fx, PLACEMENT.threshold - 1);
  assert.equal(fx.resident.calls.pickUp.length, 0);
  assert.equal(fx.button.getAttribute("aria-pressed"), "false");
});

test("P4 releasing a carried resident places it and announces the drop", () => {
  const fx = fixture();
  carry(fx); release(fx);
  assert.equal(fx.resident.calls.putDown.length, 1);
  assert.equal(fx.resident.calls.putDown[0]![0], true);
  assert.equal(fx.button.getAttribute("aria-pressed"), "false");
  assert.equal(fx.button.dataset["held"], undefined);
  assert.equal(fx.announced.at(-1), `${label} ${COPY.placed}`);
  assert.deepEqual(fx.drops, [fx.resident]);
});

test("P4 after a carried release the pointer is freed and only the first click is prevented", () => {
  const fx = fixture();
  carry(fx); release(fx);
  const clicks = [click(fx).defaultPrevented, click(fx).defaultPrevented];
  assert.equal(fx.button.hasPointerCapture(POINTER), false);
  assert.deepEqual(clicks, [true, false]);
});

test("P5 a press and release with no move touches nothing and leaves the click alone", () => {
  const fx = fixture();
  press(fx); release(fx);
  assert.equal(fx.resident.calls.pickUp.length, 0);
  assert.equal(fx.resident.calls.putDown.length, 0);
  assert.deepEqual(fx.announced, []);
  assert.equal(click(fx).defaultPrevented, false);
});

test("P6 Escape while carried puts the resident back at the press position, cancelled", () => {
  const fx = fixture();
  carry(fx); key(fx.document, "Escape"); release(fx);
  assert.equal(fx.resident.calls.putDown.length, 1);
  assert.equal(fx.resident.calls.putDown[0]![0], false);
  assert.deepEqual(fx.resident.pos, START);
  assert.equal(fx.announced.at(-1), `${label} ${COPY.cancelled}`);
  assert.equal(fx.drops.length, 0);
});

test("P7 Escape before the threshold announces nothing and a later move picks nothing up", () => {
  const fx = fixture();
  press(fx); key(fx.document, "Escape"); moveBy(fx, PLACEMENT.threshold * 2);
  assert.equal(fx.resident.calls.putDown.length, 0);
  assert.equal(fx.resident.calls.pickUp.length, 0);
  assert.deepEqual(fx.announced, []);
});

test("P8 Space picks up a free resident by keyboard", () => {
  const fx = fixture();
  key(fx.button, " ");
  assert.equal(fx.resident.calls.pickUp.length, 1);
  assert.equal(fx.button.getAttribute("aria-pressed"), "true");
  assert.equal(fx.button.dataset["input"], "keyboard");
});

test("P8 a second Space places the resident and reports the drop", () => {
  const fx = fixture();
  key(fx.button, " "); key(fx.button, " ");
  assert.equal(fx.resident.calls.putDown.length, 1);
  assert.equal(fx.resident.calls.putDown[0]![0], true);
  assert.equal(fx.announced.at(-1), `${label} ${COPY.placed}`);
  assert.deepEqual(fx.drops, [fx.resident]);
});

test("P8 a repeating Space does nothing", () => {
  const fx = fixture();
  key(fx.button, " ", { repeat: true });
  assert.equal(fx.resident.calls.pickUp.length, 0);
  assert.equal(fx.button.getAttribute("aria-pressed"), "false");
});

const ARROWS = [["ArrowLeft", -1, 0], ["ArrowRight", 1, 0], ["ArrowUp", 0, -1], ["ArrowDown", 0, 1]] as const;
for (const [name, dx, dy] of ARROWS) {
  for (const fine of [false, true]) {
    test(`P9 ${name}${fine ? " with Shift" : ""} moves a key-held resident one ${fine ? "fine" : "key"} step`, () => {
      const fx = fixture(); const step = fine ? PLACEMENT.fineStep : PLACEMENT.keyStep;
      key(fx.button, " ");
      const event = key(fx.button, name, { shiftKey: fine });
      assert.deepEqual(fx.resident.pos, { x: START.x + dx * step, y: START.y + dy * step });
      assert.equal(event.defaultPrevented, true);
    });
  }
}

test("P9 an arrow key with nothing held does nothing and is not prevented", () => {
  const fx = fixture();
  const event = key(fx.button, "ArrowLeft");
  assert.deepEqual(fx.resident.pos, START);
  assert.equal(event.defaultPrevented, false);
});

test("P10 blur while key-held cancels the hold and restores the pick-up position", () => {
  const fx = fixture();
  key(fx.button, " "); key(fx.button, "ArrowLeft"); fx.button.dispatchEvent(new Event("blur"));
  assert.equal(fx.resident.calls.putDown.length, 1);
  assert.equal(fx.resident.calls.putDown[0]![0], false);
  assert.deepEqual(fx.resident.pos, START);
  assert.equal(fx.announced.at(-1), `${label} ${COPY.cancelled}`);
});

test("P11 a key that play answers with a line lets go of the grip and announces the line", () => {
  const fx = fixture(); fx.play.keyResult = "was tossed";
  key(fx.button, " "); key(fx.button, "t");
  assert.equal(fx.resident.calls.putDown.length, 0);
  assert.equal(fx.button.getAttribute("aria-pressed"), "false");
  assert.equal(fx.button.dataset["held"], undefined);
  assert.equal(fx.announced.at(-1), `${label} was tossed`);
});

test("P11 after play takes the resident a later Space picks it up again", () => {
  const fx = fixture(); fx.play.keyResult = "was tossed";
  key(fx.button, " "); key(fx.button, "t"); fx.play.keyResult = null; key(fx.button, " ");
  assert.equal(fx.resident.calls.pickUp.length, 2);
  assert.equal(fx.button.getAttribute("aria-pressed"), "true");
});

test("P12 a pointer release that play answers with a line is not a placement", () => {
  const fx = fixture(); fx.play.releaseResult = "landed in the pile";
  carry(fx); release(fx);
  assert.equal(fx.resident.calls.putDown.length, 0);
  assert.equal(fx.button.getAttribute("aria-pressed"), "false");
  assert.equal(fx.announced.at(-1), `${label} landed in the pile`);
  assert.equal(fx.drops.length, 0);
});

test("P13 a pointerdown while key-held does not start a second hold", () => {
  const fx = fixture();
  key(fx.button, " "); press(fx); moveBy(fx, PLACEMENT.threshold);
  assert.equal(fx.resident.calls.pickUp.length, 1);
  assert.equal(fx.button.hasPointerCapture(POINTER), false);
});

for (const [name, over] of [["a secondary button", { button: 2 }], ["a non-primary pointer", { isPrimary: false }]] as const) {
  test(`P13 ${name} on a free resident starts nothing`, () => {
    const fx = fixture();
    press(fx, over); moveBy(fx, PLACEMENT.threshold * 2);
    assert.equal(fx.resident.calls.pickUp.length, 0);
    assert.equal(fx.button.hasPointerCapture(POINTER), false);
    assert.equal(fx.button.dataset["input"], undefined);
  });
}

test("P14 forgetting a pointer-carried resident puts it down placed and ignores the later release", () => {
  const fx = fixture();
  // Deliberate fake: the hand-made resident implements only what the controls touch.
  carry(fx); fx.controls.forget(fx.resident as unknown as Resident); release(fx);
  assert.equal(fx.resident.calls.putDown.length, 2);
  assert.equal(fx.resident.calls.putDown.at(-1)![0], true);
  assert.equal(fx.button.getAttribute("aria-pressed"), "false");
  assert.equal(fx.button.hasPointerCapture(POINTER), false);
});

test("P15 Space on another resident's button does nothing while one is key-held", () => {
  const fx = fixture(["puff", "sprout"]);
  key(fx.button, " "); key(fx.buttons.get("sprout")!, " ");
  assert.equal(fx.residents[0]!.calls.pickUp.length, 1);
  assert.equal(fx.residents[1]!.calls.pickUp.length, 0);
  assert.equal(fx.residents[0]!.calls.putDown.length + fx.residents[1]!.calls.putDown.length, 0);
  assert.equal(fx.buttons.get("sprout")!.getAttribute("aria-pressed"), "false");
});

// LFT-068: setPointerCapture throws NotFoundError for a pointer that is no longer active.
const deadPointer = (fx: Fixture) => { fx.button.setPointerCapture = () => { throw new DOMException("gone", "NotFoundError"); }; };

test("P19 a caught press whose pointer capture fails puts the resident back, not left held", () => {
  const fx = fixture();
  fx.play.catch = () => true; deadPointer(fx);
  press(fx);
  assert.deepEqual(fx.resident.calls.putDown, [[true, false, 0]]);
  assert.equal(fx.resident.held, false);
  assert.equal(fx.button.getAttribute("aria-pressed"), "false");
});

test("P19 a press whose pointer capture fails leaves no grip: a later move picks nothing up", () => {
  const fx = fixture();
  deadPointer(fx);
  press(fx); moveBy(fx, PLACEMENT.threshold * 2);
  assert.equal(fx.resident.calls.pickUp.length, 0);
  assert.equal(fx.resident.held, false);
});
