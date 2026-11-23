import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { PLACEMENT } from "../../src/resident-movement-data.ts";
import { installResidentControls } from "../../src/resident-controls.ts";

// Component layer: pickup reliability (room-bugs triage, owner report 2026-11-18: a resident sometimes cannot be picked up).
// Same hand-made DOM, residents and runtime as resident-controls.test.ts, which is frozen, so its setup is repeated here.

const POINTER = 1;
const PRESS_AT = 100;
const SECOND_AT = PRESS_AT * 5;
const START = { x: 1000, y: 800 }; // open ground floor: drops are not clamped
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
    touch(_pressed?: boolean) {}, update() {}, pull() {}, fall() {},
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
  const play = { catch: (): boolean => false, release: () => null, key: () => null, sample() {}, carryTop: () => 0, reset() {} };
  const runtime = { clock: 0, update() {}, play, look: { scale: 1, left: 0, x: 0, y: 0, offsetY: 0, frozen: true, still: false } };
  const overlay = { residentButton: (id: string) => buttons.get(id)!, announce() {}, arrive() {} };
  const settings = { wander: true, subscribe() {}, setWander() {} };
  installResidentControls({ residents, cast: { x: 0, y: 0 } } as never, runtime as never, overlay as never, settings as never);
  return { resident: residents[0]!, residents, button: buttons.get(ids[0]!)!, buttons, play, document };
}
type Fixture = ReturnType<typeof fixture>;

function pointer(target: EventTarget, type: string, over: Record<string, unknown> = {}) {
  const event = new Event(type, { cancelable: true });
  Object.assign(event, { pointerId: POINTER, isPrimary: true, button: 0, pointerType: "mouse", clientX: PRESS_AT, clientY: PRESS_AT, ...over });
  target.dispatchEvent(event);
}
const press = (fx: Fixture) => pointer(fx.button, "pointerdown");
const release = (fx: Fixture) => pointer(fx.button, "pointerup");
const carry = (fx: Fixture) => { press(fx); pointer(fx.button, "pointermove", { clientX: PRESS_AT + PLACEMENT.threshold }); };
function escape(fx: Fixture) { fx.document.dispatchEvent(Object.assign(new Event("keydown", { cancelable: true }), { key: "Escape" })); }

/** Node reports a listener's throw as an uncaught exception; take it so the test can look at what the press left behind. */
async function pressThatThrows(fx: Fixture): Promise<unknown[]> {
  const saved = process.listeners("uncaughtException");
  const thrown: unknown[] = [];
  process.removeAllListeners("uncaughtException");
  process.on("uncaughtException", (error) => { thrown.push(error); });
  try { press(fx); await new Promise((resolve) => setImmediate(resolve)); }
  finally { process.removeAllListeners("uncaughtException"); for (const listener of saved) process.on("uncaughtException", listener); }
  return thrown;
}
const throwOnce = (fx: Fixture) => {
  let thrown = false;
  fx.play.catch = () => { if (thrown) return false; thrown = true; throw new Error("catch failed"); };
};

for (const recovery of ["a new press", "Escape, then a new press"]) {
  test(`P20 after a press throws midway, ${recovery} picks the resident up`, async () => {
    const fx = fixture(); throwOnce(fx);
    assert.equal((await pressThatThrows(fx)).length, 1);
    release(fx);
    if (recovery.startsWith("Escape")) escape(fx);
    carry(fx);
    assert.deepEqual(fx.resident.calls.pickUp, [[false]]);
    assert.equal(fx.button.dataset["held"], "true");
  });
}

test("P20 a press that throws midway does not leave the resident pressed", async () => {
  const fx = fixture(); throwOnce(fx);
  const touches: boolean[] = [];
  fx.resident.touch = (pressed?: boolean) => { touches.push(!!pressed); };
  await pressThatThrows(fx);
  assert.equal(touches.at(-1), false);
  assert.equal(fx.button.getAttribute("aria-pressed"), "false");
});

// A browser runs the document's capture listener, then the button's: the same event reaches both.
const secondFinger = (fx: Fixture, target: EventTarget, isPrimary = false) => {
  const event = Object.assign(new Event("pointerdown", { cancelable: true }),
    { pointerId: 2, isPrimary, button: 0, pointerType: "touch", clientX: SECOND_AT, clientY: SECOND_AT });
  fx.document.dispatchEvent(event);
  target.dispatchEvent(event);
};
const secondMove = (target: EventTarget) =>
  pointer(target, "pointermove", { pointerId: 2, isPrimary: false, clientX: SECOND_AT + PLACEMENT.threshold, clientY: SECOND_AT });

test("P21 a second finger on another resident during a carry puts the first back and picks the second up", () => {
  const fx = fixture(["puff", "sprout"]);
  const sprout = { resident: fx.residents[1]!, button: fx.buttons.get("sprout")! };
  carry(fx);
  secondFinger(fx, sprout.button);
  assert.deepEqual(fx.resident.calls.putDown, [[false, false, 0]]);
  secondMove(sprout.button);
  assert.deepEqual(sprout.resident.calls.pickUp, [[false]]);
  assert.equal(sprout.button.dataset["held"], "true");
});

test("P21 the first finger lifting afterwards does not drop the resident the second finger holds", () => {
  const fx = fixture(["puff", "sprout"]);
  const sprout = { resident: fx.residents[1]!, button: fx.buttons.get("sprout")! };
  carry(fx);
  secondFinger(fx, sprout.button);
  secondMove(sprout.button);
  release(fx);
  assert.equal(sprout.resident.calls.putDown.length, 0);
  assert.equal(sprout.button.dataset["held"], "true");
});

test("P21 a second pointer on the resident it just put back does not pick that resident up again", () => {
  const fx = fixture();
  carry(fx);
  secondFinger(fx, fx.button, true);
  secondMove(fx.button);
  assert.deepEqual(fx.resident.calls.pickUp, [[false]]);
  assert.equal(fx.resident.calls.putDown.length, 1);
  assert.equal(fx.button.dataset["held"], undefined);
});

test("P21 a second finger on bare floor during a carry only puts the carried resident back", () => {
  const fx = fixture(["puff", "sprout"]);
  carry(fx);
  fx.document.dispatchEvent(Object.assign(new Event("pointerdown"), { pointerId: 2, isPrimary: false, button: 0 }));
  assert.deepEqual(fx.resident.calls.putDown, [[false, false, 0]]);
  assert.equal(fx.residents[1]!.calls.pickUp.length, 0);
});
