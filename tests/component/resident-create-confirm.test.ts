import assert from "node:assert/strict";
import { test } from "node:test";
import { RESIDENT_COPY as COPY, WIZARD_COPY } from "../../src/residents/copy.ts";
import { residentForm } from "../../src/residents/create-form.ts";

// Component layer: the real Create panel with a hand-made DOM and a stub builder. Timers are fake.
// LFT-063: after "Not yet", a second submit must open a fresh 600 ms window for "Use 1 ticket".

const ARM_MS = 600; // the wait the spec names: Use 1 ticket ignores taps this long after the question opens
const NO_AT = 100;
const RESUBMIT_AT = 200;
const FIRST_ARM_AT = ARM_MS; // the first question's timer would fire here
const SECOND_ARM_AT = RESUBMIT_AT + ARM_MS;

const focused: unknown[] = [];

class El extends EventTarget {
  tagName: string;
  children: El[];
  classes: Set<string>;
  attributes: Map<string, string>;
  dataset: Record<string, string>;
  textContent: string | null;
  hidden: boolean;
  disabled: boolean;
  tabIndex: number;
  className: string;
  id: string;
  type: string;
  title: string;
  src: string;
  alt: string;
  draggable: boolean;
  value: string;
  classList: { add(...names: string[]): void; remove(...names: string[]): void; toggle(name: string, force?: boolean): boolean; contains(name: string): boolean };

  constructor(tag: string) {
    super();
    this.tagName = tag;
    this.children = [];
    this.classes = new Set();
    this.attributes = new Map();
    this.dataset = {};
    this.textContent = "";
    this.hidden = false;
    this.disabled = false;
    this.tabIndex = 0;
    this.className = "";
    this.id = "";
    this.type = "";
    this.title = "";
    this.src = "";
    this.alt = "";
    this.draggable = false;
    this.value = "";
    this.classList = {
      add: (...names) => { for (const name of names) this.classes.add(name); },
      remove: (...names) => { for (const name of names) this.classes.delete(name); },
      toggle: (name, force) => {
        const on = force ?? !this.classes.has(name);
        if (on) this.classes.add(name); else this.classes.delete(name);
        return on;
      },
      contains: (name) => this.classes.has(name),
    };
  }
  append(...nodes: El[]) { this.children.push(...nodes); }
  prepend(...nodes: El[]) { this.children.unshift(...nodes); }
  replaceChildren(...nodes: El[]) { this.children = [...nodes]; }
  setAttribute(name: string, value: string) { this.attributes.set(name, String(value)); }
  getAttribute(name: string) { return this.attributes.get(name) ?? null; }
  removeAttribute(name: string) { this.attributes.delete(name); }
  focus() { focused.push(this); }
  blur() {}
  closest(_selector?: string): unknown { return null; }
  matches() { return false; }
  querySelectorAll() { return []; }
  getClientRects() { return []; }
}

function find(node: El, text: string): El | undefined {
  if (node.textContent === text) return node;
  for (const child of node.children) {
    const hit = find(child, text);
    if (hit) return hit;
  }
  return undefined;
}

function findBy(node: El, test: (node: El) => boolean): El | undefined {
  if (test(node)) return node;
  for (const child of node.children) {
    const hit = findBy(child, test);
    if (hit) return hit;
  }
  return undefined;
}

function fixture(t: { after(fn: () => void): void }, mode = "mock", overrides: Record<string, unknown> = {}) {
  const body = new El("body");
  const doc = { body, createElement: (tag: string) => new El(tag), createElementNS: (_ns: string, tag: string) => new El(tag) };
  const saved = { document: Reflect.get(globalThis, "document"), matchMedia: Reflect.get(globalThis, "matchMedia") };
  Reflect.set(globalThis, "document", doc);
  Reflect.set(globalThis, "matchMedia", () => ({ matches: false }));
  t.after(() => {
    Reflect.set(globalThis, "document", saved.document);
    Reflect.set(globalThis, "matchMedia", saved.matchMedia);
  });
  focused.length = 0;
  const state: Record<string, unknown> = {
    status: "idle", error: null, saving: false, stage: "idle", tickets: 2,
    selections: { creature: null, personality: null, signatureDetail: null, palette: null }, ...overrides,
  };
  const selects: unknown[][] = [];
  const builder = { state: () => state, select: (...args: unknown[]) => { selects.push(args); }, create() {} };
  const { form, update, dispose, dismissProgress } = residentForm(builder as never, mode as never, undefined, () => {});
  const submit = () => form.dispatchEvent(new Event("submit", { cancelable: true }));
  const click = (label: string) => {
    const button = find(form as unknown as El, label);
    assert.ok(button, `no button labelled ${label}`);
    button.dispatchEvent(new Event("click"));
  };
  const yes = () => {
    const button = find(form as unknown as El, COPY.confirmYes);
    assert.ok(button, "Use 1 ticket is not rendered");
    return button;
  };
  const shows = (label: string) => find(form as unknown as El, label) !== undefined;
  // The first card of a question's grid; the grid fills only while that question is showing.
  const card = (field: string) => {
    const grid = findBy(form as unknown as El, node => node.dataset.field === field);
    const first = grid?.children.find(child => child.className === "wizard-card");
    assert.ok(first, `no card for ${field}`);
    return first;
  };
  const tap = (button: El) => button.dispatchEvent(new Event("click"));
  return { submit, click, yes, shows, state, update, dispose, dismissProgress, selects, card, tap, form: form as unknown as El };
}

test("LFT-063 a submit after Not yet opens a fresh 600 ms window, so the first window does not arm the second question", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const fx = fixture(t);
  fx.submit(); // question 1 opens; its window closes at 600 ms
  t.mock.timers.tick(NO_AT);
  fx.click(COPY.confirmNo);
  t.mock.timers.tick(RESUBMIT_AT - NO_AT);
  fx.submit(); // question 2 opens at 200 ms; its window closes at 800 ms
  t.mock.timers.tick(FIRST_ARM_AT + 50 - RESUBMIT_AT); // 650 ms: past question 1's timer, before question 2's
  assert.equal(fx.yes().disabled, true, "Use 1 ticket armed early by the first window");
  t.mock.timers.tick(SECOND_ARM_AT - (FIRST_ARM_AT + 50));
  assert.equal(fx.yes().disabled, false, "Use 1 ticket still disarmed at the end of question 2's window");
});

test("LFT-063 Use 1 ticket stays disarmed until 600 ms after its question opens", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const fx = fixture(t);
  fx.submit();
  t.mock.timers.tick(ARM_MS - 1);
  assert.equal(fx.yes().disabled, true);
  t.mock.timers.tick(1);
  assert.equal(fx.yes().disabled, false);
});

const failedNetwork = { status: "failed", error: { kind: "network", message: "Lost the connection." } };

test("Reconnect follows whether the builder can resume, not the mode: online with observe offers it", (t) => {
  const fx = fixture(t, "online", { ...failedNetwork, resumable: true });
  assert.equal(fx.shows(COPY.reconnect), true);
});

test("Reconnect follows whether the builder can resume, not the mode: local without observe starts a new build", (t) => {
  const fx = fixture(t, "local", { ...failedNetwork, resumable: false });
  assert.equal(fx.shows(COPY.reconnect), false);
  assert.equal(fx.shows(COPY.create), true);
});

// The panel's lifecycle model (create-form-model.ts): a pick's hold timer must not outlive the state that started it.
const HOLD_MS = 320; // the card's hop; matches PICK_HOLD_MS

test("a pick held when a build starts never runs: no answer reaches the builder, no focus jumps, the card is released", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const fx = fixture(t);
  const card = fx.card("creature");
  fx.tap(card);
  fx.state.status = "generating";
  fx.update();
  const focusedBefore = focused.length;
  t.mock.timers.tick(HOLD_MS * 3);
  assert.deepEqual(fx.selects, []);
  assert.equal(focused.length, focusedBefore, "a stale hold moved focus while the build ran");
  assert.equal(card.classes.has("is-picked"), false);
});

test("Back while a pick is held drops that pick instead of answering the earlier question with it", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const fx = fixture(t);
  fx.tap(fx.card("creature"));
  t.mock.timers.tick(HOLD_MS);
  assert.equal(fx.selects.length, 1);
  fx.tap(fx.card("personality"));
  fx.click(WIZARD_COPY.back);
  t.mock.timers.tick(HOLD_MS * 3);
  assert.equal(fx.selects.length, 1, "the held pick was applied after Back");
});

test("a second tap while a pick is held is ignored: one answer, not two", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const fx = fixture(t);
  fx.tap(fx.card("creature"));
  fx.tap(fx.card("creature"));
  t.mock.timers.tick(HOLD_MS * 3);
  assert.equal(fx.selects.length, 1);
});

test("dispose cancels a held pick: nothing reaches the builder afterwards", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const fx = fixture(t);
  fx.tap(fx.card("creature"));
  fx.dispose();
  t.mock.timers.tick(HOLD_MS * 3);
  assert.deepEqual(fx.selects, []);
});

test("dispose cancels the arm window: Use 1 ticket never arms afterwards", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const fx = fixture(t);
  fx.submit();
  fx.dispose();
  t.mock.timers.tick(ARM_MS * 3);
  assert.equal(fx.yes().disabled, true);
});

test("after dispose a submit opens no question", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const fx = fixture(t);
  fx.dispose();
  fx.submit();
  t.mock.timers.tick(ARM_MS * 3);
  assert.equal(fx.yes().disabled, true);
});

test("a finished build with the drawer open shows the arrival notice until dismissed", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const fx = fixture(t);
  fx.form.closest = () => ({ open: true });
  fx.state.status = "generating";
  fx.update();
  assert.equal(fx.form.dataset.phase, "creating");
  fx.state.status = "ready";
  fx.update();
  assert.equal(fx.form.dataset.phase, "creating", "the arrival notice should keep the progress layer");
  fx.dismissProgress();
  assert.equal(fx.form.dataset.phase, "design");
});

test("a finished build with the drawer closed leaves no arrival notice", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const fx = fixture(t);
  fx.state.status = "generating";
  fx.update();
  fx.state.status = "ready";
  fx.update();
  assert.equal(fx.form.dataset.phase, "design");
});
